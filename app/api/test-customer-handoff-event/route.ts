import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { executeTool } from "@/lib/ai/tools/executor";
import { getTool } from "@/lib/ai/tools/registry";
import { isDevelopmentTestRouteAllowed } from "@/lib/ai/config/runtime";

export const runtime = "nodejs";

export async function POST() {
  if (!isDevelopmentTestRouteAllowed()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    if (!getTool("create_customer_handoff")) {
      throw new Error("create_customer_handoff is not registered.");
    }

    const result = await executeTool({
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
      context: { agentId: "sales", requestId: `event_test_${Date.now()}` },
    });
    if (!result.success) {
      throw new Error("Customer handoff creation failed.");
    }

    const output = result.result as {
      handoffId?: unknown;
      eventId?: unknown;
      handlerCount?: unknown;
      failedHandlers?: unknown;
    };
    if (
      typeof output.handoffId !== "string" ||
      typeof output.eventId !== "string" ||
      output.handlerCount !== 1 ||
      output.failedHandlers !== 0
    ) {
      throw new Error("Customer handoff event was not handled successfully.");
    }

    const eventDocument = await adminDb
      .collection("workflowEvents")
      .doc(output.eventId)
      .get();
    const eventData = eventDocument.data();
    if (
      !eventDocument.exists ||
      eventData?.name !== "customer.handoff.created" ||
      eventData.handlerStatus !== "completed" ||
      typeof eventData.executionId !== "string" ||
      typeof eventData.planId !== "string"
    ) {
      throw new Error("Workflow event was not completed in Firestore.");
    }

    const planDocument = await adminDb
      .collection("onboardingPlans")
      .doc(eventData.planId)
      .get();
    if (
      !planDocument.exists ||
      planDocument.data()?.handoffId !== output.handoffId
    ) {
      throw new Error("Onboarding plan persistence was not verified.");
    }

    const executionDocument = await adminDb
      .collection("executions")
      .doc(eventData.executionId)
      .get();
    if (
      !executionDocument.exists ||
      executionDocument.data()?.status !== "completed"
    ) {
      throw new Error("Workflow execution persistence was not verified.");
    }

    return NextResponse.json({
      success: true,
      eventEmitted: true,
      handlerExecuted: true,
      firestoreVerified: true,
      handoffId: output.handoffId,
      eventId: output.eventId,
      onboardingPlanId: eventData.planId,
      executionId: eventData.executionId,
    });
  } catch (error) {
    console.error("[test-customer-handoff-event]", error);
    return NextResponse.json(
      { error: "Unable to complete the event-driven handoff test." },
      { status: 500 }
    );
  }
}
