/**
 * lib/ai/org/store.ts
 *
 * Persistence contract for organizations + memberships, plus an in-memory
 * implementation used by offline tests.
 *
 * Intentionally dependency-free (no Firebase at import time) so the test
 * harness can exercise org resolution without a real Firebase project.
 */

import type { OrgRole } from "../auth/types";
import type {
  ActiveOrganization,
  CreateOrganizationInput,
  Organization,
  OrganizationMembership,
  UpsertMembershipInput,
} from "./types";

export interface OrgStore {
  createOrganization(
    input: CreateOrganizationInput
  ): Promise<{ organization: Organization; membership: OrganizationMembership }>;
  getMembership(userId: string): Promise<OrganizationMembership | null>;
  getOrganization(organizationId: string): Promise<Organization | null>;
  upsertMembership(input: UpsertMembershipInput): Promise<void>;
}

/* ---------------------------------------------------------------
   In-memory store (offline tests)
   --------------------------------------------------------------- */

export class InMemoryOrgStore implements OrgStore {
  private orgs = new Map<string, Organization>();
  private memberships = new Map<string, OrganizationMembership>();
  private counter = 0;

  private nextId(): string {
    this.counter += 1;
    return `org_${this.counter}`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  async createOrganization(input: CreateOrganizationInput): Promise<{
    organization: Organization;
    membership: OrganizationMembership;
  }> {
    const organizationId = this.nextId();
    const now = this.now();
    const organization: Organization = {
      organizationId,
      name: input.name,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    const membership: OrganizationMembership = {
      organizationId,
      userId: input.createdBy,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    };
    this.orgs.set(organizationId, organization);
    this.memberships.set(input.createdBy, membership);
    return { organization, membership };
  }

  async getMembership(userId: string): Promise<OrganizationMembership | null> {
    return this.memberships.get(userId) ?? null;
  }

  async getOrganization(
    organizationId: string
  ): Promise<Organization | null> {
    return this.orgs.get(organizationId) ?? null;
  }

  async upsertMembership(input: UpsertMembershipInput): Promise<void> {
    const now = this.now();
    this.memberships.set(input.userId, {
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Convenience for tests: resolve active org in one call. */
  async getActiveOrganization(userId: string): Promise<ActiveOrganization | null> {
    const membership = await this.getMembership(userId);
    if (!membership) return null;
    const organization = await this.getOrganization(membership.organizationId);
    if (!organization) return null;
    return {
      organizationId: membership.organizationId,
      role: membership.role,
      organization,
    };
  }
}

/** Mutable default store, swappable for tests (mirrors approval store pattern). */
let defaultStore: OrgStore | undefined;

/**
 * Returns the process-wide default OrgStore.
 *
 * In production this is initialized to a Firestore-backed store by the API
 * routes at module load (see `@/lib/ai/org/firestore` `initDefaultOrgStore`).
 * In tests it is set to an `InMemoryOrgStore` via `setDefaultOrgStore`.
 *
 * Never throws a Firebase error at import time — if no store was initialized,
 * this throws a plain Error so callers fail fast and explicitly.
 */
export function getDefaultOrgStore(): OrgStore {
  if (!defaultStore) {
    throw new Error(
      "OrgStore has not been initialized. Call initDefaultOrgStore() in a server entry point, or setDefaultOrgStore() in tests."
    );
  }
  return defaultStore;
}

export function setDefaultOrgStore(store: OrgStore | undefined): void {
  defaultStore = store;
}
