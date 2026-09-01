import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authorizationErrorResponse, isAuthorizationError, requirePermission } from "@/lib/ai/auth/authorization-server";
import { validateWorkflowActions } from "@/lib/ai/workflows/validation";

export const runtime = "nodejs";

async function ownedReference(request: NextRequest, id: string) {
  const context = await requirePermission(request, "manage_workflows");
  const reference = adminDb.collection("workflows").doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists || snapshot.data()?.organizationId !== context.organizationId) return null;
  return { context, reference, data: snapshot.data() };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await ownedReference(request, (await params).id);
    if (!result) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    const body = await request.json() as { name?: unknown; description?: unknown; trigger?: unknown; triggerType?: unknown; actions?: unknown; status?: unknown };
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.description === "string" && body.description.trim()) updates.description = body.description.trim();
    if (typeof body.trigger === "string") updates.trigger = body.trigger.trim() || "Manual trigger";
    if (body.triggerType === "manual" || body.triggerType === "new_customer") updates.triggerType = body.triggerType;
    if (body.status === "active" || body.status === "paused") updates.status = body.status;
    if (body.actions !== undefined) {
      const actionValidation = validateWorkflowActions(body.actions);
      if (actionValidation.error) return NextResponse.json({ error: actionValidation.error }, { status: 400 });
      updates.actions = actionValidation.actions;
    }
    await result.reference.update(updates);
    return NextResponse.json({ data: { id: result.reference.id, ...result.data, ...updates } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflows/:id] update failed", error);
    return NextResponse.json({ error: "Unable to update workflow." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await ownedReference(request, (await params).id);
    if (!result) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    await result.reference.delete();
    return NextResponse.json({ data: { deleted: true, id: result.reference.id } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflows/:id] delete failed", error);
    return NextResponse.json({ error: "Unable to delete workflow." }, { status: 500 });
  }
}