import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { approveWorkflowAction } from "@/lib/ai/executions/actions";
import { executeTool } from "@/lib/ai/tools/executor";
import { getTool } from "@/lib/ai/tools/registry";
import { isDevelopmentTestRouteAllowed } from "@/lib/ai/config/runtime";

export const runtime = "nodejs";

export async function POST() {
  if (!isDevelopmentTestRouteAllowed()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const taskTool = getTool("create_onboarding_task");
    if (!taskTool || taskTool.requiresApproval !== true) {
      throw new Error("create_onboarding_task is not registered for approval.");
    }

    const handoffResult = await executeTool({
      toolId: "create_customer_handoff",
      input: {
        customerName: "Action Test Customer",
        customerEmail: "action.test@example.com",
        company: "Action Test Company",
        dealSummary: "Testing the approval-gated onboarding action.",
        salesNotes: "Create the first onboarding task after approval.",
        plan: "Enterprise",
        owner: "Sales Agent",
      },
      context: { agentId: "sales", requestId: `action_test_${Date.now()}` },
    });
    if (!handoffResult.success) {
      throw new Error("Test handoff creation failed.");
    }

    const handoffId = (handoffResult.result as { handoffId?: unknown }).handoffId;
    if (typeof handoffId !== "string" || !handoffId) {
      throw new Error("Test handoff returned no ID.");
    }
    const eventId = (handoffResult.result as { eventId?: unknown }).eventId;
    if (typeof eventId !== "string" || !eventId) {
      throw new Error("Test handoff returned no event ID.");
    }

    const eventDocument = await adminDb.collection("workflowEvents").doc(eventId).get();
    const eventData = eventDocument.data();
    const planId = eventData?.planId;
    const executionId = eventData?.executionId;
    const approvalId = eventData?.approvalId;
    if (
      !eventDocument.exists ||
      eventData?.handlerStatus !== "awaiting_approval" ||
      typeof planId !== "string" ||
      typeof executionId !== "string" ||
      typeof approvalId !== "string"
    ) {
      throw new Error("Onboarding action did not reach approval.");
    }

    const action = await approveWorkflowAction({
      approvalId,
      executionId,
      actionId: "create_onboarding_task",
      callerUserId: "customer_success_agent",
    });
    if (action.status !== "completed") {
      throw new Error("Approved onboarding action did not complete.");
    }

    const taskQuery = await adminDb
      .collection("onboardingTasks")
      .where("handoffId", "==", handoffId)
      .limit(1)
      .get();
    if (taskQuery.empty) {
      throw new Error("Onboarding task was not persisted.");
    }

    const executionDocument = await adminDb.collection("executions").doc(executionId).get();
    if (!executionDocument.exists || executionDocument.data()?.status !== "completed") {
      throw new Error("Action execution was not persisted as completed.");
    }

    await adminDb.collection("workflowEvents").doc(eventId).set(
      { handlerStatus: "completed", actionStatus: action.status },
      { merge: true }
    );
    const auditQuery = await adminDb
      .collection("auditEvents")
      .where("requestId", "==", `event_${eventId}`)
      .limit(1)
      .get();
    if (auditQuery.empty) {
      throw new Error("Action audit record was not persisted.");
    }

    return NextResponse.json({
      success: true,
      actionCreated: true,
      approvalRequired: true,
      approved: true,
      executed: true,
      firestoreVerified: true,
      handoffId,
      eventId,
      executionId,
      approvalId,
      taskId: taskQuery.docs[0].id,
    });
  } catch (error) {
    console.error("[test-onboarding-action]", error);
    return NextResponse.json(
      { error: "Unable to complete the onboarding action test." },
      { status: 500 }
    );
  }
}
