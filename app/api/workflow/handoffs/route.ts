import { NextRequest, NextResponse } from "next/server";
import { listRecentHandoffs } from "@/lib/ai/workflows/query-service";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

function parseLimit(value: string | null): number | null {
  if (value === null) return 25;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const limit = Number(trimmed);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 100) return null;
  return limit;
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    if (limit === null) {
      return NextResponse.json({ error: "limit must be a positive integer between 1 and 100." }, { status: 400 });
    }
    return NextResponse.json({ data: await listRecentHandoffs({ limit, organizationId: context.organizationId }) });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/handoffs]", error);
    return NextResponse.json({ error: "Unable to load handoffs." }, { status: 500 });
  }
}
