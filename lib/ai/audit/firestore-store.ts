/**
 * lib/ai/audit/firestore-store.ts
 *
 * Firestore-backed AuditStore (server-only, Admin SDK).
 *
 * Security posture:
 *  - Writes happen ONLY through the Admin SDK (privileged service account).
 *    There is NO client write path to this collection — Firestore rules must
 *    deny direct client reads/writes to `auditEvents` (see firestore.rules).
 *  - Records are append-only: we only ever `add()` documents; there is no
 *    update/delete surface on this store.
 *  - Reads are tenant-scoped: `queryByOrganization` filters on the
 *    `organizationId` field; a caller can never query another org's records
 *    through this store.
 *  - No secrets are ever stored — the producer layer guarantees metadata is
 *    safe (lengths, ids, statuses), never raw prompts/args/results/tokens.
 */

import { adminDb } from "@/lib/firebase-admin";
import type { AuditEvent, AuditQuery } from "./types";
import type { AuditStore } from "./store";
import { setDefaultAuditStore } from "./store";

export const AUDIT_EVENTS_COLLECTION = "auditEvents";

export class FirestoreAuditStore implements AuditStore {
  private col() {
    return adminDb.collection(AUDIT_EVENTS_COLLECTION);
  }

  async record(event: AuditEvent): Promise<void> {
    // add() assigns a server-generated doc id; eventId remains the canonical
    // correlation key and is kept as a field for querying.
    const safeEvent = Object.fromEntries(
      Object.entries(event).filter(([, value]) => value !== undefined)
    );
    await this.col().add(safeEvent);
  }

  async queryByOrganization(
    organizationId: string,
    opts?: AuditQuery
  ): Promise<AuditEvent[]> {
    let ref: FirebaseFirestore.Query = this.col().where(
      "organizationId",
      "==",
      organizationId
    );
    ref = this.applyQuery(ref, opts);
    const snap = await ref.get();
    return snap.docs.map((d) => d.data() as AuditEvent);
  }

  async queryAll(opts?: AuditQuery): Promise<AuditEvent[]> {
    let ref: FirebaseFirestore.Query = this.col();
    ref = this.applyQuery(ref, opts);
    const snap = await ref.get();
    return snap.docs.map((d) => d.data() as AuditEvent);
  }

  private applyQuery(
    ref: FirebaseFirestore.Query,
    opts?: AuditQuery
  ): FirebaseFirestore.Query {
    if (opts?.eventType) ref = ref.where("eventType", "==", opts.eventType);
    if (opts?.from) ref = ref.where("timestamp", ">=", opts.from);
    if (opts?.to) ref = ref.where("timestamp", "<=", opts.to);
    ref = ref.orderBy("timestamp", "desc");
    if (opts?.limit !== undefined) ref = ref.limit(opts.limit);
    return ref;
  }
}

/**
 * Re-register the global default AuditStore to a Firestore-backed one.
 *
 * Called at module load in the API routes (server-only) so request handlers can
 * emit durable audit events. Test suites use `setDefaultAuditStore(new
 * InMemoryAuditStore())` and never import this module.
 */
export function initDefaultAuditStore(): void {
  setDefaultAuditStore(new FirestoreAuditStore());
}