/**
 * lib/ai/auth/index.ts
 *
 * Public surface for the Phase 3 authentication + authorization layer.
 */

export type {
  AuthenticatedUser,
  ApprovalActor,
  Claims,
  OrgRole,
  Role,
} from "./types";
export type { DecodedIdTokenLike, TokenVerifier } from "./firebase";

export {
  AuthError,
  getAuthenticatedUser,
  requireAuthenticated,
  resetTokenVerifier,
  setTokenVerifier,
  toAuthenticatedUser,
  verifyIdToken,
} from "./firebase";

export {
  buildActor,
  canApprove,
  isMemberOfOrganization,
  isSuperAdmin,
  roleInOrganization,
} from "./authorization";
