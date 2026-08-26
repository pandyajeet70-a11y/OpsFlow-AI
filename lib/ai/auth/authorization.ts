/**
 * lib/ai/auth/authorization.ts
 *
 * Reusable, dependency-free authorization primitives for Phase 3.
 *
 * These are pure functions over typed identities and persisted records so they
 * can be unit-tested offline without Firebase.
 */

import type { AuthenticatedUser, ApprovalActor, OrgRole, Role } from "./types";

/** True when the verified identity holds the global `admin` claim/role. */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.admin === true || user.role === "admin";
}

/** True when the caller's resolved organization matches the resource's org. */
export function isMemberOfOrganization(
  actor: { organizationId?: string },
  callerOrganizationId?: string
): boolean {
  if (!callerOrganizationId) return false;
  return actor.organizationId === callerOrganizationId;
}

/**
 * Resolve the effective role the caller holds within a resource's organization.
 *
 * - Global admins are treated as having org-level admin rights.
 * - Otherwise the caller's explicit membership role in that org is used.
 */
export function roleInOrganization(
  user: AuthenticatedUser,
  callerOrgRole?: OrgRole,
  resourceOrgId?: string
): OrgRole | undefined {
  if (resourceOrgId === undefined) return undefined;
  if (isAdmin(user)) return "admin";
  return callerOrgRole;
}

/**
 * Whether the global role alone is sufficient to bypass tenant isolation.
 *
 * Global admins may operate across organizations (super-admin). Regular users
 * are always bound to their own organization.
 */
export function isSuperAdmin(user: AuthenticatedUser): boolean {
  return isAdmin(user);
}

export function canManageIntegration(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

export function canViewIntegration(role: OrgRole): boolean {
  return ["owner", "admin", "viewer"].includes(role);
}

/**
 * Can the actor approve a resource that lives in `resourceOrgId`?
 *
 * Authorization rules (tenant-aware):
 *  - Global admins: yes (super-admin).
 *  - Org owner / org admin of the resource's org: yes.
 *  - Resource owner (actor uid === recorded owner): yes.
 *  - Any other user: no (prevents cross-user and cross-org approval).
 *
 * When `resourceOrgId` is absent (legacy approvals created before orgs existed),
 * the check degrades to owner-vs-actor only.
 */
export function canApprove(
  user: AuthenticatedUser,
  opts: {
    ownerUserId?: string;
    resourceOrgId?: string;
    callerOrganizationId?: string;
    callerOrgRole?: OrgRole;
  }
): boolean {
  // Super-admin bypass.
  if (isSuperAdmin(user)) return true;

  const isOwner =
    opts.ownerUserId !== undefined && opts.ownerUserId === user.uid;
  if (isOwner) return true;

  // Without an organization context, only the owner can approve.
  if (opts.resourceOrgId === undefined) return false;

  // Organization-scoped: must be in the same org AND hold an admin/owner role.
  if (!isMemberOfOrganization({ organizationId: opts.resourceOrgId }, opts.callerOrganizationId)) return false;
  const role = roleInOrganization(user, opts.callerOrgRole, opts.resourceOrgId);
  return role === "owner" || role === "admin";
}

/** Convenience: build an ApprovalActor from an authenticated user + resolved org. */
export function buildActor(
  user: AuthenticatedUser,
  callerOrganizationId?: string,
  callerOrgRole?: OrgRole
): ApprovalActor {
  return {
    callerUserId: user.uid,
    callerOrganizationId,
    callerIsAdmin: isAdmin(user),
    callerOrgRole,
  };
}

/** Re-export Role/OrgRole for convenience. */
export type { Role, OrgRole };
