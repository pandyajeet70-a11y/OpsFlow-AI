import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authorizationErrorResponse, isAuthorizationError, requirePermission } from "@/lib/ai/auth/authorization-server";
import "@/lib/ai/tools/builtins";
import { validateWorkflowActions } from "@/lib/ai/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const snapshot = await adminDb.collection("workflows")
      .where("organizationId", "==", context.organizationId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return NextResponse.json({ data: snapshot.docs.map((document) => ({ id: document.id, ...document.data() })) });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflows] list failed", error);
    return NextResponse.json({ error: "Unable to load workflows." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePermission(request, "manage_workflows");
    const body = await request.json() as { name?: unknown; description?: unknown; trigger?: unknown; triggerType?: unknown; actions?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const trigger = typeof body.trigger === "string" ? body.trigger.trim() : "Manual trigger";
    const triggerType = body.triggerType === "new_customer" ? "new_customer" : "manual";
    const actionValidation = validateWorkflowActions(body.actions);
    if (!name || !description || actionValidation.error) {
      return NextResponse.json({ error: actionValidation.error ?? "name and description are required." }, { status: 400 });
    }
    const actions = actionValidation.actions;
    const reference = await adminDb.collection("workflows").add({ userId: context.userId, organizationId: context.organizationId, name, description, trigger, triggerType, actions, status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return NextResponse.json({ data: { id: reference.id, userId: context.userId, organizationId: context.organizationId, name, description, trigger, triggerType, actions, status: "active" } }, { status: 201 });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflows] create failed", error);
    return NextResponse.json({ error: "Unable to create workflow." }, { status: 500 });
  }
}