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
  const [
    totalHandoffs,
    pendingHandoffs,
    onboardingPlans,
    pendingTasks,
    pendingApprovals,
    activeWorkflows,
    executions,
    approvals,
    events,
    audit,
  ] = await Promise.all([
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

  const activeExecutions = executions
    .filter((execution) => ["pending", "running", "waiting_for_approval", "retrying"].includes(execution.status))
    .map((execution) => execution as unknown as Record<string, unknown>);
  const pendingApprovalRecords = approvals
    .filter((approval) => approval.status === "pending")
    .map((approval) => approval as unknown as Record<string, unknown>);
  const failedActions = executions.reduce(
    (total, execution) =>
      total + (execution.actions?.filter((action) => action.status === "failed").length ?? 0),
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
