import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { assertStatusTransition } from "./status";
import { getExecutionDetails } from "./query-service";
import type { HandoffStatus, OnboardingPlanStatus, OnboardingTaskStatus } from "./status";

const collections = {
  handoff: "handoffs",
  onboardingPlan: "onboardingPlans",
  onboardingTask: "onboardingTasks",
} as const;

type Resource = keyof typeof collections;
type Status = HandoffStatus | OnboardingPlanStatus | OnboardingTaskStatus;

export async function updateWorkflowStatus(
  resource: Resource,
  id: string,
  nextStatus: Status
): Promise<Record<string, unknown>> {
  if (!id.trim()) throw new Error("Resource ID is required.");
  const reference = adminDb.collection(collections[resource]).doc(id);
  const result = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error("Workflow resource was not found.");
    const currentStatus = snapshot.data()?.status;
    if (typeof currentStatus !== "string") throw new Error("Workflow resource status is invalid.");
    assertStatusTransition(resource, currentStatus, nextStatus);
    transaction.update(reference, {
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ...snapshot.data(), id, status: nextStatus };
  });
  return result as Record<string, unknown>;
}

export async function getRetryEligibility(executionId: string, actionId: string, organizationId?: string) {
  const execution = await getExecutionDetails(executionId, organizationId);
  const action = execution?.actions?.find((candidate) => candidate.actionId === actionId);
  if (!action) return { eligible: false, attempt: 0, maxAttempts: 0, status: "missing" as const };
  return {
    eligible: action.status === "failed" && action.attempt < action.maxAttempts,
    attempt: action.attempt,
    maxAttempts: action.maxAttempts,
    status: action.status,
    lastError: action.lastError,
  };
}
