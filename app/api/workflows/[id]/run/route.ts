import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  authorizationErrorResponse,
  isAuthorizationError,
  requirePermission,
} from "@/lib/ai/auth/authorization-server";
import { getDefaultExecutionStore } from "@/lib/ai/executions/firestore-store";
import { executeTool } from "@/lib/ai/tools/executor";
import { resolveToolId } from "@/lib/ai/tools/registry";

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

function normalizeWorkflowAction(action: unknown): { toolId: string; input: Record<string, unknown> } | null {
  if (typeof action === "string" && action.trim()) {
    const toolId = resolveToolId(action);
    if (!toolId) return null;
    return { toolId, input: {} };
  }
  if (action && typeof action === "object") {
    const candidate = action as Record<string, unknown>;
    const rawToolId =
      typeof candidate.toolId === "string"
        ? candidate.toolId
        : typeof candidate.id === "string"
          ? candidate.id
          : typeof candidate.name === "string"
            ? candidate.name
            : null;
    const toolId = rawToolId ? resolveToolId(rawToolId) : null;
    if (!toolId) return null;
    const type = typeof candidate.type === "string" ? candidate.type : "";
    if (type === "webhook") {
      const url = typeof candidate.url === "string" ? candidate.url : "";
      if (!url) return null;
      return {
        toolId: resolveToolId("send_webhook") ?? "send_webhook",
        input: {
          url,
          method: candidate.method === "GET" || candidate.method === "POST" ? candidate.method : "POST",
          payload: candidate.body ?? {},
        },
      };
    }
    return { toolId, input: (candidate.input as Record<string, unknown>) ?? {} };
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workflowId = (await params).id;
    const owned = await getOwnedWorkflow(request, workflowId);
    if (!owned) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }
    const { context, workflow } = owned;
    const actions = Array.isArray(workflow.actions) ? workflow.actions : [];
    const normalized = actions
      .map((action) => normalizeWorkflowAction(action))
      .filter((action): action is { toolId: string; input: Record<string, unknown> } => Boolean(action));

    if (!normalized.length) {
      return NextResponse.json({ error: "Workflow has no executable actions." }, { status: 400 });
    }

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

    for (const action of normalized) {
      lastAction = action.toolId;
      const result = await executeTool({
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

      if (!result.success) {
        await executionStore.updateExecution(execution.executionId, {
          status: "failed",
          error: result.error ?? `Workflow action failed: ${action.toolId}`,
        });
        await adminDb.collection("workflowExecutions").doc(execution.executionId).set(
          {
            status: "failed",
            errorMessage: result.error ?? `Workflow action failed: ${action.toolId}`,
            completedAt: new Date().toISOString(),
            completedActions,
            currentAction: lastAction,
          },
          { merge: true }
        );
        return NextResponse.json(
          { error: result.error ?? `Workflow action failed: ${action.toolId}` },
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
