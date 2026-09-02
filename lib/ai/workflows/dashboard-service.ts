import { adminDb } from "@/lib/firebase-admin";
import {
  listApprovals,
  listAuditRecords,
  listExecutions,
  listWorkflowEvents,
} from "./query-service";

export interface DashboardSummary {
  metrics: {
    totalHandoffs: number;
    pendingHandoffs: number;
    onboardingPlans: number;
    pendingTasks: number;
    failedActions: number;
    pendingApprovals: number;
    activeWorkflows: number;
  };
  recentActivity: Array<Record<string, unknown>>;
  activeExecutions: Array<Record<string, unknown>>;
  pendingApprovals: Array<Record<string, unknown>>;
}

async function count(collection: string, organizationId?: string, field?: string, value?: string): Promise<number> {
  let query = adminDb.collection(collection) as FirebaseFirestore.Query;
  if (organizationId) query = query.where("organizationId", "==", organizationId);
  const snapshot = await query.get();
  if (!field || value === undefined) return snapshot.size;
  return snapshot.docs.filter((document) => document.data()[field] === value).length;
}

export async function getDashboardSummary(organizationId?: string): Promise<DashboardSummary> {
  const results = await Promise.allSettled([
    count("handoffs", organizationId),
    count("handoffs", organizationId, "status", "pending"),
    count("onboardingPlans", organizationId),
    count("onboardingTasks", organizationId, "status", "pending"),
    count("approvals", organizationId, "status", "pending"),
    count("workflows", organizationId, "status", "active"),
    listExecutions({ limit: 50, organizationId }),
    listApprovals({ limit: 50, organizationId }),
    listWorkflowEvents({ limit: 15, organizationId }),
    listAuditRecords({ limit: 15, organizationId }),
  ]);

  const toNumber = (index: number, fallback = 0): number => (results[index]?.status === "fulfilled" ? Number(results[index].value ?? fallback) : fallback);
  const toArray = <T>(index: number, fallback: T[] = []): T[] => (results[index]?.status === "fulfilled" ? (results[index].value as T[] | undefined ?? fallback) : fallback);

  const totalHandoffs = toNumber(0);
  const pendingHandoffs = toNumber(1);
  const onboardingPlans = toNumber(2);
  const pendingTasks = toNumber(3);
  const pendingApprovals = toNumber(4);
  const activeWorkflows = toNumber(5);
  const executions = toArray<any>(6, []);
  const approvals = toArray<any>(7, []);
  const events = toArray<any>(8, []);
  const audit = toArray<any>(9, []);

  const activeExecutions = executions
    .filter((execution: Record<string, unknown>) => ["pending", "running", "waiting_for_approval", "retrying"].includes(String(execution.status ?? "")))
    .map((execution) => execution as unknown as Record<string, unknown>);
  const pendingApprovalRecords = approvals
    .filter((approval: Record<string, unknown>) => approval.status === "pending")
    .map((approval) => approval as unknown as Record<string, unknown>);
  const failedActions = executions.reduce(
    (total: number, execution: Record<string, unknown>) => {
      const actions = Array.isArray(execution.actions) ? execution.actions : [];
      const failedCount = actions.filter((action: unknown) => {
        if (typeof action !== "object" || action === null) return false;
        const candidate = action as { status?: unknown };
        return candidate.status === "failed";
      }).length;
      return total + failedCount;
    },
    0
  );
  const recentActivity = [
    ...events.map((event) => ({ ...event, activityType: "workflow_event" } as Record<string, unknown>)),
    ...audit.map((record) => ({ ...record, activityType: "audit" } as Record<string, unknown>)),
  ]
    .sort((left, right) => String(right.createdAt ?? right.timestamp ?? "").localeCompare(String(left.createdAt ?? left.timestamp ?? "")))
    .slice(0, 20);

  return {
    metrics: {
      totalHandoffs,
      pendingHandoffs,
      onboardingPlans,
      pendingTasks,
      failedActions,
      pendingApprovals,
      activeWorkflows,
    },
    recentActivity,
    activeExecutions,
    pendingApprovals: pendingApprovalRecords,
  };
}
