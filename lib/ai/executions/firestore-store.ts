/**
 * lib/ai/executions/firestore-store.ts
 *
 * Firestore-backed ExecutionStore (server-only, Admin SDK).
 *
 * Security posture:
 *  - Writes happen ONLY through the Admin SDK (privileged service account).
 *    There is NO client write path to this collection — Firestore rules must
 *    deny direct client reads/writes to `executions`.
 *  - Reads are tenant-scoped: `listExecutions` filters on the
 *    `organizationId` field; a caller can never query another org's records
 *    through this store.
 *  - No secrets are ever stored — the producer layer guarantees metadata is
 *    safe (lengths, ids, statuses), never raw prompts/args/results/tokens.
 */

import { adminDb } from "@/lib/firebase-admin";
import type {
  Execution,
  CreateExecutionInput,
  ExecutionQuery,
  ExecutionStore,
  ExecutionStatus,
} from "./types";
import { DEFAULT_TOOL_RETRY_POLICY } from "./types";

export const EXECUTIONS_COLLECTION = "executions";

export class FirestoreExecutionStore implements ExecutionStore {
  private col() {
    return adminDb.collection(EXECUTIONS_COLLECTION);
  }

  private docRef(executionId: string) {
    return this.col().doc(executionId);
  }

  async createExecution(input: CreateExecutionInput): Promise<Execution> {
    const executionId = `exec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const execution: Execution = {
      executionId,
      requestId: input.requestId,
      agentId: input.agentId,
      workflowType: input.workflowType,
      steps: input.steps.map((s, idx) => ({
        stepId: `step_${idx + 1}_${s.stepId}`,
        executionId,
        type: s.type,
        actionId: s.actionId,
        actionName: s.actionName,
        status: "pending",
        attempt: 1,
        retryPolicy: { ...DEFAULT_TOOL_RETRY_POLICY, ...s.retryPolicy },
        startedAt: now,
      })),
      currentStepIndex: 0,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata ?? {},
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    };

    await this.docRef(executionId).set(execution);
    return execution;
  }

  async getExecution(executionId: string): Promise<Execution | null> {
    const snap = await this.docRef(executionId).get();
    if (!snap.exists) return null;
    return snap.data() as Execution;
  }

  async getExecutionByRequestId(requestId: string): Promise<Execution | null> {
    const snap = await this.col().where("requestId", "==", requestId).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as Execution);
  }

  async updateExecution(
    executionId: string,
    updates: Partial<Execution>
  ): Promise<Execution | null> {
    const ref = this.docRef(executionId);
    const snap = await ref.get();
    if (!snap.exists) return null;

    const existing = snap.data() as Execution;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

    // If status is terminal, set completedAt
    const terminalStatuses: ExecutionStatus[] = ["completed", "failed", "cancelled"];
    if (updated.status && terminalStatuses.includes(updated.status) && !existing.completedAt) {
      updated.completedAt = new Date().toISOString();
    }

    await ref.set(updated, { merge: true });
    return updated;
  }

  async listExecutions(query: ExecutionQuery = {}): Promise<Execution[]> {
    let ref: FirebaseFirestore.Query = this.col();

    // Tenant isolation: filter by organizationId
    if (query.organizationId) {
      ref = ref.where("organizationId", "==", query.organizationId);
    }

    if (query.status) {
      ref = ref.where("status", "==", query.status);
    }
    if (query.agentId) {
      ref = ref.where("agentId", "==", query.agentId);
    }
    if (query.workflowType) {
      ref = ref.where("workflowType", "==", query.workflowType);
    }
    if (query.from) {
      ref = ref.where("createdAt", ">=", query.from);
    }
    if (query.to) {
      ref = ref.where("createdAt", "<=", query.to);
    }

    ref = ref.orderBy("createdAt", "desc");
    if (query.limit) {
      ref = ref.limit(query.limit);
    }

    const snap = await ref.get();
    return snap.docs.map((d) => d.data() as Execution);
  }

  async deleteExecution(executionId: string): Promise<Execution | null> {
    const existing = await this.getExecution(executionId);
    if (!existing) return null;
    await this.docRef(executionId).delete();
    return existing;
  }
}

let defaultStore: ExecutionStore | undefined;

export function getDefaultExecutionStore(): ExecutionStore {
  if (!defaultStore) {
    defaultStore = new FirestoreExecutionStore();
  }
  return defaultStore;
}

export function setDefaultExecutionStore(store: ExecutionStore | undefined): void {
  defaultStore = store ?? new FirestoreExecutionStore();
}

export function initDefaultExecutionStore(): void {
  setDefaultExecutionStore(new FirestoreExecutionStore());
}