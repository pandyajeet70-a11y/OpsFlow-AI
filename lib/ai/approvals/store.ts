/**
 * lib/ai/approvals/store.ts
 *
 * Persistence contract for approval requests plus an in-memory implementation
 * used by offline tests.
 *
 * This module is intentionally dependency-free (no Firebase) so it can be
 * compiled and exercised by the offline test harness. The Firestore-backed
 * implementation lives in `./firestore-store.ts` and is server-only.
 */

import type { ActorContext } from "../auth/types";
import type {
  ApprovalAuditEntry,
  ApprovalAuditEvent,
  ApprovalRequest,
} from "./types";

/** Default time-to-live for a pending approval (24h). */
export const DEFAULT_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export interface CreateApprovalInput {
  requestId: string;
  userId?: string;
  /** Server-resolved organization the request belongs to. */
  organizationId?: string;
  agentId?: string;
  toolId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  expiresInMs?: number;
}

export type TransitionReason =
  | "ok"
  | "not_found"
  | "unauthorized"
  | "not_pending"
  | "expired";

export interface TransitionResult {
  ok: boolean;
  reason: TransitionReason;
  approval?: ApprovalRequest;
}

/**
 * Atomic, compare-and-swap style transitions are the mechanism that prevents
 * double approval / double execution: a document can only move out of `pending`
 * once, and `executed`/`failed` can only be written while still `approved`.
 */
export interface ApprovalStore {
  create(input: CreateApprovalInput): Promise<ApprovalRequest>;
  get(approvalId: string): Promise<ApprovalRequest | null>;
    transitionToApproved(
    approvalId: string,
    callerUserId: string | undefined,
    now: string,
    opts?: ActorContext
  ): Promise<TransitionResult>;
  transitionToRejected(
    approvalId: string,
    callerUserId: string | undefined,
    now: string,
    opts?: ActorContext
  ): Promise<TransitionResult>;
  transitionToExecuted(
    approvalId: string,
    result: unknown,
    now: string
  ): Promise<ApprovalRequest | null>;
  transitionToFailed(
    approvalId: string,
    error: string,
    now: string
  ): Promise<ApprovalRequest | null>;
}

/* ---------------------------------------------------------------
   Shared audit helpers
   --------------------------------------------------------------- */

export function buildAuditEntry(
  approval: Pick<
    ApprovalRequest,
    "approvalId" | "requestId" | "userId" | "organizationId" | "agentId" | "toolId"
  >,
  event: ApprovalAuditEvent,
  outcome: string,
  timestamp: string
): ApprovalAuditEntry {
  return {
    event,
    timestamp,
    requestId: approval.requestId,
    approvalId: approval.approvalId,
    userId: approval.userId,
    organizationId: approval.organizationId,
    agentId: approval.agentId,
    toolId: approval.toolId,
    outcome,
  };
}

/* ---------------------------------------------------------------
   Authorization helper: owner / global-admin / org-owner-or-admin
   --------------------------------------------------------------- */

/**
 * Decide whether an actor is allowed to transition (approve / reject) an
 * approval request. This is the single source of truth for ownership +
 * tenant isolation at the data layer.
 *
 * Rules:
 *  - The resource owner (doc.userId === actor's verified uid) may act.
 *  - A global admin (callerIsAdmin) may act on any resource.
 *  - An org owner/admin of the resource's organization may act on that org's
 *    requests (cross-owner within the same org).
 *  - Anyone else is denied (prevents cross-user and cross-org access).
 *
 * When the approval carries no `organizationId` (legacy records), the check
 * degrades to owner-vs-actor (or global admin) so existing behavior is
 * preserved.
 */
export function isAuthorizedActor(
  doc: Pick<ApprovalRequest, "userId" | "organizationId">,
  opts: ActorContext | undefined
): boolean {
  if (!opts) return false;
  if (doc.userId === opts.callerUserId) return true;
  if (opts.callerIsAdmin) return true;
  if (
    doc.organizationId &&
    opts.callerOrganizationId === doc.organizationId &&
    (opts.callerOrgRole === "owner" || opts.callerOrgRole === "admin")
  ) {
    return true;
  }
  return false;
}

/* ---------------------------------------------------------------
   In-memory store (offline tests / local development)
   --------------------------------------------------------------- */

/**
 * Tiny async mutex so concurrent transitions serialize and only the first
 * caller can move a document out of `pending` — mirroring the optimistic
 * concurrency of the Firestore implementation.
 */
class Mutex {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => fn());
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

export class InMemoryApprovalStore implements ApprovalStore {
  private readonly records = new Map<string, ApprovalRequest>();
  private seq = 0;
  private readonly mutex = new Mutex();

  async create(input: CreateApprovalInput): Promise<ApprovalRequest> {
    return this.mutex.run(async () => {
      this.seq += 1;
      const approvalId = `appr_test_${this.seq}`;
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(
        Date.now() + (input.expiresInMs ?? DEFAULT_APPROVAL_TTL_MS)
      ).toISOString();

            const doc: ApprovalRequest = {
        approvalId,
        requestId: input.requestId,
        userId: input.userId,
        organizationId: input.organizationId,
        agentId: input.agentId,
        toolId: input.toolId,
        toolName: input.toolName,
        arguments: input.arguments,
        status: "pending",
        createdAt,
        updatedAt: createdAt,
        expiresAt,
        audit: [
          buildAuditEntry(
            {
              approvalId,
              requestId: input.requestId,
              userId: input.userId,
              organizationId: input.organizationId,
              agentId: input.agentId,
              toolId: input.toolId,
            },
            "approval_created",
            "created",
            createdAt
          ),
        ],
      };

      this.records.set(approvalId, doc);
      return { ...doc };
    });
  }

  async get(approvalId: string): Promise<ApprovalRequest | null> {
    return this.mutex.run(async () => {
      const doc = this.records.get(approvalId);
      return doc ? { ...doc } : null;
    });
  }

      async transitionToApproved(
    approvalId: string,
    callerUserId: string | undefined,
    now: string,
    opts?: ActorContext
  ): Promise<TransitionResult> {
    return this.mutex.run(async () => {
      const doc = this.records.get(approvalId);
      if (!doc) return { ok: false, reason: "not_found" };

      if (!isAuthorizedActor(doc, { callerUserId, ...opts })) {
        return { ok: false, reason: "unauthorized", approval: { ...doc } };
      }
      if (doc.status !== "pending") {
        return { ok: false, reason: "not_pending", approval: { ...doc } };
      }
      if (Date.parse(doc.expiresAt) <= Date.parse(now)) {
        const updated = { ...doc, status: "expired" as const, updatedAt: now };
        this.records.set(approvalId, updated);
        return { ok: false, reason: "expired", approval: { ...updated } };
      }

      const entry = buildAuditEntry(doc, "approval_approved", "approved", now);
      const updated: ApprovalRequest = {
        ...doc,
        status: "approved",
        approvedAt: now,
        updatedAt: now,
        audit: [...doc.audit, entry],
      };
      this.records.set(approvalId, updated);
      return { ok: true, reason: "ok", approval: { ...updated } };
    });
  }

      async transitionToRejected(
    approvalId: string,
    callerUserId: string | undefined,
    now: string,
    opts?: ActorContext
  ): Promise<TransitionResult> {
    return this.mutex.run(async () => {
      const doc = this.records.get(approvalId);
      if (!doc) return { ok: false, reason: "not_found" };

      if (!isAuthorizedActor(doc, { callerUserId, ...opts })) {
        return { ok: false, reason: "unauthorized", approval: { ...doc } };
      }
      if (doc.status !== "pending") {
        return { ok: false, reason: "not_pending", approval: { ...doc } };
      }
      if (Date.parse(doc.expiresAt) <= Date.parse(now)) {
        const updated = { ...doc, status: "expired" as const, updatedAt: now };
        this.records.set(approvalId, updated);
        return { ok: false, reason: "expired", approval: { ...updated } };
      }

      const entry = buildAuditEntry(doc, "approval_rejected", "rejected", now);
      const updated: ApprovalRequest = {
        ...doc,
        status: "rejected",
        rejectedAt: now,
        updatedAt: now,
        audit: [...doc.audit, entry],
      };
      this.records.set(approvalId, updated);
      return { ok: true, reason: "ok", approval: { ...updated } };
    });
  }

  async transitionToExecuted(
    approvalId: string,
    result: unknown,
    now: string
  ): Promise<ApprovalRequest | null> {
    return this.mutex.run(async () => {
      const doc = this.records.get(approvalId);
      if (!doc || doc.status !== "approved") return doc ? { ...doc } : null;

      const entry = buildAuditEntry(doc, "tool_executed", "executed", now);
      const updated: ApprovalRequest = {
        ...doc,
        status: "executed",
        executedAt: now,
        updatedAt: now,
        executionResult: result,
        audit: [...doc.audit, entry],
      };
      this.records.set(approvalId, updated);
      return { ...updated };
    });
  }

  async transitionToFailed(
    approvalId: string,
    error: string,
    now: string
  ): Promise<ApprovalRequest | null> {
    return this.mutex.run(async () => {
      const doc = this.records.get(approvalId);
      if (!doc || doc.status !== "approved") return doc ? { ...doc } : null;

      const entry = buildAuditEntry(doc, "tool_failed", error, now);
      const updated: ApprovalRequest = {
        ...doc,
        status: "failed",
        executedAt: now,
        updatedAt: now,
        executionError: error,
        audit: [...doc.audit, entry],
      };
      this.records.set(approvalId, updated);
      return { ...updated };
    });
  }
}
