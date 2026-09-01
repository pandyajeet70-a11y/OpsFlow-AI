/**
 * lib/ai/approvals/service.ts
 *
 * Approval workflow orchestration.
 *
 * Everything here is dependency-injected (`store`, `resolveTool`, `execute`)
 * so the security-critical logic is fully testable offline. The API routes wire
 * in the real Firestore store, the tool registry, and the tool executor.
 *
 * Security posture:
 *  - only the persisted approval record is trusted (id, arguments, owner, status)
 *  - the tool definition is re-resolved from the server registry at execution
 *  - arguments used at execution come verbatim from the stored record
 *  - approval gate: execution is only attempted with `context.approved = true`,
 *    which the executor still enforces against the registry
 */

import type { OrgRole } from "../auth/types";
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
} from "../tools/types";
import type {
  ApprovalStore,
  CreateApprovalInput,
} from "./store";
import type { ApprovalRequest } from "./types";
import type { AuditService } from "../audit";

export interface ApprovedExecuteRequest {
  toolId: string;
  input: Record<string, unknown>;
  context?: ToolExecutionContext;
}

export interface ApprovalServiceDeps {
  store: ApprovalStore;
  resolveTool: (toolId: string) => ToolDefinition | undefined;
  execute: (req: ApprovedExecuteRequest) => Promise<ToolExecutionResult>;
  /** Optional fail-safe audit emitter (never breaks the business operation). */
  audit?: AuditService;
}

export type ApprovalOutcomeCode =
  | "approved"
  | "execution_failed"
  | "rejected"
  | "not_found"
  | "unauthorized"
  | "already_processed"
  | "expired";

export interface ApprovalActionResult {
  ok: boolean;
  code: ApprovalOutcomeCode;
  approval?: ApprovalRequest;
  execution?: ToolExecutionResult;
  message: string;
}

/* =========================================================
   Create
   ========================================================= */

export async function createApproval(
  deps: Pick<ApprovalServiceDeps, "store">,
  input: CreateApprovalInput
): Promise<ApprovalRequest> {
  return deps.store.create(input);
}

/* =========================================================
   Approve + execute
   ========================================================= */

/** Inputs for `approveApproval`. The caller fields are verified server-side. */
export interface ApproveApprovalInput {
  approvalId: string;
  /** Verified Firebase UID of the actor (ignored if absent → ownerless). */
  callerUserId?: string;
  /** Server-resolved org of the actor. */
  callerOrganizationId?: string;
  /** Global admin flag (from Firebase custom claims). */
  callerIsAdmin?: boolean;
  /** Actor's role within the resource's organization. */
  callerOrgRole?: OrgRole;
}

export async function approveApproval(
  deps: ApprovalServiceDeps,
  input: ApproveApprovalInput
): Promise<ApprovalActionResult> {
  const now = new Date().toISOString();
  const claim = await deps.store.transitionToApproved(
    input.approvalId,
    input.callerUserId,
    now,
    {
      callerUserId: input.callerUserId,
      callerOrganizationId: input.callerOrganizationId,
      callerIsAdmin: input.callerIsAdmin,
      callerOrgRole: input.callerOrgRole,
    }
  );
  if (!claim.ok) {
    switch (claim.reason) {
      case "not_found":
        return { ok: false, code: "not_found", message: "Approval not found." };
      case "unauthorized":
        deps.audit?.fire("authorization_denied", {
          eventType: "authorization_denied",
          requestId: claim.approval?.requestId,
          userId: input.callerUserId,
          organizationId: claim.approval?.organizationId,
          agentId: claim.approval?.agentId,
          toolId: claim.approval?.toolId,
          approvalId: input.approvalId,
          success: false,
          status: "unauthorized",
        });
        return {
          ok: false,
          code: "unauthorized",
          message: "You are not authorized to approve this request.",
        };
      case "expired":
        deps.audit?.fire("approval_expired", {
          eventType: "approval_expired",
          requestId: claim.approval?.requestId,
          userId: input.callerUserId,
          organizationId: claim.approval?.organizationId,
          agentId: claim.approval?.agentId,
          toolId: claim.approval?.toolId,
          approvalId: input.approvalId,
          success: false,
          status: "expired",
        });
        return {
          ok: false,
          code: "expired",
          approval: claim.approval,
          message: "This approval has expired.",
        };
      default:
        return {
          ok: false,
          code: "already_processed",
          approval: claim.approval,
          message: `This approval has already been ${claim.approval?.status}.`,
        };
    }
  }
  const approval = claim.approval as ApprovalRequest;
  deps.audit?.fire("approval_approved", {
    eventType: "approval_approved",
    requestId: approval.requestId,
    userId: input.callerUserId,
    organizationId: approval.organizationId,
    agentId: approval.agentId,
    toolId: approval.toolId,
    approvalId: approval.approvalId,
    success: true,
    status: "approved",
  });
  const tool = deps.resolveTool(approval.toolId);
  if (!tool) {
    await deps.store.transitionToFailed(
      approval.approvalId,
      `Tool "${approval.toolId}" is not registered.`,
      new Date().toISOString()
    );
    const finalApproval = await deps.store.get(approval.approvalId);
    return {
      ok: false,
      code: "execution_failed",
      approval: finalApproval ?? approval,
      message: `Tool "${approval.toolId}" is not registered.`,
    };
  }
  const execution = await deps.execute({
    toolId: approval.toolId,
    input: approval.arguments,
    context: {
      approved: true,
      userId: approval.userId,
      organizationId: approval.organizationId,
      agentId: approval.agentId,
      requestId: approval.requestId,
    },
  });
  if (execution.success) {
    await deps.store.transitionToExecuted(
      approval.approvalId,
      execution.result,
      new Date().toISOString()
    );
    await deps.audit?.fire("tool_executed", {
      eventType: "tool_executed",
      requestId: approval.requestId,
      userId: input.callerUserId,
      organizationId: approval.organizationId,
      agentId: approval.agentId,
      toolId: approval.toolId,
      approvalId: approval.approvalId,
      success: true,
      status: "completed",
    });
    const finalApproval = await deps.store.get(approval.approvalId);
    return {
      ok: true,
      code: "approved",
      approval: finalApproval ?? approval,
      execution,
      message: "Approval executed successfully.",
    };
  }
  await deps.store.transitionToFailed(
    approval.approvalId,
    execution.error ?? "Tool execution failed.",
    new Date().toISOString()
  );
  await deps.audit?.fire("tool_failed", {
    eventType: "tool_failed",
    requestId: approval.requestId,
    userId: input.callerUserId,
    organizationId: approval.organizationId,
    agentId: approval.agentId,
    toolId: approval.toolId,
    approvalId: approval.approvalId,
    success: false,
    status: "failed",
  });
  const finalApproval = await deps.store.get(approval.approvalId);
  return {
    ok: false,
    code: "execution_failed",
    approval: finalApproval ?? approval,
    execution,
    message: execution.error ?? "Tool execution failed.",
  };
}

/* ========================================================= 
   Reject 
   ========================================================= */

export async function rejectApproval(
  deps: ApprovalServiceDeps,
  input: ApproveApprovalInput
): Promise<ApprovalActionResult> {
  const now = new Date().toISOString();
  const res = await deps.store.transitionToRejected(
    input.approvalId,
    input.callerUserId,
    now,
    {
      callerUserId: input.callerUserId,
      callerOrganizationId: input.callerOrganizationId,
      callerIsAdmin: input.callerIsAdmin,
      callerOrgRole: input.callerOrgRole,
    }
  );
  if (!res.ok) {
    switch (res.reason) {
      case "not_found":
        return { ok: false, code: "not_found", message: "Approval not found." };
      case "unauthorized":
        deps.audit?.fire("authorization_denied", {
          eventType: "authorization_denied",
          requestId: res.approval?.requestId,
          userId: input.callerUserId,
          organizationId: res.approval?.organizationId,
          agentId: res.approval?.agentId,
          toolId: res.approval?.toolId,
          approvalId: input.approvalId,
          success: false,
          status: "unauthorized",
        });
        return {
          ok: false,
          code: "unauthorized",
          message: "You are not authorized to reject this request.",
        };
      case "expired":
        deps.audit?.fire("approval_expired", {
          eventType: "approval_expired",
          requestId: res.approval?.requestId,
          userId: input.callerUserId,
          organizationId: res.approval?.organizationId,
          agentId: res.approval?.agentId,
          toolId: res.approval?.toolId,
          approvalId: input.approvalId,
          success: false,
          status: "expired",
        });
        return {
          ok: false,
          code: "expired",
          approval: res.approval,
          message: "This approval has expired.",
        };
      default:
        return {
          ok: false,
          code: "already_processed",
          approval: res.approval,
          message: `This approval has already been ${res.approval?.status}.`,
        };
    }
  }
  const finalApproval = await deps.store.get(input.approvalId);
  deps.audit?.fire("approval_rejected", {
    eventType: "approval_rejected",
    requestId: (res.approval ?? finalApproval)?.requestId,
    userId: input.callerUserId,
    organizationId: (res.approval ?? finalApproval)?.organizationId,
    agentId: (res.approval ?? finalApproval)?.agentId,
    toolId: (res.approval ?? finalApproval)?.toolId,
    approvalId: input.approvalId,
    success: true,
    status: "rejected",
  });
  return {
    ok: true,
    code: "rejected",
    approval: finalApproval ?? res.approval,
    message: "Approval rejected.",
  };
}