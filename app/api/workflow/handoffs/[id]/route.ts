import { NextRequest, NextResponse } from "next/server";
import { getHandoffById } from "@/lib/ai/workflows/query-service";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "view_workflows");
    const { id } = await context.params;
    if (!id || !id.trim()) {
      return NextResponse.json({ error: "handoffId is required." }, { status: 400 });
    }
    const handoff = await getHandoffById(id, auth.organizationId);
    return handoff
      ? NextResponse.json({ data: handoff })
      : NextResponse.json({ error: "Handoff not found." }, { status: 404 });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/handoffs/:id]", error);
    return NextResponse.json({ error: "Unable to load handoff." }, { status: 500 });
  }
}
