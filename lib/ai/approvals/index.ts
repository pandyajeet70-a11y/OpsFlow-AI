/**
 * lib/ai/approvals/index.ts
 *
 * Public surface for the persisted approval workflow.
 */

export * from "./types";
export {
  DEFAULT_APPROVAL_TTL_MS,
  InMemoryApprovalStore,
  buildAuditEntry,
  isAuthorizedActor,
} from "./store";
export type {
  ApprovalStore,
  CreateApprovalInput,
  TransitionResult,
  TransitionReason,
} from "./store";
export {
  approveApproval,
  createApproval,
  rejectApproval,
} from "./service";
export type {
  ApprovalActionResult,
  ApprovalOutcomeCode,
  ApprovalServiceDeps,
  ApprovedExecuteRequest,
} from "./service";