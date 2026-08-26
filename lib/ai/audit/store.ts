/**
 * lib/ai/audit/store.ts
 *
 * Audit persistence contract plus an in-memory implementation for offline
 * testing.
 *
 * SECURITY:
 *  - Audit records are APPEND-ONLY: there is no update or delete method on the
 *    store. This is the structural guarantee that prevents an actor from
 *    altering (or _forging_) history after the fact.
 *  - Reads are TENANT-SCOPED: `queryByOrganization(organizationId)` only ever
 *    returns events whose `organizationId` matches. `queryAll` exists only for
 *    the test harness / super-admin tooling and is not wired to any client.
 *
 * Intentionally dependency-free (no Firebase at import time) so the offline
 * test harness can exercise audit recording without a real Firebase project.
 */

import type { AuditEvent, AuditQuery, AuditEventType } from "./types";

/** Persistence contract for the audit trail. */
export interface AuditStore {
  /** Append a single event. Implementations must not mutate it afterwards. */
  record(event: AuditEvent): Promise<void>;

  /**
   * Tenant-scoped read: only events belonging to `organizationId` are returned
   * (newest first by default). Never returns another org's events.
   */
  queryByOrganization(
    organizationId: string,
    opts?: AuditQuery
  ): Promise<AuditEvent[]>;

  /**
   * Unscoped read for tests / super-admin tooling only. NOT exposed to clients.
   */
  queryAll(opts?: AuditQuery): Promise<AuditEvent[]>;
}

/* ------------------------------------------------------------------
   In-memory store (offline tests / default during development)
   ------------------------------------------------------------------ */

export class InMemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async queryByOrganization(
    organizationId: string,
    opts?: AuditQuery
  ): Promise<AuditEvent[]> {
    return applyQuery(
      this.events.filter((e) => e.organizationId === organizationId),
      opts
    );
  }

  async queryAll(opts?: AuditQuery): Promise<AuditEvent[]> {
    return applyQuery(this.events, opts);
  }

  /** Test helper: count events (optionally by type / org). */
  count(opts?: { eventType?: AuditEventType; organizationId?: string }): number {
    return this.events.filter(
      (e) =>
        (opts?.eventType ? e.eventType === opts.eventType : true) &&
        (opts?.organizationId ? e.organizationId === opts.organizationId : true)
    ).length;
  }
}

/** Shared, dependency-free query filtering (newest first). */
function applyQuery(events: AuditEvent[], opts?: AuditQuery): AuditEvent[] {
  let out = events.slice();
  if (opts?.eventType) out = out.filter((e) => e.eventType === opts!.eventType);
  if (opts?.from) out = out.filter((e) => e.timestamp >= opts!.from!);
  if (opts?.to) out = out.filter((e) => e.timestamp <= opts!.to!);
  out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  if (opts?.limit !== undefined) out = out.slice(0, opts.limit);
  return out;
}

/* ------------------------------------------------------------------
   Global default store (mirrors the approval-store pattern)
   ------------------------------------------------------------------ */

let defaultStore: AuditStore = new InMemoryAuditStore();

/** Returns the process-wide default AuditStore (never throws). */
export function getDefaultAuditStore(): AuditStore {
  return defaultStore;
}

/**
 * Swap the process-wide default AuditStore.
 *  - Production API routes call `initDefaultAuditStore()` (Firestore-backed).
 *  - Tests call `setDefaultAuditStore(new InMemoryAuditStore())`.
 * Passing `undefined` restores the in-memory default.
 */
export function setDefaultAuditStore(store: AuditStore | undefined): void {
  defaultStore = store ?? new InMemoryAuditStore();
}