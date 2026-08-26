/**
 * lib/ai/org/types.ts
 *
 * Typed concepts for multi-tenant OpsFlow.
 *
 * This is the *foundation* of tenant isolation only — it introduces the
 * Organization / OrganizationMembership model and the role vocabulary, without
 * redesigning the rest of the database.
 */

import type { OrgRole } from "../auth/types";

/** A tenant in OpsFlow. Business resources carry an `organizationId`. */
export interface Organization {
  organizationId: string;
  name: string;
  /** UID of the user who created this organization (the initial owner). */
  createdBy: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A user's membership in an organization.
 *
 * Stored as its own document so membership can be looked up by UID directly:
 * `organizationMemberships/{uid}`.
 */
export interface OrganizationMembership {
  organizationId: string;
  /** Firebase Auth UID of the member. */
  userId: string;
  role: OrgRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  activeOrganizationId?: string;
}

/** Input for creating an organization with its founding owner member. */
export interface CreateOrganizationInput {
  name: string;
  createdBy: string;
}

/** Input for upserting a membership. */
export interface UpsertMembershipInput {
  organizationId: string;
  userId: string;
  role: OrgRole;
}

/** Result of resolving the active organization for a user. */
export interface ActiveOrganization {
  organizationId: string;
  role: OrgRole;
  organization: Organization;
}
