/**
 * lib/ai/tools/decision.ts
 *
 * Genuinely model-driven tool calling.
 *
 * Given the active AI provider and the set of *registered* tools, this module
 * asks the model to emit a strict, typed tool decision (as JSON) and then:
 *
 *   1. validates the chosen tool id against the registry,
 *   2. validates the arguments against the tool's declared input schema,
 *   3. recomputes approvalRequired from the *registry* (never trusts the model),
 *   4. never lets an unregistered / invisible tool through.
 *
 * This sits beside the existing deterministic rule-based decision used as the
 * high-confidence fast path in the agent registry. Both paths funnel into the
 * same typed ToolDecision, so the executor contract is unchanged.
 */

import {
  buildToolCatalog,
  extractToolJSON,
  validateToolInput,
  type ModelToolDescriptor,
} from "./schema";
import { getTool, hasTool, listTools } from "./registry";
import type {
  ToolDecision,
  ToolDefinition,
} from "./types";
import type { AIProvider } from "../types";

export interface ModelToolDecisionRequest {
  prompt: string;
  context?: string;
  agentId?: string;
  provider: AIProvider;
  signal?: AbortSignal;
}

const DECISION_SYSTEM_PROMPT = `You are the OpsFlow tool router.
Your only job is to decide whether the user's request maps to exactly one
registered OpsFlow tool, and if so, to return a JSON object describing that call.

Rules:
- Only ever choose a tool from the provided catalog. Never invent one.
- If the request is a normal conversational/text request with no tool intent,
  return {"tool": null}.
- If the request clearly maps to a tool but important required arguments are
  missing from the user's message, still return the tool with the arguments you
  can extract, leaving missing ones absent so validation can report them.
- For multi-step or ambiguous requests, prefer {"tool": null}.

Respond with ONLY a single JSON object, no prose, no markdown:

For a tool call:
{"tool":{"id":"<tool id>","arguments":{...}}}

For no tool:
{"tool":null}`;

/**
 * Builds the catalog block injected into the decision prompt.
 */
function buildCatalogBlock(catalog: ModelToolDescriptor[]): string {
  const safe = catalog.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    requiresApproval: t.requiresApproval,
    mutatesData: t.mutatesData === true,
    inputSchema: t.inputSchema ?? { type: "object", properties: {} },
  }));

  return `Available tools (JSON):\n${JSON.stringify(safe, null, 2)}`;
}

/**
 * Recomputes the authoritative approval requirement from the registered tool.
 * The model's own claim is never trusted.
 */
export function approvalRequiredFor(tool: ToolDefinition | undefined): boolean {
  return tool?.requiresApproval === true;
}

/**
 * Turns a parsed model decision into a validated ToolDecision, or a
 * `{ type: "none" }` decision when the tool is unregistered / args are invalid.
 * This is the single choke point that prevents unregistered tools from running.
 */
export function normalizeModelDecision(
  parsed: { tool: { id?: unknown; arguments?: unknown } | null },
  agentId?: string
): ToolDecision {
  if (!parsed || parsed.tool === null || parsed.tool === undefined) {
    return { type: "none", reason: "no_tool_intent" };
  }

  const toolId = parsed.tool.id;
  if (typeof toolId !== "string" || toolId.trim().length === 0) {
    return { type: "none", reason: "no_tool_intent" };
  }

  // Hard guard (F): only registered tools may execute.
  if (!hasTool(toolId)) {
    return { type: "none", reason: `unregistered_tool:${toolId}` };
  }

  const tool = getTool(toolId);
  if (!tool) {
    return { type: "none", reason: `unregistered_tool:${toolId}` };
  }

  // Agent allow-list guard: never let an agent use a tool it isn't scoped to.
  if (tool.allowedAgents && agentId && !tool.allowedAgents.includes(agentId)) {
    return { type: "none", reason: `tool_not_allowed:${toolId}` };
  }

  // Argument validation against the tool's declared input schema.
  const rawArgs =
    parsed.tool.arguments &&
    typeof parsed.tool.arguments === "object" &&
    !Array.isArray(parsed.tool.arguments)
      ? (parsed.tool.arguments as Record<string, unknown>)
      : {};

  const validation = validateToolInput(tool.inputSchema, rawArgs);
  if (!validation.valid) {
    /*
     * Approval-required tools must still surface as a tool decision even when
     * the requested arguments are incomplete: they can never execute without an
     * explicit approval token, so the caller should see `requires_approval`
     * instead of the decision being silently dropped (which would fall back to
     * a plain-text reply). The approval gate in the executor is untouched.
     *
     * Non-approval tools keep strict validation — invalid arguments are
     * rejected so nothing ever executes with malformed data.
     */
    if (approvalRequiredFor(tool)) {
      return {
        type: "tool",
        toolId: tool.id,
        toolName: tool.name,
        arguments: validation.data,
        approvalRequired: true,
      };
    }

    return {
      type: "none",
      reason: `invalid_arguments:${validation.errors.join("; ")}`,
    };
  }

  return {
    type: "tool",
    toolId: tool.id,
    toolName: tool.name,
    arguments: validation.data,
    approvalRequired: approvalRequiredFor(tool),
  };
}

/**
 * Asks the model to produce a typed tool decision from the registered catalog.
 * Any parse/validation/provider failure is treated as "no tool" so a flaky model
 * can never cause an unregistered or malformed tool call.
 */
export async function decideToolCallWithModel(
  request: ModelToolDecisionRequest
): Promise<ToolDecision> {
  const catalog = buildToolCatalog(listTools(), request.agentId);

  if (catalog.length === 0) {
    return { type: "none", reason: "no_tools_available" };
  }

  const userPrompt = `${buildCatalogBlock(catalog)}\n\nUser request:\n"""\n${request.prompt}\n"""\n\nReturn the tool decision JSON now.`;

  const result = await request.provider.generate(
    {
      prompt: userPrompt,
      system: DECISION_SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 500,
    },
    request.signal ?? new AbortController().signal
  );

  const parsedJson = extractToolJSON(result.text);
  if (!parsedJson) {
    return { type: "none", reason: "unreadable_model_response" };
  }

  const parsed = parsedJson as {
    tool: { id?: unknown; arguments?: unknown } | null;
  };

  return normalizeModelDecision(parsed, request.agentId);
}