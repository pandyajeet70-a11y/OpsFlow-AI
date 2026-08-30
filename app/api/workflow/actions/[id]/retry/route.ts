import { NextRequest, NextResponse } from "next/server";
import { getRetryEligibility } from "@/lib/ai/workflows/service";
import { retryWorkflowAction } from "@/lib/ai/executions/actions";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await requirePermission(request, "retry_actions");
    const { id: actionId } = await context.params;
    const body = (await request.json()) as { executionId?: unknown };
    if (typeof body.executionId !== "string" || !body.executionId.trim()) {
      return NextResponse.json({ error: "executionId is required." }, { status: 400 });
    }
    const eligibility = await getRetryEligibility(body.executionId, actionId, authorization.organizationId);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: "Action is not eligible for retry.", data: eligibility },
        { status: 409 }
      );
    }
    const action = await retryWorkflowAction({ executionId: body.executionId, actionId, organizationId: authorization.organizationId });
    return NextResponse.json({ data: action });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/actions/:id/retry]", error);
    return NextResponse.json({ error: "Unable to retry workflow action." }, { status: 500 });
  }
}
