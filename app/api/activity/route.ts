import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const body = await request.json() as { message?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 500) return NextResponse.json({ error: "message is required and must be 500 characters or fewer." }, { status: 400 });
    const reference = await adminDb.collection("activity").add({ userId: context.userId, organizationId: context.organizationId, message, timestamp: new Date().toISOString() });
    return NextResponse.json({ data: { id: reference.id } }, { status: 201 });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[activity] create failed", error);
    return NextResponse.json({ error: "Unable to save activity." }, { status: 500 });
  }
}