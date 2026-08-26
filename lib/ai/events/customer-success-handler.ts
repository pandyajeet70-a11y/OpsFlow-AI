import { getAgent } from "@/lib/ai/agents/registry";
import {
  getDefaultAuditService,
  initDefaultAuditStore,
} from "@/lib/ai/audit";
import { setDefaultAuditService } from "@/lib/ai/audit/service";
import {
  getDefaultExecutionStore,
  initDefaultExecutionStore,
} from "@/lib/ai/executions/firestore-store";
import {
  createWorkflowAction,
  runWorkflowAction,
} from "@/lib/ai/executions/actions";
import { adminDb } from "@/lib/firebase-admin";
import { executeTool } from "@/lib/ai/tools/executor";
import type { CustomerHandoff, OnboardingPlan } from "@/lib/ai/onboarding/types";
import { registerEventHandler } from "./dispatcher";
import type { WorkflowEvent } from "./types";

initDefaultAuditStore();
setDefaultAuditService(undefined);
initDefaultExecutionStore();

async function handleCustomerHandoffCreated(
  event: WorkflowEvent<"customer.handoff.created">
): Promise<void> {
  const { handoffId } = event.payload;
  const requestId = `event_${event.eventId}`;
  const executionStore = getDefaultExecutionStore();
  const execution = await executionStore.createExecution({
    requestId,
    agentId: "customer_success",
    userId: "customer_success_agent",
    organizationId: event.payload.organizationId,
    workflowType: "customer_handoff_onboarding",
    steps: [
      {
        stepId: "get_customer_handoff",
        type: "tool",
        actionId: "get_customer_handoff",
        actionName: "Get Customer Handoff",
      },
      {
        stepId: "prepare_onboarding_plan",
        type: "agent_handoff",
        actionId: "customer_success",
        actionName: "Prepare Onboarding Plan",
      },
      {
        stepId: "create_onboarding_plan",
        type: "tool",
        actionId: "create_onboarding_plan",
        actionName: "Create Onboarding Plan",
      },
      {
        stepId: "create_onboarding_task",
        type: "tool",
        actionId: "create_onboarding_task",
        actionName: "Create Onboarding Task",
      },
    ],
    metadata: { eventId: event.eventId, handoffId },
  });

  try {
    const handoffResult = await executeTool({
      toolId: "get_customer_handoff",
      input: { handoffId },
      context: {
        agentId: "customer_success",
        requestId,
        userId: "customer_success_agent",
        organizationId: event.payload.organizationId,
      },
    });
    if (!handoffResult.success) {
      throw new Error("Customer handoff retrieval failed.");
    }

    const handoff = handoffResult.result as CustomerHandoff;
    const agentResponse = await getAgent("customer_success").execute({
      prompt: "Prepare the onboarding plan for this customer handoff.",
      context: JSON.stringify(handoff),
      requestId,
    });
    const onboardingPlan = agentResponse.metadata?.onboardingPlan as
      | OnboardingPlan
      | undefined;
    if (!onboardingPlan) {
      throw new Error("Customer Success Agent returned no onboarding plan.");
    }

    const planResult = await executeTool({
      toolId: "create_onboarding_plan",
      input: { handoffId, onboardingPlan },
      context: {
        agentId: "customer_success",
        requestId,
        userId: "customer_success_agent",
        organizationId: event.payload.organizationId,
      },
    });
    if (!planResult.success) {
      throw new Error("Onboarding plan creation failed.");
    }

    const planId = (planResult.result as { planId?: unknown }).planId;
    if (typeof planId !== "string" || !planId) {
      throw new Error("Onboarding plan returned no ID.");
    }

    const firstAction = onboardingPlan.nextActions[0];
    if (!firstAction) {
      throw new Error("Onboarding plan contains no next action.");
    }
    await createWorkflowAction({
      executionId: execution.executionId,
      actionId: "create_onboarding_task",
      toolId: "create_onboarding_task",
      maxAttempts: 3,
    });
    const action = await runWorkflowAction({
      executionId: execution.executionId,
      actionId: "create_onboarding_task",
      toolId: "create_onboarding_task",
      input: {
        handoffId,
        onboardingPlanId: planId,
        title: firstAction.title,
        description: firstAction.description,
        priority: firstAction.priority,
      },
      context: {
        agentId: "customer_success",
        requestId,
        userId: "customer_success_agent",
        organizationId: event.payload.organizationId,
      },
      maxAttempts: 3,
    });
    if (action.status === "awaiting_approval") {
      await adminDb.collection("workflowEvents").doc(event.eventId).set(
        {
          handlerStatus: "awaiting_approval",
          executionId: execution.executionId,
          planId,
          actionId: action.actionId,
          approvalId: action.approvalId,
        },
        { merge: true }
      );
      await getDefaultAuditService().fire("workflow_handler_awaiting_approval", {
        eventType: "workflow_handler_awaiting_approval",
        requestId,
        agentId: "customer_success",
        success: true,
        status: "awaiting_approval",
        metadata: { eventId: event.eventId, handoffId, planId, approvalId: action.approvalId },
      });
      return;
    }
    if (action.status !== "completed") {
      throw new Error("Onboarding task action failed.");
    }

    await executionStore.updateExecution(execution.executionId, {
      status: "completed",
      currentStepIndex: execution.steps.length,
      completedAt: new Date().toISOString(),
      metadata: { eventId: event.eventId, handoffId, planId },
      steps: execution.steps.map((step) => ({
        ...step,
        status: "completed",
        completedAt: new Date().toISOString(),
        metadata: { status: "completed" },
      })),
    });

    await adminDb.collection("workflowEvents").doc(event.eventId).set(
      {
        handlerStatus: "completed",
        executionId: execution.executionId,
        planId,
      },
      { merge: true }
    );

    await getDefaultAuditService().fire("workflow_handler_completed", {
      eventType: "workflow_handler_completed",
      requestId,
      agentId: "customer_success",
      success: true,
      status: "completed",
      metadata: { eventId: event.eventId, handoffId, planId },
    });
  } catch (error) {
    console.error("[customer-success-handler]", error);
    await executionStore.updateExecution(execution.executionId, {
      status: "failed",
      error: "Customer Success handoff processing failed.",
    });
    await adminDb.collection("workflowEvents").doc(event.eventId).set(
      { handlerStatus: "failed", executionId: execution.executionId },
      { merge: true }
    );
    await getDefaultAuditService().fire("workflow_handler_failed", {
      eventType: "workflow_handler_failed",
      requestId,
      agentId: "customer_success",
      success: false,
      status: "failed",
      metadata: { eventId: event.eventId, handoffId },
    });
    throw error;
  }
}

registerEventHandler("customer.handoff.created", handleCustomerHandoffCreated);
