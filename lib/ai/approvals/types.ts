/**
 * lib/ai/approvals/types.ts
 *
 * Typed domain model for OpsFlow's persisted approval workflow.
 *
 * An ApprovalRequest is created server-side whenever a tool requires approval.
 * It carries the full context needed to audit and safely execute the action
 * later: who/what/when, the exact server-stored arguments, lifecycle timestamps,
 * and an append-only audit trail.
 */

/** Lifecycle of an approval request. */
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "expired";

/** Events recorded in the append-only audit trail. */
export type ApprovalAuditEvent =
  | "approval_created"
  | "approval_approved"
  | "approval_rejected"
  | "tool_executed"
  | "tool_failed";

export interface ApprovalAuditEntry {
  event: ApprovalAuditEvent;
  /** ISO timestamp. */
  timestamp: string;
  requestId?: string;
  approvalId?: string;
  /** Verified server identity of the actor (never client-supplied). */
  userId?: string;
  /** Organization the actor operated under (server-resolved). */
  organizationId?: string;
  agentId?: string;
  toolId?: string;
  /** Human-readable outcome summary for this event. */
  outcome: string;
}

export interface ApprovalRequest {
  approvalId: string;
  requestId: string;
  /** Verified Firebase UID of the user who created the request. */
  userId?: string;
  organizationId?: string;
  agentId?: string;
  toolId: string;
  toolName: string;
  /** The exact server-side arguments captured at decision time. Never trusted
   *  from the client; used verbatim when the action is executed. */
  arguments: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  executedAt?: string;
  rejectedAt?: string;
  expiresAt: string;
  executionResult?: unknown;
  executionError?: string;
  audit: ApprovalAuditEntry[];
}