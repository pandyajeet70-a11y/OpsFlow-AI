import { NextResponse } from "next/server";
import { getApprovalById } from "@/lib/ai/workflows/query-service";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "view_workflows");
    const { id } = await context.params;
    const approval = await getApprovalById(id, auth.organizationId);
    return approval
      ? NextResponse.json({ data: approval })
      : NextResponse.json({ error: "Approval not found." }, { status: 404 });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/approvals/:id]", error);
    return NextResponse.json({ error: "Unable to load approval." }, { status: 500 });
  }
}
