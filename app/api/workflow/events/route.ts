import { NextRequest, NextResponse } from "next/server";
import { listAuditRecords, listWorkflowEvents } from "@/lib/ai/workflows/query-service";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_audit");
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
    const [events, audit] = await Promise.all([
      listWorkflowEvents({ limit, organizationId: context.organizationId }),
      listAuditRecords({ limit, organizationId: context.organizationId }),
    ]);
    return NextResponse.json({ data: { events, audit } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/events]", error);
    return NextResponse.json({ error: "Unable to load workflow activity." }, { status: 500 });
  }
}
