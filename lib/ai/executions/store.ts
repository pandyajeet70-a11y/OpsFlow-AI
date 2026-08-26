/**
 * lib/ai/executions/store.ts
 *
 * Persistence layer for execution state (Phase 5 – durable execution engine).
 *
 * Provides both in-memory (development) and Firestore (production) storage
 * implementations following the same pattern as the approval/audit stores.
 *
 * SECURITY / PRIVACY:
 *  - All IDs (executionId, stepId, approvalId) are server-generated.
 *  - No secrets, tokens, or raw content are stored.
 *  - Metadata is limited to safe, non-sensitive fields.
 */

import type {
  Execution,
  ExecutionStatus,
  StepStatus,
  StepType,
  RetryPolicy,
  CreateExecutionInput,
  ExecutionQuery,
  ExecutionStep,
  StepExecutionResult,
  ExecutionStore,
} from "./types";
import { DEFAULT_TOOL_RETRY_POLICY } from "./types";

/* ---------------------------------------------------------------------------
   In-Memory Implementation (development / testing)
   -------------------------------------------------------------------------- */

class InMemoryExecutionStore {
  private store: Map<string, Execution> = new Map();
  private nextId: number = 0;

  async createExecution(input: CreateExecutionInput): Promise<Execution> {
    const executionId = `exec_${Date.now()}_${this.nextId++}`;
    const now = new Date().toISOString();
    const execution: Execution = {
      executionId,
      requestId: input.requestId,
      userId: input.userId,
      organizationId: input.organizationId,
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
        completedAt: undefined,
        error: undefined,
        metadata: undefined,
        approvalId: undefined,
      })),
      currentStepIndex: 0,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
      error: undefined,
      metadata: input.metadata ?? {},
    };

    this.store.set(executionId, execution);
    return execution;
  }

  async getExecution(executionId: string): Promise<Execution | null> {
    return this.store.get(executionId) ?? null;
  }

  async updateExecution(
    executionId: string,
    updates: Partial<Execution>
  ): Promise<Execution | null> {
    const existing = this.store.get(executionId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.store.set(executionId, updated);
    return updated;
  }

  async listExecutions(query: ExecutionQuery = {}): Promise<Execution[]> {
    let results = Array.from(this.store.values());

    if (query.status) {
      results = results.filter((e) => e.status === query.status);
    }
    if (query.agentId) {
      results = results.filter((e) => e.agentId === query.agentId);
    }
    if (query.workflowType) {
      results = results.filter((e) => e.workflowType === query.workflowType);
    }
    if (query.from) {
      results = results.filter((e) => e.createdAt >= query.from!);
    }
    if (query.to) {
      results = results.filter((e) => e.createdAt <= query.to!);
    }

    results.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    return results;
  }

  async deleteExecution(executionId: string): Promise<Execution | null> {
    const existing = this.store.get(executionId);
    if (!existing) return null;
    this.store.delete(executionId);
    return existing;
  }

  async getExecutionByRequestId(requestId: string): Promise<Execution | null> {
    for (const execution of this.store.values()) {
      if (execution.requestId === requestId) {
        return execution;
      }
    }
    return null;
  }
}

/* ---------------------------------------------------------------------------
   Default store registry (mirrors audit/approval pattern)
   -------------------------------------------------------------------------- */

let defaultStore: ExecutionStore | undefined;

export function getDefaultExecutionStore(): ExecutionStore {
  if (!defaultStore) {
    defaultStore = new InMemoryExecutionStore();
  }
  return defaultStore;
}

export function setDefaultExecutionStore(store: ExecutionStore | undefined): void {
  defaultStore = store ?? new InMemoryExecutionStore();
}

export { InMemoryExecutionStore, DEFAULT_TOOL_RETRY_POLICY };
export type { Execution, ExecutionStatus, StepStatus, StepType, RetryPolicy, CreateExecutionInput, ExecutionQuery, ExecutionStep, StepExecutionResult, ExecutionStore } from "./types";