/**
 * app/api/approvals/[id]/approve/route.ts
 *
 * Securely approves a persisted approval request and — only after server-side
 * verification (exists, authorized, pending, not expired) — executes the stored
 * tool with the stored server-side arguments.
 *
 * Phase 3: the caller is authenticated from a Firebase ID token
 * (`Authorization: Bearer <idToken>`). The server resolves the caller's
 * organization from their membership and enforces ownership / tenant
 * isolation. `x-opsflow-user-id` and body `userId` are never trusted.
 */

import { NextRequest, NextResponse } from "next/server";
import { approveApproval } from "@/lib/ai/approvals/service";
import { getDefaultApprovalStore } from "@/lib/ai/approvals/firestore-store";
import { approvalActionResponse } from "@/lib/ai/approvals/http";
import {
  getAuthenticatedUser,
  authErrorResponse,
  AuthError,
} from "@/lib/ai/approvals/auth";
import { getTool } from "@/lib/ai/tools/registry";
import { executeTool } from "@/lib/ai/tools/executor";
import { getOrCreateOrganizationForUser, initDefaultOrgStore } from "@/lib/ai/org";
import { defaultOrgServiceDeps } from "@/lib/ai/org/service";
import { buildActor } from "@/lib/ai/auth";
import { getDefaultExecutionStore } from "@/lib/ai/executions/firestore-store";
import { syncWorkflowActionApprovalResult } from "@/lib/ai/executions/actions";
import { hasPermission } from "@/lib/ai/auth/authorization-server";

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

    // Resolve the caller's active organization (created lazily if absent).
    const orgService = defaultOrgServiceDeps();
    const activeOrg = await getOrCreateOrganizationForUser(orgService, user);
    if (!user.admin && !hasPermission(activeOrg.role, "approve_actions")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const actor = buildActor(user, activeOrg.organizationId, activeOrg.role);

    const result = await approveApproval(
      {
        store: getDefaultApprovalStore(),
        resolveTool: getTool,
        execute: (approvedRequest) =>
          executeTool({
            toolId: approvedRequest.toolId,
            input: approvedRequest.input,
            context: {
              approved: true,
              userId: approvedRequest.context?.userId,
              organizationId: activeOrg.organizationId,
              agentId: approvedRequest.context?.agentId,
              requestId: approvedRequest.context?.requestId,
              organizationRole: activeOrg.role,
              isAdmin: user.admin === true,
            },
          }),
      },
      { approvalId: id, ...actor }
    );

    if (result.approval?.requestId) {
      const execution = await getDefaultExecutionStore().getExecutionByRequestId(
        result.approval.requestId
      );
      const action = execution?.actions?.find((candidate) => candidate.approvalId === id);
      if (execution && action) {
        await syncWorkflowActionApprovalResult({
          executionId: execution.executionId,
          actionId: action.actionId,
          completed: result.ok,
        });
      }
    }

    return approvalActionResponse(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("[approvals/approve]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}