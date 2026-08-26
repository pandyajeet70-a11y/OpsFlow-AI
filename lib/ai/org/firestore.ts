/**
 * lib/ai/org/firestore.ts
 *
 * Firestore-backed OrgStore (server-only, Admin SDK).
 *
 * Uses an explicit `organizationMemberships/{userId}` document so a member's
 * organization can be resolved in a single read. All reads happen server-side
 * through the Admin SDK; client writes to these collections are gated by
 * Firestore security rules (see firestore.rules).
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { OrgRole } from "../auth/types";
import type { OrgStore } from "./store";
import { setDefaultOrgStore } from "./store";
import type {
  Organization,
  OrganizationMembership,
  UpsertMembershipInput,
} from "./types";

export const ORGANIZATIONS_COLLECTION = "organizations";
export const MEMBERSHIPS_COLLECTION = "organizationMemberships";

export class FirestoreOrgStore implements OrgStore {
  private orgs() {
    return adminDb.collection(ORGANIZATIONS_COLLECTION);
  }

  private memberships() {
    return adminDb.collection(MEMBERSHIPS_COLLECTION);
  }

  async createOrganization(input: {
    name: string;
    createdBy: string;
  }): Promise<{
    organization: Organization;
    membership: OrganizationMembership;
  }> {
    const now = new Date().toISOString();
    const ref = this.orgs().doc();
    const organization: Organization = {
      organizationId: ref.id,
      name: input.name,
      createdBy: input.createdBy,
      ownerId: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(organization);

    const membership: OrganizationMembership = {
      organizationId: ref.id,
      userId: input.createdBy,
      role: "owner" as OrgRole,
      createdAt: now,
      updatedAt: now,
    };
    await this.memberships().doc(input.createdBy).set(membership);
    await ref.collection("members").doc(input.createdBy).set({
      ...membership,
      joinedAt: now,
    });

    return { organization, membership };
  }

  async getMembership(userId: string): Promise<OrganizationMembership | null> {
    const snap = await this.memberships().doc(userId).get();
    if (!snap.exists) return null;
    return snap.data() as OrganizationMembership;
  }

  async getOrganization(
    organizationId: string
  ): Promise<Organization | null> {
    const snap = await this.orgs().doc(organizationId).get();
    if (!snap.exists) return null;
    return snap.data() as Organization;
  }

  async upsertMembership(input: UpsertMembershipInput): Promise<void> {
    const now = new Date().toISOString();
    await this.memberships().doc(input.userId).set(
      {
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role as OrgRole,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: now,
      },
      { merge: true }
    );
    await this.orgs().doc(input.organizationId).collection("members").doc(input.userId).set(
      {
        ...input,
        role: input.role as OrgRole,
        joinedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }
}

/**
 * Re-register the global default org store to a Firestore-backed one.
 *
 * Called once at server module-load in the API routes so that request handlers
 * can resolve organizations without each route re-creating the store. Test
 * suites use `setDefaultOrgStore(new InMemoryOrgStore())` instead and never
 * import this module.
 */
export function initDefaultOrgStore(): void {
  setDefaultOrgStore(new FirestoreOrgStore());
}

