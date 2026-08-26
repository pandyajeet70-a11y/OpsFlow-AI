/**
 * lib/ai/audit/index.ts
 *
 * Public surface for the Phase 4 audit trail & security observability layer.
 */
export * from "./types";
export {
  InMemoryAuditStore,
  getDefaultAuditStore,
  setDefaultAuditStore,
} from "./store";
export type { AuditStore } from "./store";
export {
  AuditService,
  getDefaultAuditService,
  setDefaultAuditService,
} from "./service";
export type { AuditRecordInput } from "./service";
export {
  FirestoreAuditStore,
  AUDIT_EVENTS_COLLECTION,
  initDefaultAuditStore,
} from "./firestore-store";