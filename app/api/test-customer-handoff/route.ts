import { NextResponse } from "next/server";
import { executeTool } from "@/lib/ai/tools/executor";
import { getTool } from "@/lib/ai/tools/registry";
import { adminDb } from "@/lib/firebase-admin";
import { isDevelopmentTestRouteAllowed } from "@/lib/ai/config/runtime";

export const runtime = "nodejs";

export async function POST() {
  if (!isDevelopmentTestRouteAllowed()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const tool = getTool("create_customer_handoff");
    if (!tool) {
      throw new Error("create_customer_handoff is not registered.");
    }

    const result = await executeTool({
      toolId: "create_customer_handoff",
      input: {
        customerName: "Acme Corporation",
        customerEmail: "customer@example.com",
        company: "Acme Corporation",
        dealSummary:
          "Enterprise customer interested in AI operations automation.",
        salesNotes:
          "Customer requested onboarding next week and wants CRM integration.",
        plan: "Enterprise",
        owner: "Sales Agent",
      },
      context: {
        agentId: "sales",
        requestId: `handoff_test_${Date.now()}`,
      },
    });

    if (!result.success || !result.executed) {
      throw new Error(
        result.error ?? "create_customer_handoff did not execute."
      );
    }

    const handoff = result.result as { handoffId?: unknown };
    if (
      typeof handoff.handoffId !== "string" ||
      handoff.handoffId.length === 0
    ) {
      throw new Error("create_customer_handoff returned no handoff ID.");
    }

    const document = await adminDb
      .collection("handoffs")
      .doc(handoff.handoffId)
      .get();
    if (!document.exists) {
      throw new Error("Created handoff was not found in Firestore.");
    }

    return NextResponse.json({
      success: true,
      toolRegistered: true,
      executed: true,
      firestoreVerified: true,
      handoffId: document.id,
    });
  } catch (error) {
    console.error("[test-customer-handoff]", error);
    return NextResponse.json(
      { error: "Unable to complete the customer handoff test." },
      { status: 500 }
    );
  }
}
