import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const snapshot = await adminDb.collection("users").doc(context.userId).get();
    return NextResponse.json({ data: snapshot.exists ? snapshot.data() : null });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const body = await request.json() as { name?: unknown; company?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    if (!name || name.length > 120 || company.length > 160) return NextResponse.json({ error: "A valid name and company are required." }, { status: 400 });
    await adminDb.collection("users").doc(context.userId).set({ uid: context.userId, name, company, email: context.user.email ?? "" }, { merge: true });
    return NextResponse.json({ data: { name, company, email: context.user.email ?? "" } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    return NextResponse.json({ error: "Unable to save profile." }, { status: 500 });
  }
}