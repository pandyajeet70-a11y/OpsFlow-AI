/**
 * app/api/approvals/[id]/reject/route.ts
 *
 * Securely rejects a persisted approval request. Rejected approvals can never
 * execute.
 *
 * Phase 3: the caller is authenticated from a Firebase ID token. The server
 * resolves the caller's organization and enforces ownership / tenant isolation.
 * `x-opsflow-user-id` and body `userId` are never trusted.
 */

import { NextRequest, NextResponse } from "next/server";
import { rejectApproval } from "@/lib/ai/approvals/service";
import { getDefaultApprovalStore } from "@/lib/ai/approvals/firestore-store";
import { approvalActionResponse } from "@/lib/ai/approvals/http";
import {
  getAuthenticatedUser,
  authErrorResponse,
  AuthError,
} from "@/lib/ai/approvals/auth";
import { getOrCreateOrganizationForUser, initDefaultOrgStore } from "@/lib/ai/org";
import { defaultOrgServiceDeps } from "@/lib/ai/org/service";
import { buildActor } from "@/lib/ai/auth";
import { getTool } from "@/lib/ai/tools/registry";
import type { ToolExecutionResult } from "@/lib/ai/tools/types";
import { hasPermission } from "@/lib/ai/auth/authorization-server";
import { getDefaultExecutionStore } from "@/lib/ai/executions/firestore-store";
import { syncWorkflowActionApprovalResult } from "@/lib/ai/executions/actions";

export const runtime = "nodejs";

// Ensure the production OrgStore is initialized for this server process.
initDefaultOrgStore();

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const user = await getAuthenticatedUser(req); // throws AuthError (401)

    const orgService = defaultOrgServiceDeps();
    const activeOrg = await getOrCreateOrganizationForUser(orgService, user);
    if (!user.admin && !hasPermission(activeOrg.role, "approve_actions")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const actor = buildActor(user, activeOrg.organizationId, activeOrg.role);

    const result = await rejectApproval(
      {
        store: getDefaultApprovalStore(),
        resolveTool: getTool,
        execute: () =>
      Promise.resolve({
        success: true,
        toolId: "",
        toolName: "",
        executed: false,
        status: "failed" as const,
        result: null,
        durationMs: 0,
        approvalRequired: false,
      } as ToolExecutionResult),
      },
      { approvalId: id, ...actor }
    );

    if (result.approval?.requestId) {
      const execution = await getDefaultExecutionStore().getExecutionByRequestId(
        result.approval.requestId
      );
      if (execution?.actions?.some((action) => action.approvalId === id)) {
        await syncWorkflowActionApprovalResult({
          executionId: execution.executionId,
          actionId: result.approval.toolId,
          completed: false,
        });
      }
    }

    return approvalActionResponse(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("[approvals/reject]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}