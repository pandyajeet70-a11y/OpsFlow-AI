import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/ai/workflows/dashboard-service";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    return NextResponse.json({ data: await getDashboardSummary(context.organizationId) });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[dashboard/summary]", error);
    return NextResponse.json({ error: "Unable to load dashboard summary." }, { status: 500 });
  }
}
