/**
 * lib/ai/approvals/firestore-store.ts
 *
 * Firestore-backed ApprovalStore.
 *
 * Server-only. Reads Firebase Admin credentials from the server environment
 * and uses Firestore transactions for atomic, compare-and-swap transitions so
 * an approval can only be claimed (approved) once and can only be executed
 * while still in the `approved` state — preventing double execution.
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { ActorContext } from "../auth/types";
import type { ApprovalRequest } from "./types";
import {
  buildAuditEntry,
  DEFAULT_APPROVAL_TTL_MS,
  isAuthorizedActor,
  type ApprovalStore,
  type CreateApprovalInput,
  type TransitionResult,
} from "./store";

export const APPROVALS_COLLECTION = "approvals";

export class FirestoreApprovalStore implements ApprovalStore {
  private col() {
    return adminDb.collection(APPROVALS_COLLECTION);
  }

  private docRef(approvalId: string) {
    return this.col().doc(approvalId);
  }

  async create(input: CreateApprovalInput): Promise<ApprovalRequest> {
    const ref = this.col().doc();
    const approvalId = ref.id;
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

    await ref.set(doc);
    return doc;
  }

  async get(approvalId: string): Promise<ApprovalRequest | null> {
    const snap = await this.docRef(approvalId).get();
    if (!snap.exists) return null;
    return snap.data() as ApprovalRequest;
  }

      async transitionToApproved(
    approvalId: string,
    callerUserId: string | undefined,
    now: string,
    opts?: ActorContext
  ): Promise<TransitionResult> {
    const ref = this.docRef(approvalId);
    return adminDb.runTransaction<TransitionResult>(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, reason: "not_found" };

      const doc = snap.data() as ApprovalRequest;

      // Ownership + tenant isolation: never trust the caller's claimed identity
      // over the persisted record. Honors owner / global-admin / org-owner.
      if (!isAuthorizedActor(doc, { callerUserId, ...opts })) {
        return { ok: false, reason: "unauthorized", approval: doc };
      }
      if (doc.status !== "pending") {
        return { ok: false, reason: "not_pending", approval: doc };
      }
      if (Date.parse(doc.expiresAt) <= Date.parse(now)) {
        tx.update(ref, { status: "expired", updatedAt: now });
        return {
          ok: false,
          reason: "expired",
          approval: { ...doc, status: "expired", updatedAt: now },
        };
      }

      const entry = buildAuditEntry(doc, "approval_approved", "approved", now);
      tx.update(ref, {
        status: "approved",
        approvedAt: now,
        updatedAt: now,
        audit: FieldValue.arrayUnion(entry),
      });
      return {
        ok: true,
        reason: "ok",
        approval: {
          ...doc,
          status: "approved",
          approvedAt: now,
          updatedAt: now,
          audit: [...doc.audit, entry],
        },
      };
    });
  }

      async transitionToRejected(
    approvalId: string,
    callerUserId: string | undefined,
    now: string,
    opts?: ActorContext
  ): Promise<TransitionResult> {
    const ref = this.docRef(approvalId);
    return adminDb.runTransaction<TransitionResult>(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, reason: "not_found" };

      const doc = snap.data() as ApprovalRequest;
      if (!isAuthorizedActor(doc, { callerUserId, ...opts })) {
        return { ok: false, reason: "unauthorized", approval: doc };
      }
      if (doc.status !== "pending") {
        return { ok: false, reason: "not_pending", approval: doc };
      }
      if (Date.parse(doc.expiresAt) <= Date.parse(now)) {
        tx.update(ref, { status: "expired", updatedAt: now });
        return {
          ok: false,
          reason: "expired",
          approval: { ...doc, status: "expired", updatedAt: now },
        };
      }

      const entry = buildAuditEntry(doc, "approval_rejected", "rejected", now);
      tx.update(ref, {
        status: "rejected",
        rejectedAt: now,
        updatedAt: now,
        audit: FieldValue.arrayUnion(entry),
      });
      return {
        ok: true,
        reason: "ok",
        approval: {
          ...doc,
          status: "rejected",
          rejectedAt: now,
          updatedAt: now,
          audit: [...doc.audit, entry],
        },
      };
    });
  }

  async transitionToExecuted(
    approvalId: string,
    result: unknown,
    now: string
  ): Promise<ApprovalRequest | null> {
    const ref = this.docRef(approvalId);
    return adminDb.runTransaction<ApprovalRequest | null>(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const doc = snap.data() as ApprovalRequest;
      if (doc.status !== "approved") return doc;

      const entry = buildAuditEntry(doc, "tool_executed", "executed", now);
      tx.update(ref, {
        status: "executed",
        executedAt: now,
        updatedAt: now,
        executionResult: result,
        audit: FieldValue.arrayUnion(entry),
      });
      return {
        ...doc,
        status: "executed",
        executedAt: now,
        updatedAt: now,
        executionResult: result,
        audit: [...doc.audit, entry],
      };
    });
  }

  async transitionToFailed(
    approvalId: string,
    error: string,
    now: string
  ): Promise<ApprovalRequest | null> {
    const ref = this.docRef(approvalId);
    return adminDb.runTransaction<ApprovalRequest | null>(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const doc = snap.data() as ApprovalRequest;
      if (doc.status !== "approved") return doc;

      const entry = buildAuditEntry(doc, "tool_failed", error, now);
      tx.update(ref, {
        status: "failed",
        executedAt: now,
        updatedAt: now,
        executionError: error,
        audit: FieldValue.arrayUnion(entry),
      });
      return {
        ...doc,
        status: "failed",
        executedAt: now,
        updatedAt: now,
        executionError: error,
        audit: [...doc.audit, entry],
      };
    });
  }
}

let defaultStore: ApprovalStore | undefined;

export function getDefaultApprovalStore(): ApprovalStore {
  if (!defaultStore) {
    defaultStore = new FirestoreApprovalStore();
  }
  return defaultStore;
}

export function setDefaultApprovalStore(store: ApprovalStore): void {
  defaultStore = store;
}
