/**
 * lib/ai/audit/types.ts
 *
 * Server-side audit event contract for Phase 4 (Persistent Audit Trail &
 * Security Observability).
 *
 * SECURITY / PRIVACY GUARANTEES enforced by every producer in this module:
 *  - userId  is ALWAYS a server-verified Firebase UID (never client-supplied).
 *  - organizationId is ALWAYS resolved server-side from membership (never from
 *    the request body, a header, or model output).
 *  - metadata NEVER contains secrets: no Firebase keys, API keys, access
 *    tokens, passwords, authorization headers, raw env vars, or full prompt /
 *    tool-argument / model-result content. Producers store safe metadata such
 *    as lengths, ids, and status codes, and redacted summaries when relevant.
 *
 * This module is intentionally dependency-free (no Firebase) so it can be
 * compiled and unit-tested offline.
 */

/** The full set of auditable lifecycle events. */
export type AuditEventType =
  | "ai_request_received"
  | "ai_request_completed"
  | "ai_request_failed"
  | "tool_decision"
  | "tool_execution_started"
  | "tool_executed"
  | "tool_failed"
  | "approval_created"
  | "approval_approved"
  | "approval_rejected"
  | "approval_expired"
  | "workflow_handler_completed"
  | "workflow_handler_failed"
  | "workflow_handler_awaiting_approval"
  | "authorization_denied";

/**
 * A single persisted audit event.
 *
 * Records are append-only by design: the store exposes no update/delete
 * surface, so concurrent or malicious actors cannot retroactively alter the
 * audit trail.
 */
export interface AuditEvent {
  /** Globally unique event id (server-minted). */
  eventId: string;
  eventType: AuditEventType;
  /** ISO-8601 timestamp (server-minted). */
  timestamp: string;
  /** Correlation id threaded from the public API through the whole call. */
  requestId?: string;
  /** Server-verified Firebase UID. Never client-controlled. */
  userId?: string;
  /** Server-resolved tenant id. Never client-controlled. */
  organizationId?: string;
  /** Agent that handled (or attempted) the request. */
  agentId?: string;
  /** Tool involved (decision/execution/approval). */
  toolId?: string;
  /** Approval involved in an approval lifecycle event. */
  approvalId?: string;
  /** outcome flag — true on success, false on failure/denial. */
  success: boolean;
  /** Optional machine-readable status/reason. */
  status?: string;
  /** Safe metadata only (no secrets, no raw prompt/args/result content). */
  metadata?: Record<string, unknown>;
}

/** Query options for retrieving audit events (future admin/observability). */
export interface AuditQuery {
  /** Return at most this many newest events. */
  limit?: number;
  /** Filter to a single event type. */
  eventType?: AuditEventType;
  /** Inclusive ISO start boundary (for time-range scans). */
  from?: string;
  /** Inclusive ISO end boundary. */
  to?: string;
}