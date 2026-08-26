import { NextResponse } from "next/server";
import { executeTool } from "@/lib/ai/tools/executor";
import { getTool } from "@/lib/ai/tools/registry";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const tool = getTool("create_lead");
    if (!tool) {
      throw new Error("create_lead is not registered.");
    }

    const result = await executeTool({
      toolId: "create_lead",
      input: {
        name: "John Smith",
        email: "john.smith@example.com",
        company: "Acme Corporation",
        source: "website",
      },
      context: {
        agentId: "sales",
        requestId: `test_${Date.now()}`,
      },
    });

    if (!result.success || !result.executed) {
      throw new Error(result.error ?? "create_lead did not execute.");
    }

    const lead = result.result as { id?: unknown };
    if (typeof lead.id !== "string" || lead.id.length === 0) {
      throw new Error("create_lead returned no document ID.");
    }

    const document = await adminDb.collection("leads").doc(lead.id).get();
    if (!document.exists) {
      throw new Error("Created lead was not found in Firestore.");
    }

    return NextResponse.json({
      success: true,
      toolRegistered: true,
      executed: true,
      firestoreVerified: true,
      documentId: document.id,
    });
  } catch (error) {
    console.error("[test-lead]", error);

    return NextResponse.json(
      { error: "Unable to complete the create_lead test." },
      { status: 500 }
    );
  }
}