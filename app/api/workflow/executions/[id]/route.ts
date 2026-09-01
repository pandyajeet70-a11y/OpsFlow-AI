import { NextResponse } from "next/server";
import { getExecutionDetails } from "@/lib/ai/workflows/query-service";
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
    if (!id || !id.trim()) {
      return NextResponse.json({ error: "executionId is required." }, { status: 400 });
    }
    const execution = await getExecutionDetails(id, auth.organizationId);
    return execution
      ? NextResponse.json({ data: execution })
      : NextResponse.json({ error: "Execution not found." }, { status: 404 });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[workflow/executions/:id]", error);
    return NextResponse.json({ error: "Unable to load execution." }, { status: 500 });
  }
}
