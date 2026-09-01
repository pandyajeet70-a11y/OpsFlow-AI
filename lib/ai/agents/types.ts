/**
 * lib/ai/agents/types.ts
 *
 * Shared contracts for OpsFlow AI agents.
 *
 * Agents are provider-agnostic:
 * they don't know whether the underlying model is Ollama,
 * OpenAI, or another provider.
 */

export type AgentId =
  | "sales"
  | "customer_success"
  | "support"
  | "operations"
  | "analytics";

export type AgentStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export interface AgentRequest {
  prompt: string;

  /**
   * Optional additional context supplied by the workflow
   * or the user.
   */
  context?: string;

  /**
   * Optional model-generation controls.
   */
  temperature?: number;
  maxTokens?: number;

  /**
   * Correlation identifier for the originating HTTP request. Threaded from
   * the public API down through the orchestrator and agent to each tool call.
   */
  requestId?: string;

  /**
   * Authenticated user id, when available, for audit/correlation.
   *
   * IMPORTANT (Phase 3): in production this is the *verified* Firebase UID from
   * the ID token — never a client-supplied or model-supplied value. It is
   * populated by the `/api/ai/generate` route after authentication.
   */
  userId?: string;
  /**
   * Tenant identifier, resolved server-side from the caller's membership.
   *
   * NEVER trusted from the request body or the model — always derived from the
   * verified Firebase identity via the organization service.
   */
  organizationId?: string;
  organizationRole?: import("@/lib/ai/auth/types").OrgRole;
  isAdmin?: boolean;
}

export interface AgentToolResult {
  id: string;
  toolId: string;
  executed: boolean;
  status: "completed" | "failed" | "requires_approval";
  approvalRequired: boolean;
  approvalId?: string;
  result?: unknown;
  error?: string;
  requestId?: string;
  agentId?: string;
}

export interface AgentResponse {
  text: string;

  /**
   * Identifies which agent produced the response.
   */
  agentId: AgentId;

  /**
   * Provider/model information is kept optional because
   * some providers may not expose it.
   */
  provider?: string;
  model?: string;

  /**
   * Structured tool execution metadata when the agent chooses a tool.
   */
  tool?: AgentToolResult;

  /**
   * Allows future agents to return structured information
   * without breaking the basic text response contract.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Every OpsFlow agent must implement this interface.
 */
export interface AIAgent {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;

  execute(
    request: AgentRequest,
    signal?: AbortSignal
  ): Promise<AgentResponse>;
}

/**
 * Public agent registry shape.
 *
 * The registry will later map:
 *
 * "sales"      → Sales Agent
 * "customer_success" → Customer Success Agent
 * "support"    → Support Agent
 * "operations" → Operations Agent
 * "analytics"  → Analytics Agent
 */
export type AgentRegistry = Record<AgentId, AIAgent>;