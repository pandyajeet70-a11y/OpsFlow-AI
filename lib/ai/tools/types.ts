/**
 * lib/ai/tools/types.ts
 *
 * Shared contracts for the OpsFlow tool/action system.
 *
 * This file defines a first-class, typed tool-call contract:
 *
 *  - ToolDefinition  : what a registered tool *is* (incl. an input schema).
 *  - ToolDecision    : what the orchestrator/agent decided the model asked for.
 *  - ToolExecutionResult : the actual outcome of running a tool (or why it
 *                         did not run: unregistered / requires approval / failed).
 */

/* ---------------------------------------------------------------
   Input schema (the typed tool-call contract)
   --------------------------------------------------------------- */

/** Primitive types the model/agent arguments are validated against. */
export type ToolInputType = "string" | "number" | "boolean" | "object";

/** A single input field the calling agent/model must (or may) provide. */
export interface ToolInputProperty {
  type: ToolInputType;
  description?: string;
}

/**
 * Lightweight, dependency-free JSON-schema style declaration used to describe
 * a tool's expected arguments. Kept intentionally small so it can be
 * serialized into a model prompt and validated at runtime without pulling in
 * a schema library.
 */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, ToolInputProperty>;
  required?: string[];
}

/* ---------------------------------------------------------------
   Tool definition
   --------------------------------------------------------------- */

import type { Permission } from "../auth/authorization-server";
import type { OrgRole } from "../auth/types";

export interface ToolExecutionContext {
  agentId?: string;
  userId?: string;
  requestId?: string;
  /**
   * Tenant identifier resolved server-side. Business resources created by tools
   * carry this organizationId; approvals are scoped to it.
   */
  organizationId?: string;
  /** Verified organization role resolved by the server. */
  organizationRole?: OrgRole;
  /**
   * Whether the caller is a global admin (from Firebase custom claims).
   */
  isAdmin?: boolean;
  /**
   * Caller-supplied approval token. When true and the tool requires approval,
   * the executor is allowed to run; otherwise it is blocked.
   */
  approved?: boolean;
  signal?: AbortSignal;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;

  /**
   * Typed tool-call contract: declares the arguments this tool accepts.
   * Used for (a) telling the model what to emit, and (b) runtime validation
   * before execution so untyped/garbage args never reach business logic.
   */
  inputSchema: ToolInputSchema;

  /**
   * Whether this tool can make a real business-side change.
   */
  mutatesData?: boolean;

  /**
   * Whether the action should require explicit human approval before it runs.
   * When true, the executor refuses to execute unless `context.approved` is set.
   */
  requiresApproval?: boolean;

  /** Permission required before this tool may execute. */
  requiredPermission?: Permission;

  /**
   * Optional whitelist of agent ids allowed to trigger this tool. When
   * absent, any agent may use it. Prevents cross-agent misuse.
   */
  allowedAgents?: string[];

  /**
   * Whether the model is allowed to autonomously choose this tool.
   * Defaults to true. Set false for internal/admin-only tools.
   */
  visibleToModel?: boolean;

  execute: (
    input: Record<string, unknown>,
    context?: ToolExecutionContext
  ) => Promise<unknown>;
}

/* ---------------------------------------------------------------
   Tool decision
   --------------------------------------------------------------- */

export type ToolDecision =
  | {
      type: "none";
      reason?: string;
    }
  | {
      type: "tool";
      toolId: string;
      toolName: string;
      arguments: Record<string, unknown>;
      approvalRequired: boolean;
    };

/* ---------------------------------------------------------------
   Execution outcome
   --------------------------------------------------------------- */

/** Lifecycle of a tool after the executor (or agent) is done with it. */
export type ToolExecutionStatus =
  | "completed"
  | "failed"
  | "requires_approval";

/**
 * Structured outcome surfaced to the agent and, in turn, to the API response.
 * Every field critical for observability/correlation is typed here so callers
 * don't have to guess.
 */
export interface ToolExecutionResult {
  success: boolean;
  toolId: string;
  toolName: string;
  executed: boolean;
  status: ToolExecutionStatus;
  result: unknown;
  durationMs: number;

  /** Blocker reason when the execution did not run. */
  error?: string;

  /** Whether this tool would need approval (always true for status requires_approval). */
  approvalRequired: boolean;

  /**
   * Persisted approval request id created when a tool requires approval.
   * Present (when persistence succeeds) on requires_approval results so callers
   * can route the user to the approve/reject endpoints.
   */
  approvalId?: string;

  /** Correlation context, threaded from the public API down to the tool. */
  requestId?: string;
  agentId?: string;
  userId?: string;
}