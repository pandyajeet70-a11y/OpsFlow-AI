import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const snapshot = await adminDb.collection("organizations").doc(context.organizationId).collection("settings").doc("onboarding").get();
    return NextResponse.json({ data: snapshot.exists ? snapshot.data() : { step: 0, completed: false, integrationSkipped: false, demoCreated: false } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[onboarding] load failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to load onboarding." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requirePermission(request, "manage_organization");
    const body = await request.json() as { step?: number; integrationSkipped?: boolean; demoCreated?: boolean; completed?: boolean };
    const data = { step: Math.max(0, Math.min(4, Number(body.step) || 0)), integrationSkipped: body.integrationSkipped === true, demoCreated: body.demoCreated === true, completed: body.completed === true, updatedAt: new Date().toISOString() };
    await adminDb.collection("organizations").doc(context.organizationId).collection("settings").doc("onboarding").set(data, { merge: true });
    return NextResponse.json({ data });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[onboarding] save failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to save onboarding." }, { status: 500 });
  }
}