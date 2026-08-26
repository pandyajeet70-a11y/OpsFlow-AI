/**
 * lib/ai/audit/service.ts
 *
 * Thin, fail-safe audit emitter used across the lifecycle (routes, tool
 * executor, approval service).
 *
 * RELIABILITY: `record()` NEVER throws to the caller. Any persistence failure
 * is observed via server-side logging and the primary business operation is
 * unaffected. Observability logging therefore prefers safe-failure so a flaky
 * Firestore write can never break an AI request, a tool execution, or an
 * approval.
 *
 * SECURITY: this layer only builds events from already-verified context passed
 * in by the producer. It never fabricates `userId` / `organizationId` and never
 * inspects or persists sensitive payload content.
 */

import { AuditEvent, AuditEventType } from "./types";
import { AuditStore, getDefaultAuditStore } from "./store";

/** What a producer must supply; eventId + timestamp are server-minted. */
export type AuditRecordInput = Omit<AuditEvent, "eventId" | "timestamp">;

export class AuditService {
  constructor(private readonly store: AuditStore) {}

  /**
   * Persist an audit event. Always resolves (never rejects): a persistence
   * failure is logged and swallowed so the caller's business flow continues.
   */
  async record(input: AuditRecordInput): Promise<AuditEvent | undefined> {
    const event: AuditEvent = {
      ...input,
      eventId: `evt_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    };
    try {
      await this.store.record(event);
      return event;
    } catch (err) {
      console.error(
        `[audit] failed to persist ${event.eventType} (org=${event.organizationId ?? "?"}):`,
        err
      );
      return undefined;
    }
  }

  /** Convenience to safely fire a single typed event without branching. */
  async fire(eventType: AuditEventType, data: AuditRecordInput): Promise<void> {
    await this.record({ ...data, eventType });
  }
}

/* ------------------------------------------------------------------
   Global default service (used by routes / executor / approval service)
   ------------------------------------------------------------------ */

let defaultService: AuditService | undefined;

/** Returns the process-wide default AuditService (never throws). */
export function getDefaultAuditService(): AuditService {
  if (!defaultService) {
    // `getDefaultAuditStore` always returns a usable store (in-memory default),
    // so this never throws and never blocks business operations.
    defaultService = new AuditService(getDefaultAuditStore());
  }
  return defaultService;
}

/** Swap the process-wide default AuditService (tests). */
export function setDefaultAuditService(service: AuditService | undefined): void {
  defaultService = service;
}

export type { AuditEvent, AuditEventType, AuditStore };