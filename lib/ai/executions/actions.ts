import { approveApproval } from "@/lib/ai/approvals/service";
import { getDefaultApprovalStore } from "@/lib/ai/approvals/firestore-store";
import { getDefaultExecutionStore } from "./firestore-store";
import type {
  Execution,
  ToolExecutionContext,
  WorkflowAction,
  WorkflowActionStatus,
} from "./types";
import { executeTool } from "@/lib/ai/tools/executor";
import { getTool } from "@/lib/ai/tools/registry";
import { getDefaultAuditService } from "@/lib/ai/audit";

export interface CreateWorkflowActionInput {
  executionId: string;
  actionId: string;
  toolId: string;
  maxAttempts?: number;
}

export interface RunWorkflowActionInput extends CreateWorkflowActionInput {
  input: Record<string, unknown>;
  context: ToolExecutionContext;
}

function boundedAttempts(value: number | undefined): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(10, Math.max(1, Math.floor(value as number)));
}

function updateAction(
  execution: Execution,
  action: WorkflowAction
): { actions: WorkflowAction[] } {
  const actions = (execution.actions ?? []).filter(
    (candidate) => candidate.actionId !== action.actionId
  );
  actions.push(action);
  return { actions };
}

async function updateStep(
  execution: Execution,
  actionId: string,
  status: WorkflowActionStatus,
  attempt: number,
  extras: { approvalId?: string; error?: string } = {}
): Promise<void> {
  const store = getDefaultExecutionStore();
  const step = execution.steps.find((candidate) => candidate.actionId === actionId);
  if (!step) return;
  const stepStatus = status === "awaiting_approval" ? "waiting_for_approval" : status;
  await store.updateExecution(execution.executionId, {
    currentStepIndex: execution.steps.indexOf(step),
    steps: execution.steps.map((candidate) =>
      candidate.actionId === actionId
        ? {
            ...candidate,
            status: stepStatus,
            attempt,
            ...(extras.approvalId ? { approvalId: extras.approvalId } : {}),
            ...(extras.error ? { error: extras.error } : {}),
          }
        : candidate
    ),
  });
}

export async function createWorkflowAction(
  input: CreateWorkflowActionInput
): Promise<WorkflowAction> {
  const store = getDefaultExecutionStore();
  const execution = await store.getExecution(input.executionId);
  if (!execution) throw new Error("Execution was not found.");
  const action: WorkflowAction = {
    actionId: input.actionId,
    toolId: input.toolId,
    executionId: input.executionId,
    status: "pending",
    attempt: 0,
    maxAttempts: boundedAttempts(input.maxAttempts),
  };
  await store.updateExecution(execution.executionId, updateAction(execution, action));
  return action;
}

export async function runWorkflowAction(
  input: RunWorkflowActionInput
): Promise<WorkflowAction> {
  const store = getDefaultExecutionStore();
  const execution = await store.getExecution(input.executionId);
  if (!execution) throw new Error("Execution was not found.");
  const configured = execution.actions?.find(
    (candidate) => candidate.actionId === input.actionId
  );
  const action = configured ?? (await createWorkflowAction(input));
  const maxAttempts = boundedAttempts(input.maxAttempts ?? action.maxAttempts);
  let attempt = Math.max(1, action.attempt);

  while (attempt <= maxAttempts) {
    const running: WorkflowAction = {
      ...action,
      attempt,
      maxAttempts,
      status: "running",
    };
    await store.updateExecution(execution.executionId, updateAction(execution, running));
    await updateStep(execution, input.actionId, "running", attempt);

    const result = await executeTool({
      toolId: input.toolId,
      input: input.input,
      context: input.context,
    });
    if (result.status === "requires_approval") {
      const awaiting: WorkflowAction = {
        ...running,
        status: "awaiting_approval",
        approvalId: result.approvalId,
      };
      await store.updateExecution(execution.executionId, updateAction(execution, awaiting));
      await updateStep(execution, input.actionId, "awaiting_approval", attempt, {
        approvalId: result.approvalId,
      });
      await store.updateExecution(execution.executionId, { status: "waiting_for_approval" });
      return awaiting;
    }
    if (result.success) {
      const completed: WorkflowAction = { ...running, status: "completed" };
      await store.updateExecution(execution.executionId, updateAction(execution, completed));
      await updateStep(execution, input.actionId, "completed", attempt);
      return completed;
    }

    const lastError = "Workflow action execution failed.";
    if (attempt < maxAttempts) {
      const retrying: WorkflowAction = {
        ...running,
        status: "retrying",
        lastError,
      };
      await store.updateExecution(execution.executionId, updateAction(execution, retrying));
      await updateStep(execution, input.actionId, "retrying", attempt, { error: lastError });
      attempt += 1;
      continue;
    }

    const failed: WorkflowAction = { ...running, status: "failed", lastError };
    await store.updateExecution(execution.executionId, updateAction(execution, failed));
    await updateStep(execution, input.actionId, "failed", attempt, { error: lastError });
    await store.updateExecution(execution.executionId, {
      status: "failed",
      error: "Workflow action execution failed.",
    });
    return failed;
  }

  throw new Error("Workflow action exceeded its retry limit.");
}

export async function approveWorkflowAction(input: {
  approvalId: string;
  executionId: string;
  actionId: string;
  callerUserId: string;
}): Promise<WorkflowAction> {
  const store = getDefaultExecutionStore();
  const execution = await store.getExecution(input.executionId);
  if (!execution) throw new Error("Execution was not found.");
  const action = execution.actions?.find((candidate) => candidate.actionId === input.actionId);
  if (!action?.approvalId || action.approvalId !== input.approvalId) {
    throw new Error("Approval does not belong to this workflow action.");
  }
  const result = await approveApproval(
    {
      store: getDefaultApprovalStore(),
      resolveTool: getTool,
      audit: getDefaultAuditService(),
      execute: (request) => executeTool({
        toolId: request.toolId,
        input: request.input,
        context: { ...request.context, approved: true },
      }),
    },
    { approvalId: input.approvalId, callerUserId: input.callerUserId }
  );
  const status: WorkflowActionStatus = result.ok ? "completed" : "failed";
  const updated: WorkflowAction = {
    ...action,
    status,
    ...(result.ok ? {} : { lastError: "Approved workflow action failed." }),
  };
  await store.updateExecution(execution.executionId, updateAction(execution, updated));
  await updateStep(execution, input.actionId, status, action.attempt, {
    error: result.ok ? undefined : "Approved workflow action failed.",
  });
  if (result.ok) {
    await store.updateExecution(execution.executionId, {
      status: "completed",
      currentStepIndex: execution.steps.length,
      completedAt: new Date().toISOString(),
    });
  }
  return updated;
}

export async function syncWorkflowActionApprovalResult(input: {
  executionId: string;
  actionId: string;
  completed: boolean;
}): Promise<void> {
  const store = getDefaultExecutionStore();
  const execution = await store.getExecution(input.executionId);
  const action = execution?.actions?.find((candidate) => candidate.actionId === input.actionId);
  if (!execution || !action) return;
  const status: WorkflowActionStatus = input.completed ? "completed" : "failed";
  const updated: WorkflowAction = {
    ...action,
    status,
    ...(input.completed ? {} : { lastError: "Approved workflow action failed." }),
  };
  await store.updateExecution(execution.executionId, updateAction(execution, updated));
  await updateStep(execution, input.actionId, status, action.attempt, {
    error: input.completed ? undefined : "Approved workflow action failed.",
  });
  if (input.completed) {
    await store.updateExecution(execution.executionId, {
      status: "completed",
      currentStepIndex: execution.steps.length,
      completedAt: new Date().toISOString(),
    });
  }
}

export async function getWorkflowAction(executionId: string, actionId: string): Promise<WorkflowAction | null> {
  const execution = await getDefaultExecutionStore().getExecution(executionId);
  return execution?.actions?.find((action) => action.actionId === actionId) ?? null;
}

export async function retryWorkflowAction(input: {
  executionId: string;
  actionId: string;
}): Promise<WorkflowAction> {
  const store = getDefaultExecutionStore();
  const execution = await store.getExecution(input.executionId);
  const action = execution?.actions?.find((candidate) => candidate.actionId === input.actionId);
  if (!execution || !action) throw new Error("Workflow action was not found.");
  if (action.status !== "failed") throw new Error("Only failed actions can be retried.");
  if (action.attempt >= action.maxAttempts) throw new Error("Workflow action reached its maximum attempts.");

  const approval = action.approvalId
    ? await getDefaultApprovalStore().get(action.approvalId)
    : null;
  if (!approval) throw new Error("Retry input is unavailable for this action.");

  const retrying: WorkflowAction = {
    ...action,
    status: "retrying",
    attempt: action.attempt + 1,
  };
  await store.updateExecution(execution.executionId, updateAction(execution, retrying));
  return runWorkflowAction({
    executionId: execution.executionId,
    actionId: action.actionId,
    toolId: action.toolId,
    input: approval.arguments,
    context: {
      approved: true,
      agentId: approval.agentId ?? "customer_success",
      requestId: execution.requestId,
      userId: approval.userId,
      organizationId: approval.organizationId,
    },
    maxAttempts: action.maxAttempts,
  });
}
