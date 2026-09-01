/**
 * lib/ai/executions/types.ts
 *
 * Typed domain model for OpsFlow's durable execution engine (Phase 5).
 *
 * An Execution represents a durable, observable workflow that can span
 * multiple steps (tool calls, approvals, retries) and survive process
 * boundaries. It is the unit of idempotency, retry, timeout, and audit.
 *
 * SECURITY / PRIVACY GUARANTEES:
 *  - userId is ALWAYS a server-verified Firebase UID (never client-supplied).
 *  - organizationId is ALWAYS resolved server-side from membership.
 *  - metadata NEVER contains secrets: no Firebase keys, API keys, access
 *    tokens, passwords, authorization headers, raw env vars, or full prompt /
 *    tool-argument / model-result content.
 *
 * This module is intentionally dependency-free (no Firebase) so it can be
 * compiled and unit-tested offline.
 */

/** Lifecycle of an execution. */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "waiting_for_approval"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

/** Lifecycle of a single step within an execution. */
export type StepStatus =
  | "pending"
  | "running"
  | "waiting_for_approval"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowActionStatus =
  | "pending"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "retrying";

export interface WorkflowAction {
  actionId: string;
  toolId: string;
  executionId: string;
  status: WorkflowActionStatus;
  attempt: number;
  maxAttempts: number;
  approvalId?: string;
  lastError?: string;
}

/** Type of step - maps to the underlying action. */
export type StepType = "tool" | "approval" | "agent_handoff";

/** Retry policy for a step. */
export interface RetryPolicy {
  /** Maximum number of attempts (including the first). */
  maxAttempts: number;
  /** Initial backoff in milliseconds. */
  initialBackoffMs: number;
  /** Maximum backoff in milliseconds. */
  maxBackoffMs: number;
  /** Backoff multiplier (exponential). */
  multiplier: number;
  /** Whether this step can be retried on failure. */
  retryable: boolean;
}

/** Default retry policy for tool steps. */
export const DEFAULT_TOOL_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 10000,
  multiplier: 2,
  retryable: true,
};

/** A single step in an execution workflow. */
export interface ExecutionStep {
  /** Unique step identifier (e.g., "step_01_create_lead"). */
  stepId: string;
  /** Execution this step belongs to. */
  executionId: string;
  /** Type of action. */
  type: StepType;
  /** Tool ID if type is "tool", approval ID if type is "approval". */
  actionId: string;
  /** Human-readable name of the action. */
  actionName: string;
  /** Current status of this step. */
  status: StepStatus;
  /** Current attempt number (1-indexed). */
  attempt: number;
  /** Retry policy for this step. */
  retryPolicy: RetryPolicy;
  /** When this step was started (ISO timestamp). */
  startedAt?: string;
  /** When this step completed (ISO timestamp). */
  completedAt?: string;
  /** Error message if failed. */
  error?: string;
  /** Safe result metadata only (no secrets, no raw content). */
  metadata?: Record<string, unknown>;
  /** Approval ID if this step is waiting for approval. */
  approvalId?: string;
}

/** The complete execution state. */
export interface Execution {
  /** Unique execution identifier (server-minted). */
  executionId: string;
  /** Original request correlation ID. */
  requestId: string;
  /** Server-verified Firebase UID. Never client-controlled. */
  userId?: string;
  /** Server-resolved tenant id. Never client-controlled. */
  organizationId?: string;
  /** Agent that owns this execution. */
  agentId: string;
  /** Workflow/operation type for categorization. */
  workflowType: string;
  /** Current execution status. */
  status: ExecutionStatus;
  /** Ordered list of steps in this execution. */
  steps: ExecutionStep[];
  /** Current step index (0-based). */
  currentStepIndex: number;
  /** When this execution was created (ISO timestamp). */
  createdAt: string;
  /** When this execution was last updated (ISO timestamp). */
  updatedAt: string;
  /** When this execution reached a terminal state (ISO timestamp). */
  completedAt?: string;
  /** Error message if failed. */
  error?: string;
  /** Safe metadata for observability. */
  metadata?: Record<string, unknown>;
  /** Action lifecycle state stored on the durable execution record. */
  actions?: WorkflowAction[];
}

/** Input for creating a new execution. */
export interface CreateExecutionInput {
  requestId: string;
  userId?: string;
  organizationId?: string;
  agentId: string;
  workflowType: string;
  /** Initial steps to execute in order. */
  steps: Array<{
    stepId: string;
    type: StepType;
    actionId: string;
    actionName: string;
    retryPolicy?: Partial<RetryPolicy>;
  }>;
  metadata?: Record<string, unknown>;
}

/** Query options for retrieving executions. */
export interface ExecutionQuery {
  /** Return at most this many newest executions. */
  limit?: number;
  /** Filter by status. */
  status?: ExecutionStatus;
  /** Inclusive ISO start boundary (for time-range scans). */
  from?: string;
  /** Inclusive ISO end boundary. */
  to?: string;
  /** Filter by agent ID. */
  agentId?: string;
  /** Filter by workflow type. */
  workflowType?: string;
  /** Filter by user ID (tenant isolation). */
  userId?: string;
  /** Filter by organization ID (tenant isolation). */
  organizationId?: string;
}

/** Result of a step execution attempt. */
export interface StepExecutionResult {
  /** Whether the step completed successfully. */
  success: boolean;
  /** Step status after this attempt. */
  status: StepStatus;
  /** Safe result metadata. */
  metadata?: Record<string, unknown>;
  /** Error message if failed. */
  error?: string;
  /** Approval ID if step requires approval. */
  approvalId?: string;
  /** Whether the step should be retried (transient failure). */
  shouldRetry: boolean;
}

/** Context for tool execution. */
export interface ToolExecutionContext {
  agentId: string;
  requestId: string;
  userId?: string;
  organizationId?: string;
  organizationRole?: import("@/lib/ai/auth/types").OrgRole;
  isAdmin?: boolean;
  signal?: AbortSignal;
  approved?: boolean;
}

/** Response from executing a step. */
export interface ExecuteStepResponse {
  success: boolean;
  status: StepStatus;
  metadata?: Record<string, unknown>;
  error?: string;
  approvalId?: string;
}

/** Type alias for backward compatibility. */
export type CreationInput = CreateExecutionInput;

/** Type alias for backward compatibility. */
export type DefaultToolRetryPolicy = RetryPolicy;

/** Store interface for execution persistence. */
export interface ExecutionStore {
  createExecution(input: CreateExecutionInput): Promise<Execution>;
  getExecution(executionId: string): Promise<Execution | null>;
  getExecutionByRequestId(requestId: string): Promise<Execution | null>;
  updateExecution(
    executionId: string,
    updates: Partial<Execution>
  ): Promise<Execution | null>;
  listExecutions(query?: ExecutionQuery): Promise<Execution[]>;
  deleteExecution(executionId: string): Promise<Execution | null>;
}