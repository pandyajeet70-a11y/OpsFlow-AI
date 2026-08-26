import { NextRequest, NextResponse } from "next/server";
import { listApprovals } from "@/lib/ai/workflows/query-service";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
    const approvals = await listApprovals({ limit, organizationId: context.organizationId });
    return NextResponse.json({ data: approvals });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/approvals]", error);
    return NextResponse.json({ error: "Unable to load approvals." }, { status: 500 });
  }
}
