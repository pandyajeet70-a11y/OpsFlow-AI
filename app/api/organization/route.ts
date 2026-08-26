import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const organization = await adminDb.collection("organizations").doc(context.organizationId).get();
    const members = await adminDb.collection("organizations").doc(context.organizationId).collection("members").get();
    return NextResponse.json({
      data: {
        organization: organization.exists ? organization.data() : { organizationId: context.organizationId, name: "Workspace" },
        role: context.role,
        members: members.docs.map((member) => ({ id: member.id, ...member.data() })),
      },
    });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[organization]", error);
    return NextResponse.json({ error: "Unable to load organization." }, { status: 500 });
  }
}
