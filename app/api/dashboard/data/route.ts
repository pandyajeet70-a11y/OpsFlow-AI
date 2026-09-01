import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requirePermission, authorizationErrorResponse, isAuthorizationError } from "@/lib/ai/auth/authorization-server";
import { listUserCollection, listWorkflows } from "@/lib/ai/workflows/query-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission(request, "view_workflows");
    const [profile, workflows, activity, notifications, executions] = await Promise.all([
      adminDb.collection("users").doc(context.userId).get(),
      listWorkflows({ organizationId: context.organizationId, limit: 100 }),
      listUserCollection("activity", context.userId, { limit: 100 }, "timestamp"),
      listUserCollection("notifications", context.userId, { limit: 100 }, "timestamp"),
      listUserCollection("workflowExecutions", context.userId, { limit: 10 }),
    ]);
    return NextResponse.json({ data: {
      profile: profile.exists ? { uid: context.userId, ...profile.data() } : null,
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