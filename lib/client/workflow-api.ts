export interface DashboardSummaryResponse {
  metrics: {
    totalHandoffs: number;
    pendingHandoffs: number;
    onboardingPlans: number;
    pendingTasks: number;
    failedActions: number;
    pendingApprovals: number;
  };
  recentActivity: Array<Record<string, unknown>>;
  activeExecutions: Array<Record<string, unknown>>;
  pendingApprovals: Array<Record<string, unknown>>;
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load dashboard summary.");
  const body = (await response.json()) as { data: DashboardSummaryResponse };
  return body.data;
}
