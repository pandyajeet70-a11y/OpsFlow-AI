/**
 * lib/ai/auth/types.ts
 *
 * Typed identity contracts for Phase 3 server-side authentication.
 *
 * These types are intentionally dependency-free (no Firebase imports) so they
 * can be compiled and unit-tested offline.
 */

/**
 * Global (account-level) role derived from Firebase custom claims.
 *
 * Mapped from the `admin` custom claim set via the Admin SDK:
 *  - `admin: true` → "admin"
 *  - otherwise  → "user"
 */
export type Role = "user" | "admin";

/**
 * Role a user holds *within a specific organization*.
 *
 * Stored on the OrganizationMembership document. These are checked in
 * addition to the global `Role` when authorizing tenant-scoped actions.
 */
export type OrgRole = "owner" | "admin" | "sales" | "customer_success" | "viewer" | "member";

export interface Claims {
  admin?: boolean;
  /** Arbitrary custom claims may be present; never trust unknown ones. */
  [key: string]: unknown;
}

/**
 * A server-verified Firebase identity.
 *
 * This is the ONLY user representation the rest of OpsFlow should trust.
 * It is always derived from `FirebaseAuth.verifyIdToken` — never from a
 * client-supplied header, body field, or model output.
 */
export interface AuthenticatedUser {
  /** Firebase Auth UID. The authoritative actor identifier. */
  uid: string;
  /** Email from the verified token (may be null for phone/anonymous users). */
  email: string | null;
  /** Whether the user's email is verified. */
  emailVerified: boolean;
  /** Raw custom claims from the token. */
  claims: Claims;
  /** Derived global role. */
  role: Role;
  /** Convenience alias for `role === "admin"`. */
  admin: boolean;
}

/**
 * Context used when authorizing a specific approval action.
 *
 * Carries everything the authorization decision needs:
 *  - the verified actor UID (ownership check),
 *  - the actor's resolved organization (tenant isolation),
 *  - whether the actor is a global admin (super-admin bypass),
 *  - the actor's role within the resource's organization.
 */
export interface ApprovalActor {
  /** Verified Firebase UID of the caller. */
  callerUserId: string;
  /** Organization the caller belongs to (resolved server-side). */
  callerOrganizationId?: string;
  /** True if the caller holds the global `admin` claim. */
  callerIsAdmin?: boolean;
  /** The caller's role within the resource's organization. */
  callerOrgRole?: OrgRole;
}

/**
 * Actor context at the data layer boundary.
 *
 * Same as `ApprovalActor` but with an optional `callerUserId` so the store and
 * service layer can represent "unverified/legacy" ownership (ownerless
 * approvals) without forcing a fabricated UID. Production callers (the API
 * routes) always supply a real verified UID, so this degrades to `ApprovalActor`
 * in practice.
 */
export interface ActorContext {
  callerUserId?: string;
  callerOrganizationId?: string;
  callerIsAdmin?: boolean;
  callerOrgRole?: OrgRole;
}
