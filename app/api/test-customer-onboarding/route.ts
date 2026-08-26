import { NextResponse } from "next/server";
import { getAgent } from "@/lib/ai/agents/registry";
import {
  getDefaultAuditService,
  initDefaultAuditStore,
} from "@/lib/ai/audit";
import {
  getDefaultExecutionStore,
  initDefaultExecutionStore,
} from "@/lib/ai/executions/firestore-store";
import { adminDb } from "@/lib/firebase-admin";
import { executeTool } from "@/lib/ai/tools/executor";
import { getTool } from "@/lib/ai/tools/registry";
import type { CustomerHandoff, OnboardingPlan } from "@/lib/ai/onboarding/types";

export const runtime = "nodejs";

initDefaultAuditStore();
initDefaultExecutionStore();

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let executionId: string | undefined;
  try {
    const getHandoffTool = getTool("get_customer_handoff");
    const createPlanTool = getTool("create_onboarding_plan");
    if (!getHandoffTool || !createPlanTool) {
      throw new Error("Customer onboarding tools are not registered.");
    }

    const requestId = `onboarding_test_${Date.now()}`;
    const executionStore = getDefaultExecutionStore();
    const execution = await executionStore.createExecution({
      requestId,
      agentId: "customer_success",
      workflowType: "customer_handoff_onboarding",
      steps: [
        {
          stepId: "create_customer_handoff",
          type: "tool",
          actionId: "create_customer_handoff",
          actionName: "Create Customer Handoff",
        },
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
      ],
      metadata: { test: true },
    });
    executionId = execution.executionId;

    const handoffResult = await executeTool({
      toolId: "create_customer_handoff",
      input: {
        customerName: "Acme Corporation",
        customerEmail: "customer@example.com",
        company: "Acme Corporation",
        dealSummary: "Enterprise customer interested in AI operations automation.",
        salesNotes: "Customer requested onboarding next week and wants CRM integration.",
        plan: "Enterprise",
        owner: "Sales Agent",
      },
      context: { agentId: "sales", requestId },
    });
    if (!handoffResult.success) {
      throw new Error("Customer handoff creation failed.");
    }

    const handoffId = (handoffResult.result as { handoffId?: unknown }).handoffId;
    if (typeof handoffId !== "string" || !handoffId) {
      throw new Error("Customer handoff returned no ID.");
    }

    const retrievedResult = await executeTool({
      toolId: "get_customer_handoff",
      input: { handoffId },
      context: { agentId: "customer_success", requestId },
    });
    if (!retrievedResult.success) {
      throw new Error("Customer handoff retrieval failed.");
    }

    const handoff = retrievedResult.result as CustomerHandoff;
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
      context: { agentId: "customer_success", requestId },
    });
    if (!planResult.success) {
      throw new Error("Onboarding plan creation failed.");
    }

    const planId = (planResult.result as { planId?: unknown }).planId;
    if (typeof planId !== "string" || !planId) {
      throw new Error("Onboarding plan returned no ID.");
    }

    const planDocument = await adminDb.collection("onboardingPlans").doc(planId).get();
    if (!planDocument.exists || planDocument.data()?.handoffId !== handoffId) {
      throw new Error("Created onboarding plan was not found in Firestore.");
    }

    const completed = await executionStore.updateExecution(executionId, {
      status: "completed",
      currentStepIndex: 4,
      completedAt: new Date().toISOString(),
      metadata: { test: true, handoffId, planId },
      steps: execution.steps.map((step) => ({
        ...step,
        status: "completed",
        completedAt: new Date().toISOString(),
        metadata: { status: "completed" },
      })),
    });
    if (!completed) {
      throw new Error("Execution record could not be updated.");
    }

    const executionDocument = await adminDb
      .collection("executions")
      .doc(executionId)
      .get();
    if (!executionDocument.exists || executionDocument.data()?.status !== "completed") {
      throw new Error("Completed execution was not found in Firestore.");
    }

    await getDefaultAuditService().fire("ai_request_completed", {
      eventType: "ai_request_completed",
      requestId,
      agentId: "customer_success",
      success: true,
      status: "customer_handoff_onboarding_completed",
      metadata: { handoffId, planId, executionId },
    });

    const auditDocuments = await adminDb
      .collection("auditEvents")
      .where("requestId", "==", requestId)
      .limit(1)
      .get();
    if (auditDocuments.empty) {
      throw new Error("Workflow audit record was not found in Firestore.");
    }

    return NextResponse.json({
      success: true,
      toolRegistered: true,
      executed: true,
      firestoreVerified: true,
      handoffId,
      onboardingPlanId: planId,
      executionId,
      auditVerified: true,
    });
  } catch (error) {
    console.error("[test-customer-onboarding]", error);
    if (executionId) {
      await getDefaultExecutionStore().updateExecution(executionId, {
        status: "failed",
        error: "Customer onboarding test failed.",
      });
    }
    return NextResponse.json(
      { error: "Unable to complete the customer onboarding test." },
      { status: 500 }
    );
  }
}
