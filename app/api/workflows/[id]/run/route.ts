import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  authorizationErrorResponse,
  isAuthorizationError,
  requirePermission,
} from "@/lib/ai/auth/authorization-server";
import { getDefaultExecutionStore } from "@/lib/ai/executions/firestore-store";
import { runWorkflowAction } from "@/lib/ai/executions/actions";
import { validateWorkflowActions } from "@/lib/ai/workflows/validation";

export const runtime = "nodejs";

async function getOwnedWorkflow(request: NextRequest, workflowId: string) {
  const context = await requirePermission(request, "manage_workflows");
  const reference = adminDb.collection("workflows").doc(workflowId);
  const snapshot = await reference.get();
  if (!snapshot.exists || snapshot.data()?.organizationId !== context.organizationId) {
    return null;
  }
  return { context, workflow: snapshot.data() as Record<string, unknown> };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workflowId = (await params).id;
    const owned = await getOwnedWorkflow(request, workflowId);
    if (!owned) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }
    const { context, workflow } = owned;
    const actionValidation = validateWorkflowActions(workflow.actions);
    if (actionValidation.error) return NextResponse.json({ error: actionValidation.error }, { status: 400 });
    const normalized = actionValidation.actions;

    const executionStore = getDefaultExecutionStore();
    const execution = await executionStore.createExecution({
      requestId: `workflow_run_${workflowId}_${Date.now()}`,
      userId: context.userId,
      organizationId: context.organizationId,
      agentId: "workflow_runner",
      workflowType: "manual_workflow",
      steps: normalized.map((action, index) => ({
        stepId: `step_${index + 1}_${action.toolId}`,
        type: "tool",
        actionId: action.toolId,
        actionName: action.toolId,
      })),
      metadata: { workflowId, workflowName: typeof workflow.name === "string" ? workflow.name : "Workflow" },
    });

    await adminDb.collection("workflowExecutions").doc(execution.executionId).set({
      id: execution.executionId,
      workflowId,
      workflowName: typeof workflow.name === "string" ? workflow.name : "Workflow",
      userId: context.userId,
      organizationId: context.organizationId,
      status: "running",
      startedAt: new Date().toISOString(),
      totalActions: normalized.length,
      completedActions: 0,
      currentAction: normalized[0]?.toolId ?? null,
      createdAt: new Date().toISOString(),
    });

    let completedActions = 0;
    let lastAction: string | null = null;

    for (const [index, action] of normalized.entries()) {
      lastAction = action.toolId;
      const workflowAction = await runWorkflowAction({
        executionId: execution.executionId,
        actionId: `action_${index + 1}_${action.toolId}`,
        toolId: action.toolId,
        input: action.input,
        context: {
          agentId: "workflow_runner",
          requestId: execution.requestId,
          userId: context.userId,
          organizationId: context.organizationId,
          organizationRole: context.role,
          isAdmin: context.user.admin === true,
        },
      });

      if (workflowAction.status === "awaiting_approval") {
        await adminDb.collection("workflowExecutions").doc(execution.executionId).set(
          {
            status: "waiting_for_approval",
            currentAction: action.toolId,
            completedActions,
            approvalId: workflowAction.approvalId ?? null,
          },
          { merge: true }
        );
        return NextResponse.json(
          {
            data: {
              workflowId,
              executionId: execution.executionId,
              status: "waiting_for_approval",
              approvalId: workflowAction.approvalId,
            },
          },
          { status: 202 }
        );
      }

      if (workflowAction.status === "failed") {
        await executionStore.updateExecution(execution.executionId, {
          status: "failed",
          error: workflowAction.lastError ?? `Workflow action failed: ${action.toolId}`,
        });
        await adminDb.collection("workflowExecutions").doc(execution.executionId).set(
          {
            status: "failed",
            errorMessage: workflowAction.lastError ?? `Workflow action failed: ${action.toolId}`,
            completedAt: new Date().toISOString(),
            completedActions,
            currentAction: lastAction,
          },
          { merge: true }
        );
        return NextResponse.json(
          { error: workflowAction.lastError ?? `Workflow action failed: ${action.toolId}` },
          { status: 500 }
        );
      }

      completedActions += 1;
      await adminDb.collection("workflowExecutions").doc(execution.executionId).set(
        {
          completedActions,
          currentAction: normalized[completedActions]?.toolId ?? null,
          status: completedActions === normalized.length ? "completed" : "running",
          ...(completedActions === normalized.length ? { completedAt: new Date().toISOString() } : {}),
        },
        { merge: true }
      );
    }

    await executionStore.updateExecution(execution.executionId, {
      status: "completed",
      currentStepIndex: Math.max(0, normalized.length - 1),
      completedAt: new Date().toISOString(),
    });

    await adminDb.collection("workflowExecutions").doc(execution.executionId).set(
      {
        status: "completed",
        currentAction: null,
        completedActions: normalized.length,
        completedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      data: {
        workflowId,
        executionId: execution.executionId,
        status: "completed",
      },
    });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflows/:id/run] failed", error);
    return NextResponse.json({ error: "Unable to run workflow." }, { status: 500 });
  }
}
