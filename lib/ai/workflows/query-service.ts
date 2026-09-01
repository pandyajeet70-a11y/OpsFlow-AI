import { adminDb } from "@/lib/firebase-admin";
import type { ApprovalRequest } from "@/lib/ai/approvals/types";
import type { Execution } from "@/lib/ai/executions/types";
import type { CustomerHandoff } from "@/lib/ai/onboarding/types";

export interface WorkflowDocument {
  id: string;
  [key: string]: unknown;
}

export interface WorkflowQueryOptions {
  limit?: number;
  organizationId?: string;
}

function normalize(value: unknown): unknown {
  if (value && typeof value === "object") {
    const candidate = value as { toDate?: () => Date };
    if (typeof candidate.toDate === "function") return candidate.toDate().toISOString();
    if (Array.isArray(value)) return value.map(normalize);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalize(entry)])
    );
  }
  return value;
}

async function listCollection(
  collection: string,
  options: WorkflowQueryOptions = {},
  orderField = "createdAt"
): Promise<WorkflowDocument[]> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  let query: FirebaseFirestore.Query = adminDb.collection(collection);
  if (options.organizationId) query = query.where("organizationId", "==", options.organizationId);
  const snapshot = await query
    .orderBy(orderField, "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...(normalize(document.data()) as Record<string, unknown>),
  }));
}

export async function listRecentHandoffs(options?: WorkflowQueryOptions): Promise<WorkflowDocument[]> {
  return listCollection("handoffs", options);
}

export async function getHandoffById(id: string, organizationId?: string): Promise<WorkflowDocument | null> {
  const document = await adminDb.collection("handoffs").doc(id).get();
  return document.exists && (!organizationId || document.data()?.organizationId === organizationId)
    ? { id: document.id, ...(normalize(document.data()) as Record<string, unknown>) }
    : null;
}

export async function listOnboardingPlans(options?: WorkflowQueryOptions): Promise<WorkflowDocument[]> {
  return listCollection("onboardingPlans", options);
}

export async function listOnboardingTasks(options?: WorkflowQueryOptions): Promise<WorkflowDocument[]> {
  return listCollection("onboardingTasks", options);
}

export async function listExecutions(options?: WorkflowQueryOptions): Promise<Execution[]> {
  return (await listCollection("executions", options)) as unknown as Execution[];
}

export async function listWorkflows(options?: WorkflowQueryOptions): Promise<WorkflowDocument[]> {
  return listCollection("workflows", options);
}

export async function listUserCollection(
  collection: string,
  userId: string,
  options: WorkflowQueryOptions = {},
  orderField = "createdAt"
): Promise<WorkflowDocument[]> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  let query: FirebaseFirestore.Query = adminDb.collection(collection)
    .where("userId", "==", userId);
  if (options.organizationId) query = query.where("organizationId", "==", options.organizationId);
  const snapshot = await query
    .orderBy(orderField, "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...(normalize(document.data()) as Record<string, unknown>),
  }));
}

export async function getExecutionDetails(id: string, organizationId?: string): Promise<Execution | null> {
  const document = await adminDb.collection("executions").doc(id).get();
  return document.exists && (!organizationId || document.data()?.organizationId === organizationId)
    ? ({ id: document.id, ...(normalize(document.data()) as Record<string, unknown>) } as unknown as Execution)
    : null;
}

export async function listApprovals(options?: WorkflowQueryOptions): Promise<ApprovalRequest[]> {
  return (await listCollection("approvals", options)) as unknown as ApprovalRequest[];
}

export async function listWorkflowEvents(options?: WorkflowQueryOptions): Promise<WorkflowDocument[]> {
  return listCollection("workflowEvents", options);
}

export async function listAuditRecords(options?: WorkflowQueryOptions): Promise<WorkflowDocument[]> {
  return listCollection("auditEvents", options, "timestamp");
}

export async function getApprovalById(id: string, organizationId?: string): Promise<WorkflowDocument | null> {
  const document = await adminDb.collection("approvals").doc(id).get();
  return document.exists && (!organizationId || document.data()?.organizationId === organizationId)
    ? { id: document.id, ...(normalize(document.data()) as Record<string, unknown>) }
    : null;
}

export type { ApprovalRequest, CustomerHandoff, Execution };
