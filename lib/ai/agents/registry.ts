/**
 * lib/ai/agents/registry.ts
 *
 * Central registry for OpsFlow AI agents.
 *
 * Each agent now uses the existing AI provider abstraction,
 * so agents can run through Ollama today and OpenAI later.
 */

import { getOllamaConfig, getOpenAIConfig } from "@/lib/ai/config";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { executeTool } from "@/lib/ai/tools/executor";
import { decideToolCallWithModel } from "@/lib/ai/tools/decision";
import { extractToolJSON } from "@/lib/ai/tools/schema";
import { getTool, hasTool } from "@/lib/ai/tools/registry";
import type {
  ToolDecision,
  ToolExecutionResult,
} from "@/lib/ai/tools/types";
import type { AIProvider } from "@/lib/ai/types";
import { getAgentPrompt } from "./prompts";
import { getDefaultAuditService } from "../audit";

import type {
  AIAgent,
  AgentId,
  AgentRegistry,
  AgentRequest,
  AgentResponse,
  AgentToolResult,
} from "./types";
import type { CustomerHandoff, OnboardingPlan, OnboardingPriority } from "@/lib/ai/onboarding/types";

/* =========================================================
   Agent Factory
   ========================================================= */

function parseLeadCreationToolRequest(
  prompt: string
): Record<string, unknown> | null {
  const text = prompt.trim();

  const isLeadIntent =
    /(create|add|new)\s+(lead|prospect)/i.test(text) ||
    /\blead\b/i.test(text) && /\b(create|add|new)\b/i.test(text);

  if (!isLeadIntent) {
    return null;
  }

  const nameMatch = text.match(
    /(?:named|name)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+)+|[A-Z][A-Za-z'.-]+)/i
  );
  const emailMatch = text.match(
    /email\s+([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i
  );
  const companyMatch = text.match(
    /company\s+([^,]+?)(?:,\s*(?:source|origin)|$)/i
  );
  const sourceMatch = text.match(
    /source\s+([^,.]+?)(?:[.,]|$)/i
  );

  if (!nameMatch || !emailMatch || !companyMatch) {
    return null;
  }

  const name = nameMatch[1]?.trim();
  const email = emailMatch[1]?.trim();
  const company = companyMatch[1]?.trim();
  const source = sourceMatch?.[1]?.trim() || "website";

  if (!name || !email || !company) {
    return null;
  }

  return {
    name,
    email,
    company,
    source,
  };
}

function decideToolRequest(prompt: string): ToolDecision | null {
  const args = parseLeadCreationToolRequest(prompt);

  if (!args) {
    return null;
  }

  return {
    type: "tool",
    toolId: "create_lead",
    toolName: "Create Lead",
    arguments: args,
    approvalRequired: false,
  };
}

/* =========================================================
   Tool-execution helpers
   ========================================================= */

function modelForProvider(provider: AIProvider): string {
  return provider.name === "ollama"
    ? getOllamaConfig().model
    : getOpenAIConfig().model;
}

function buildToolOutcome(
  agentId: AgentId,
  requestId: string,
  execution: ToolExecutionResult
): AgentToolResult {
  return {
    id: execution.toolId,
    toolId: execution.toolId,
    executed: execution.executed,
    status: execution.status,
    approvalRequired: execution.approvalRequired,
    approvalId: execution.approvalId,
    result: execution.success ? execution.result : undefined,
    error: execution.success ? undefined : execution.error,
    requestId,
    agentId,
  };
}

/**
 * Chooses a typed tool decision:
 *
 *  1. High-confidence deterministic rule parse first (stable, offline-safe),
 *  2. otherwise a genuine model-driven decision against the registered catalog.
 *
 * Any model/provider failure degrades to "no tool" so text-only requests and
 * offline testing keep working.
 */
async function decideToolCall(
  request: AgentRequest,
  provider: AIProvider,
  agentId: AgentId,
  signal: AbortSignal
): Promise<ToolDecision> {
  const ruleDecision = decideToolRequest(request.prompt);
  if (ruleDecision) {
    return ruleDecision;
  }

  try {
    return await decideToolCallWithModel({
      prompt: request.prompt,
      context: request.context,
      agentId,
      provider,
      signal,
    });
  } catch {
    return { type: "none", reason: "model_decider_unavailable" };
  }
}

/**
 * Feeds the actual tool result back into the agent's reply text (D).
 * Prefers a model narration of the real result; falls back to a deterministic
 * summary when the provider is unavailable so tool actions are never blocked
 * or reported incorrectly.
 */
async function composeToolResponseText(opts: {
  provider: AIProvider;
  systemPrompt: string;
  execution: ToolExecutionResult;
  args: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<string> {
  const { provider, systemPrompt, execution, args, signal } = opts;

  if (execution.status === "requires_approval") {
    return `This action (${execution.toolName}) requires your approval before it can run. Please confirm it, and I'll complete it.`;
  }

  let fallback: string;
  if (execution.success) {
    const r = execution.result as Record<string, unknown> | null;
    const bits: string[] = [];
    if (r && typeof r === "object") {
      for (const key of ["id", "name", "email", "company", "status"]) {
        const v = (r as Record<string, unknown>)[key];
        if (typeof v === "string" && v) bits.push(v);
      }
    }
    fallback =
      bits.length > 0
        ? `Done. ${execution.toolName} → ${bits.join(", ")}.`
        : `${execution.toolName} completed successfully.`;
  } else {
    fallback = `${execution.toolName} couldn't be completed. ${execution.error ?? "Please try again."}`;
  }

  try {
    const out = await provider.generate(
      {
        prompt: `The user asked: "${JSON.stringify(args)}".\nA tool (${execution.toolId}) ${execution.success ? "completed" : "failed"}. tool result=${JSON.stringify(execution.result ?? null)} error=${execution.error ?? "none"}. Reply to the user in one concise, friendly sentence.`,
        system: systemPrompt,
        temperature: 0.3,
        maxTokens: 160,
      },
      signal
    );
    const t = out.text?.trim();
    return t && t.length > 0 ? t : fallback;
  } catch {
    return fallback;
  }
}

function unregisteredToolOutcome(
  agentId: AgentId,
  requestId: string,
  toolId: string
): AgentToolResult {
  return {
    id: toolId,
    toolId,
    executed: false,
    status: "failed",
    approvalRequired: false,
    error: `Tool "${toolId}" is not registered.`,
    requestId,
    agentId,
  };
}

function createAgent(
  id: AgentId,
  name: string,
  description: string
): AIAgent {
  return {
    id,
    name,
    description,

    async execute(
      request: AgentRequest,
      signal?: AbortSignal
    ): Promise<AgentResponse> {
      const provider = getAIProvider();
      const effectiveSignal = signal ?? new AbortController().signal;
      const systemPrompt = getAgentPrompt(id);
      const requestId = request.requestId ?? `req_${Date.now()}`;
      const agentId = id;

      const toolDecision = await decideToolCall(
        request,
        provider,
        agentId,
        effectiveSignal
      );

      // Emit tool_decision audit event at the point the decision is finalized
      if (toolDecision.type === "tool") {
        getDefaultAuditService().fire("tool_decision", {
          eventType: "tool_decision",
          requestId,
          userId: request.userId,
          organizationId: request.organizationId,
          agentId,
          toolId: toolDecision.toolId,
          success: true,
          status: "tool_selected",
          metadata: {
            toolName: toolDecision.toolName,
            approvalRequired: toolDecision.approvalRequired,
            decisionSource: "deterministic",
          },
        });
      } else {
        getDefaultAuditService().fire("tool_decision", {
          eventType: "tool_decision",
          requestId,
          userId: request.userId,
          organizationId: request.organizationId,
          agentId,
          success: false,
          status: "no_tool",
          metadata: {
            reason: toolDecision.reason ?? "unknown",
            decisionSource: "deterministic",
          },
        });
      }

      if (toolDecision && toolDecision.type === "tool") {
        const toolId = toolDecision.toolId;

        /* -----------------------------------------------
           Hard guard (F): unregistered tools never execute.
           ----------------------------------------------- */
        if (!hasTool(toolId)) {
          return {
            text: `I couldn't do that — the tool "${toolId}" isn't available.`,
            agentId,
            provider: provider.name,
            model: modelForProvider(provider),
            tool: unregisteredToolOutcome(agentId, requestId, toolId),
            metadata: {
              status: "failed",
              toolDecision: "rejected_unregistered",
            },
          };
        }

        const tool = getTool(toolId);
        const approvalRequired = tool?.requiresApproval === true;

        /* -----------------------------------------------
           Keep execution behind the executor (B). The
           executor additionally guards registration, schema,
           and approval, so behavior is consistent everywhere.
           ----------------------------------------------- */
                const execution = await executeTool({
          toolId,
          input: toolDecision.arguments,
          context: {
            agentId,
            requestId,
            userId: request.userId,
            organizationId: request.organizationId,
            organizationRole: request.organizationRole,
            isAdmin: request.isAdmin,
            signal: effectiveSignal,
          },
        });

        const text = await composeToolResponseText({
          provider,
          systemPrompt,
          execution,
          args: toolDecision.arguments,
          signal: effectiveSignal,
        });

        return {
          text,
          agentId,
          provider: provider.name,
          model: modelForProvider(provider),
          tool: buildToolOutcome(agentId, requestId, execution),
          metadata: {
            status: execution.status,
            toolDecision:
              execution.status === "requires_approval"
                ? "awaiting_approval"
                : execution.executed
                  ? "executed"
                  : "failed",
            approvalRequired,
          },
        };
      }

      /* -------------------------------------------------
         Normal text-only AI request (E)
         ------------------------------------------------- */

      const result = await provider.generate(
        {
          prompt: request.prompt,
          system: systemPrompt,
          temperature: request.temperature ?? 0.4,
          maxTokens: request.maxTokens ?? 1000,
        },
        effectiveSignal,
      );

      return {
        text: result.text,
        agentId,
        provider: result.provider,
        model: result.model,
        metadata: {
          status: "completed",
        },
      };
    },
  };
}

/* =========================================================
   Agent Definitions
   ========================================================= */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOnboardingPlan(value: unknown): OnboardingPlan | null {
  if (!isRecord(value)) return null;
  const stringArray = (item: unknown): item is string[] =>
    Array.isArray(item) && item.every((entry) => typeof entry === "string");
  const nextActions = value.nextActions;
  if (
    typeof value.summary !== "string" ||
    !stringArray(value.goals) ||
    !stringArray(value.requirements) ||
    !Array.isArray(nextActions) ||
    !stringArray(value.risks) ||
    typeof value.timeline !== "string"
  ) {
    return null;
  }

  const actions = nextActions.map((action) => {
    if (!isRecord(action)) return null;
    const priority = action.priority;
    if (
      typeof action.title !== "string" ||
      typeof action.description !== "string" ||
      (priority !== "high" && priority !== "medium" && priority !== "low")
    ) {
      return null;
    }
    return {
      title: action.title,
      description: action.description,
      priority: priority as OnboardingPriority,
    };
  });
  return actions.every((action) => action !== null)
    ? {
        summary: value.summary,
        goals: value.goals,
        requirements: value.requirements,
        nextActions: actions,
        risks: value.risks,
        timeline: value.timeline,
      }
    : null;
}

function fallbackOnboardingPlan(handoff: CustomerHandoff): OnboardingPlan {
  return {
    summary: `Onboard ${handoff.company} to the ${handoff.plan} plan.`,
    goals: [
      "Confirm onboarding scope and success criteria.",
      "Complete the requested CRM integration.",
    ],
    requirements: [
      "Schedule the onboarding kickoff for next week.",
      "Collect CRM integration access and technical contacts.",
    ],
    nextActions: [
      {
        title: "Schedule onboarding kickoff",
        description: "Coordinate a kickoff with the customer and implementation owner.",
        priority: "high",
      },
      {
        title: "Confirm CRM integration details",
        description: "Document the CRM, access requirements, and integration scope.",
        priority: "high",
      },
    ],
    risks: ["CRM access or integration requirements may delay kickoff."],
    timeline: "Kickoff next week; confirm integration milestones during kickoff.",
  };
}

const customerSuccessAgent: AIAgent = {
  id: "customer_success",
  name: "Customer Success Agent",
  description: "Receives customer handoffs, prepares onboarding plans, and recommends next actions.",
  async execute(request, signal) {
    const handoff = JSON.parse(request.context ?? "null") as CustomerHandoff | null;
    if (!handoff || typeof handoff.handoffId !== "string") {
      throw new Error("Customer handoff context is required.");
    }

    const provider = getAIProvider();
    let onboardingPlan: OnboardingPlan | null = null;
    try {
      const response = await provider.generate(
        {
          system: getAgentPrompt("customer_success"),
          prompt: `Create a JSON-only onboarding plan from this handoff. Return exactly the keys summary (string), goals (string[]), requirements (string[]), nextActions ({title,description,priority}[] where priority is high, medium, or low), risks (string[]), and timeline (string). Handoff: ${JSON.stringify(handoff)}`,
          temperature: 0.2,
          maxTokens: 800,
        },
        signal ?? new AbortController().signal
      );
      onboardingPlan = parseOnboardingPlan(extractToolJSON(response.text));
    } catch (error) {
      console.error("[customer-success-agent] plan generation error:", error);
    }

    onboardingPlan ??= fallbackOnboardingPlan(handoff);
    return {
      text: `Prepared an onboarding plan for ${handoff.company}.`,
      agentId: "customer_success",
      provider: provider.name,
      model: modelForProvider(provider),
      metadata: { status: "completed", onboardingPlan },
    };
  },
};

const salesAgent = createAgent(
  "sales",
  "Sales Agent",
  "Handles lead qualification, sales communication, follow-ups, and customer conversion workflows."
);

const supportAgent = createAgent(
  "support",
  "Support Agent",
  "Handles customer questions, support requests, issue classification, and response generation."
);

const operationsAgent = createAgent(
  "operations",
  "Operations Agent",
  "Handles internal workflows, task coordination, process automation, and operational decisions."
);

const analyticsAgent = createAgent(
  "analytics",
  "Analytics Agent",
  "Analyzes business data, identifies trends, generates insights, and produces decision-support summaries."
);

/* =========================================================
   Central Registry
   ========================================================= */

export const agentRegistry: AgentRegistry = {
  sales: salesAgent,
  customer_success: customerSuccessAgent,
  support: supportAgent,
  operations: operationsAgent,
  analytics: analyticsAgent,
};

/* =========================================================
   Registry Helpers
   ========================================================= */

export function getAgent(agentId: AgentId): AIAgent {
  return agentRegistry[agentId];
}

export function isAgentId(value: unknown): value is AgentId {
  return (
    value === "sales" ||
    value === "customer_success" ||
    value === "support" ||
    value === "operations" ||
    value === "analytics"
  );
}

export function getAllAgents(): AIAgent[] {
  return Object.values(agentRegistry);
}

export function getAgentMetadata() {
  return getAllAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
  }));
}