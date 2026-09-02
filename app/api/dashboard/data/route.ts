import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";
import { listUserCollection, listWorkflows } from "@/lib/ai/workflows/query-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const results = await Promise.allSettled([
      adminDb.collection("users").doc(context.userId).get(),
      listWorkflows({ organizationId: context.organizationId, limit: 100 }),
      listUserCollection("activity", context.userId, { limit: 100 }, "timestamp"),
      listUserCollection("notifications", context.userId, { limit: 100 }, "timestamp"),
      listUserCollection("workflowExecutions", context.userId, { limit: 10 }),
    ]);

    const getValue = <T>(index: number, fallback: T): T =>
      results[index]?.status === "fulfilled" ? (results[index].value as T) : fallback;

    const profile = getValue<{ exists: boolean; data?: () => Record<string, unknown> } | null>(0, null);
    const workflows = getValue<Array<Record<string, unknown>>>(1, []);
    const activity = getValue<Array<Record<string, unknown>>>(2, []);
    const notifications = getValue<Array<Record<string, unknown>>>(3, []);
    const executions = getValue<Array<Record<string, unknown>>>(4, []);

    return NextResponse.json({ data: {
      profile: profile && profile.exists ? { uid: context.userId, ...(profile.data?.() ?? {}) } : null,
      workflows,
      activity,
      notifications,
      executionHistory: executions,
    } });
  } catch (error) {
    if (isAuthorizationError(error)) return authorizationErrorResponse(error);
    console.error("[dashboard/data] failed", error);
    return NextResponse.json({ error: "Unable to load dashboard data." }, { status: 500 });
  }
}