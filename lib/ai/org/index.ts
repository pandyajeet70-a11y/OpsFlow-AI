/**
 * lib/ai/org/index.ts
 *
 * Public surface for the Phase 3 multi-tenant (organization) foundation.
 */

export type {
  ActiveOrganization,
  CreateOrganizationInput,
  Organization,
  OrganizationMembership,
  UpsertMembershipInput,
} from "./types";
export {
  defaultOrganizationNameForUser,
  getActiveOrganization,
  getOrCreateOrganizationForUser,
} from "./service";
export type { OrgServiceDeps } from "./service";
export {
  FirestoreOrgStore,
  ORGANIZATIONS_COLLECTION,
  MEMBERSHIPS_COLLECTION,
  initDefaultOrgStore,
} from "./firestore";
export {
  getDefaultOrgStore,
  setDefaultOrgStore,
  InMemoryOrgStore,
} from "./store";
export type { OrgStore } from "./store";
