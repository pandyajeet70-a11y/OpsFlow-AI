import { NextResponse } from "next/server";
import { getDefaultAuditService, initDefaultAuditStore } from "@/lib/ai/audit";
import { createWorkflowAction, runWorkflowAction, approveWorkflowAction } from "@/lib/ai/executions/actions";
import { getDefaultExecutionStore, initDefaultExecutionStore } from "@/lib/ai/executions/firestore-store";
import { adminDb } from "@/lib/firebase-admin";
import { getTool } from "@/lib/ai/tools/registry";
import { isDevelopmentTestRouteAllowed } from "@/lib/ai/config/runtime";

export const runtime = "nodejs";
initDefaultAuditStore();
initDefaultExecutionStore();

export async function POST() {
  if (!isDevelopmentTestRouteAllowed()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    if (!getTool("send_email")?.requiresApproval) throw new Error("send_email is not approval-gated.");
    const requestId = `integration_test_${Date.now()}`;
    const execution = await getDefaultExecutionStore().createExecution({
      requestId,
      userId: "integration_test_user",
      organizationId: "integration_test_org",
      agentId: "customer_success",
      workflowType: "integration_test",
      steps: [{ stepId: "send_email", type: "tool", actionId: "send_email", actionName: "Send Email" }],
    });
    await createWorkflowAction({ executionId: execution.executionId, actionId: "send_email", toolId: "send_email", maxAttempts: 2 });
    const waiting = await runWorkflowAction({ executionId: execution.executionId, actionId: "send_email", toolId: "send_email", input: { to: "integration@example.com", subject: "OpsFlow test", text: "Development delivery" }, context: { agentId: "customer_success", requestId, userId: "integration_test_user", organizationId: "integration_test_org" }, maxAttempts: 2 });
    if (waiting.status !== "awaiting_approval" || !waiting.approvalId) throw new Error("Integration action did not await approval.");
    const completed = await approveWorkflowAction({ approvalId: waiting.approvalId, executionId: execution.executionId, actionId: "send_email", callerUserId: "integration_test_user" });
    const finalExecution = await getDefaultExecutionStore().getExecution(execution.executionId);
    const delivery = await adminDb.collection("integrationDeliveries").where("organizationId", "==", "integration_test_org").where("provider", "==", "email").limit(1).get();
    const audit = await adminDb.collection("auditEvents").where("requestId", "==", requestId).limit(1).get();
    if (completed.status !== "completed" || finalExecution?.status !== "completed" || delivery.empty || audit.empty) throw new Error("Integration persistence verification failed.");
    return NextResponse.json({ success: true, authorizationReached: true, approvalRequired: true, executed: true, provider: "mock-email", executionVerified: true, auditVerified: true, executionId: execution.executionId, deliveryId: delivery.docs[0].id });
  } catch (error) {
    console.error("[test-integration]", error);
    return NextResponse.json({ error: "Unable to complete integration test." }, { status: 500 });
  }
}
