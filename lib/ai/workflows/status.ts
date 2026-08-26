export type HandoffStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type OnboardingPlanStatus = "draft" | "active" | "completed" | "cancelled";
export type OnboardingTaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

const transitions: Record<string, Record<string, readonly string[]>> = {
  handoff: {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  },
  onboardingPlan: {
    draft: ["active", "cancelled"],
    active: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  },
  onboardingTask: {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "failed", "cancelled"],
    failed: ["pending", "cancelled"],
    completed: [],
    cancelled: [],
  },
};

export function canTransitionStatus(
  resource: keyof typeof transitions,
  from: string,
  to: string
): boolean {
  return transitions[resource]?.[from]?.includes(to) ?? false;
}

export function assertStatusTransition(
  resource: keyof typeof transitions,
  from: string,
  to: string
): void {
  if (!canTransitionStatus(resource, from, to)) {
    throw new Error(`Invalid ${resource} status transition.`);
  }
}
