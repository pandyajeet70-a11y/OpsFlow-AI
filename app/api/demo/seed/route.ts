import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" && process.env.DEMO_MODE !== "true") return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const context = await requirePermission(request, "manage_organization");
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    const org = adminDb.collection("organizations").doc(context.organizationId);
    batch.set(org.collection("workflows").doc("demo-customer-success"), { name: "Demo customer success launch", trigger: "new_customer", status: "active", actions: ["create_profile", "send_welcome_email"], organizationId: context.organizationId, userId: context.userId, demo: true, createdAt: now }, { merge: true });
    batch.set(adminDb.collection("workflows").doc(`demo-${context.userId}`), { name: "Demo customer success launch", trigger: "new_customer", triggerType: "new_customer", status: "active", actions: ["create_profile", "send_welcome_email"], organizationId: context.organizationId, userId: context.userId, demo: true, createdAt: now }, { merge: true });
    batch.set(org.collection("integrations").doc("demo-webhook"), { id: "demo-webhook", provider: "webhook", name: "Demo webhook", enabled: false, status: "disabled", metadata: { endpoint: "https://example.com/demo", demo: true }, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(adminDb.collection("workflowExecutions").doc(`demo-${context.userId}`), { organizationId: context.organizationId, userId: context.userId, workflowName: "Demo customer success launch", status: "completed", demo: true, startedAt: now, completedAt: now, totalActions: 2, completedActions: 2 });
    batch.set(adminDb.collection("activity").doc(`demo-${context.userId}`), { organizationId: context.organizationId, userId: context.userId, message: "Demo customer handoff completed", demo: true, timestamp: now });
    batch.set(adminDb.collection("approvals").doc(`demo-${context.userId}`), { organizationId: context.organizationId, userId: context.userId, toolName: "Send welcome email", status: "approved", demo: true, createdAt: now });
    batch.set(adminDb.collection("executions").doc(`demo-${context.organizationId}`), { organizationId: context.organizationId, userId: context.userId, workflowType: "demo", status: "completed", demo: true, startedAt: now, completedAt: now });
    batch.set(adminDb.collection("auditEvents").doc(`demo-${context.organizationId}`), { organizationId: context.organizationId, eventType: "demo_seeded", success: true, demo: true, timestamp: now });
    await batch.commit();
    return NextResponse.json({ data: { seeded: true, organizationId: context.organizationId } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[demo/seed] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to create demo data." }, { status: 500 });
  }
}