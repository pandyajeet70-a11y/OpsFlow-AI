/**
 * lib/ai/org/service.ts
 *
 * Tenant resolution logic for Phase 3.
 *
 * Every authenticated user is mapped to an active organization. If a user has no
 * membership yet, one is created lazily (the user becomes the org owner) so the
 * system is immediately usable without a separate onboarding step. This keeps
 * tenant isolation meaningful from a user's very first request.
 *
 * The store is injectable (see `lib/ai/org/store.ts`) so this logic is fully
 * testable offline with `InMemoryOrgStore`.
 */

import type { AuthenticatedUser } from "../auth/types";
import { type OrgStore, getDefaultOrgStore } from "./store";
import type {
  ActiveOrganization,
  CreateOrganizationInput,
} from "./types";

export interface OrgServiceDeps {
  store: OrgStore;
}

export const defaultOrgServiceDeps = (): OrgServiceDeps => ({
  store: getDefaultOrgStore(),
});

/** Build a deterministic default org name for a new user. */
export function defaultOrganizationNameForUser(user: AuthenticatedUser): string {
  const base =
    user.email?.split("@")[0]?.trim() ||
    user.uid.slice(0, 8);
  return `${base}'s Workspace`;
}

/**
 * Resolve the active organization for `user`, creating one (with the user as
 * owner) if none exists yet.
 *
 * Returns null only if the underlying store is unavailable in a way the caller
 * cannot recover from — callers should treat a null result as "no active org".
 */
export async function getOrCreateOrganizationForUser(
  deps: OrgServiceDeps,
  user: AuthenticatedUser
): Promise<ActiveOrganization> {
  const existing = await getActiveOrganization(deps, user.uid);
  if (existing) return existing;

  const input: CreateOrganizationInput = {
    name: defaultOrganizationNameForUser(user),
    createdBy: user.uid,
  };
  const { organization, membership } = await deps.store.createOrganization(
    input
  );
  return {
    organizationId: organization.organizationId,
    role: membership.role,
    organization,
  };
}

/**
 * Resolve (without creating) the active organization for a user.
 *
 * Returns null when the user has no membership.
 */
export async function getActiveOrganization(
  deps: OrgServiceDeps,
  userId: string
): Promise<ActiveOrganization | null> {
  const membership = await deps.store.getMembership(userId);
  if (!membership) return null;
  const organization = await deps.store.getOrganization(
    membership.organizationId
  );
  if (!organization) return null;
  return {
    organizationId: organization.organizationId,
    role: membership.role,
    organization,
  };
}
