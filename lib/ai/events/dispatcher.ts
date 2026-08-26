import { adminDb } from "@/lib/firebase-admin";
import type {
  WorkflowEvent,
  WorkflowEventHandler,
  WorkflowEventName,
  WorkflowEventPayloads,
} from "./types";

const handlers = new Map<WorkflowEventName, Set<WorkflowEventHandler<WorkflowEventName>>>();

export function registerEventHandler<Name extends WorkflowEventName>(
  name: Name,
  handler: WorkflowEventHandler<Name>
): void {
  const registered = handlers.get(name) ?? new Set();
  registered.add(handler as WorkflowEventHandler<WorkflowEventName>);
  handlers.set(name, registered);
}

async function ensureEventHandlersLoaded(): Promise<void> {
  try {
    await import("./customer-success-handler");
  } catch (error) {
    console.error("[workflow-events] failed to load handlers:", error);
  }
}

export async function emitWorkflowEvent<Name extends WorkflowEventName>(
  name: Name,
  payload: WorkflowEventPayloads[Name]
): Promise<{ eventId: string; handlerCount: number; failedHandlers: number }> {
  const event: WorkflowEvent<Name> = {
    eventId: `wfe_${crypto.randomUUID()}`,
    name,
    payload,
    createdAt: new Date().toISOString(),
  };

  try {
    await adminDb.collection("workflowEvents").doc(event.eventId).set({
      ...event,
      ...("organizationId" in event.payload && event.payload.organizationId
        ? { organizationId: event.payload.organizationId }
        : {}),
    });
  } catch (error) {
    console.error(`[workflow-events] failed to persist ${name}:`, error);
  }

  await ensureEventHandlersLoaded();
  const registered = Array.from(handlers.get(name) ?? []);
  const results = await Promise.allSettled(
    registered.map((handler) => handler(event))
  );
  const failedHandlers = results.filter((result) => result.status === "rejected").length;
  if (failedHandlers > 0) {
    console.error(
      `[workflow-events] ${failedHandlers} handler(s) failed for ${name}`
    );
  }

  return {
    eventId: event.eventId,
    handlerCount: registered.length,
    failedHandlers,
  };
}

export type {
  WorkflowEvent,
  WorkflowEventHandler,
  WorkflowEventName,
  WorkflowEventPayloads,
} from "./types";
