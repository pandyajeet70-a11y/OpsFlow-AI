import { NextRequest, NextResponse } from "next/server";
import { listRecentHandoffs } from "@/lib/ai/workflows/query-service";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
    return NextResponse.json({ data: await listRecentHandoffs({ limit, organizationId: context.organizationId }) });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/handoffs]", error);
    return NextResponse.json({ error: "Unable to load handoffs." }, { status: 500 });
  }
}
