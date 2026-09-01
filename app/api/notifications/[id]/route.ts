import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const id = (await params).id.trim();
    if (!id) return NextResponse.json({ error: "Notification ID is required." }, { status: 400 });
    const reference = adminDb.collection("notifications").doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data()?.userId !== context.userId || snapshot.data()?.organizationId !== context.organizationId) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    await reference.update({ read: true });
    return NextResponse.json({ data: { id, read: true } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    return NextResponse.json({ error: "Unable to update notification." }, { status: 500 });
  }
}