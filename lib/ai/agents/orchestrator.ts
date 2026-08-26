/**
 * lib/ai/agents/orchestrator.ts
 *
 * OpsFlow Agent Orchestrator
 *
 * Responsibilities:
 * - Select the appropriate business agent
 * - Execute the selected agent
 * - Support explicit agent selection
 * - Automatically classify simple requests
 * - Return a consistent result
 */

import { getAgent, isAgentId } from "./registry";
import type { AgentId, AgentRequest, AgentResponse } from "./types";

export interface OrchestrationRequest extends AgentRequest {
  /**
   * Optional explicit agent selection.
   *
   * If provided, the orchestrator will use this agent
   * instead of automatic routing.
   */
  agentId?: string;
}

export interface OrchestrationResult {
  agentId: AgentId;
  response: AgentResponse;
  routing: "explicit" | "automatic";
}

/* =========================================================
   Automatic Agent Routing
   ========================================================= */

function detectAgent(prompt: string): AgentId {
  const text = prompt.toLowerCase();

  /* -------------------------
     Customer Success signals
     ------------------------- */

  const customerSuccessKeywords = [
    "customer success",
    "customer-success",
    "handoff",
    "onboarding",
    "implementation",
    "next actions",
    "customer kickoff",
  ];

  if (customerSuccessKeywords.some((keyword) => text.includes(keyword))) {
    return "customer_success";
  }

  /* -------------------------
     Sales signals
     ------------------------- */

  const salesKeywords = [
    "lead",
    "leads",
    "sales",
    "sell",
    "selling",
    "customer",
    "prospect",
    "conversion",
    "follow up",
    "follow-up",
    "deal",
    "pipeline",
    "revenue",
    "client",
  ];

  if (salesKeywords.some((keyword) => text.includes(keyword))) {
    return "sales";
  }

  /* -------------------------
     Support signals
     ------------------------- */

  const supportKeywords = [
    "support",
    "issue",
    "problem",
    "complaint",
    "refund",
    "broken",
    "error",
    "help",
    "ticket",
    "customer service",
    "not working",
  ];

  if (supportKeywords.some((keyword) => text.includes(keyword))) {
    return "support";
  }

  /* -------------------------
     Analytics signals
     ------------------------- */

  const analyticsKeywords = [
    "analytics",
    "analysis",
    "analyze",
    "data",
    "report",
    "reports",
    "metrics",
    "kpi",
    "trend",
    "trends",
    "performance",
    "statistics",
    "insights",
  ];

  if (analyticsKeywords.some((keyword) => text.includes(keyword))) {
    return "analytics";
  }

  /* -------------------------
     Operations signals
     ------------------------- */

  const operationsKeywords = [
    "workflow",
    "workflow",
    "automation",
    "automate",
    "operations",
    "task",
    "tasks",
    "process",
    "inventory",
    "schedule",
    "approval",
    "internal",
    "operation",
  ];

  if (operationsKeywords.some((keyword) => text.includes(keyword))) {
    return "operations";
  }

  /*
   * Operations is the safest general-purpose fallback because
   * OpsFlow is primarily an operations automation platform.
   */
  return "operations";
}

/* =========================================================
   Main Orchestrator
   ========================================================= */

export async function orchestrate(
  request: OrchestrationRequest,
  signal?: AbortSignal
): Promise<OrchestrationResult> {
  if (
    typeof request.prompt !== "string" ||
    request.prompt.trim().length === 0
  ) {
    throw new Error("A non-empty prompt is required.");
  }

  let agentId: AgentId;
  let routing: "explicit" | "automatic";

  /* -------------------------------------------------------
     Explicit routing
     ------------------------------------------------------- */

  if (request.agentId !== undefined) {
    if (!isAgentId(request.agentId)) {
      throw new Error(`Unknown agent: ${request.agentId}`);
    }

    agentId = request.agentId;
    routing = "explicit";
  } else {
    /* -----------------------------------------------------
       Automatic routing
       ----------------------------------------------------- */

    agentId = detectAgent(request.prompt);
    routing = "automatic";
  }

  const agent = getAgent(agentId);

  if (!agent) {
    throw new Error(`Agent "${agentId}" is not registered.`);
  }

  const agentRequest: AgentRequest = {
    prompt: request.prompt,
    context: request.context,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    requestId: request.requestId,
    userId: request.userId,
    organizationId: request.organizationId,
  };

  const response = await agent.execute(agentRequest, signal);

  return {
    agentId,
    response,
    routing,
  };
}

/* =========================================================
   Routing Preview
   ========================================================= */

/**
 * Allows the UI to determine which agent would handle a
 * request without actually executing the agent.
 *
 * Useful later for:
 * - dashboard previews
 * - approval screens
 * - workflow builders
 * - "AI is routing your request..." UI
 */
export function previewRouting(prompt: string): {
  agentId: AgentId;
  agentName: string;
} {
  const agentId = detectAgent(prompt);
  const agent = getAgent(agentId);

  return {
    agentId,
    agentName: agent.name,
  };
}