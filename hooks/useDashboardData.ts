"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { authFetch, formatApiError } from "@/lib/client/auth";
import { auth } from "@/lib/firebase";

export type UserProfile = { uid?: string; name?: string; email?: string; company?: string; createdAt?: unknown };
export type DashboardStats = { revenue: number; totalUsers: number; activeWorkflows: number };
export type WorkflowWebhookAction = { type: "webhook"; url: string; method?: "GET" | "POST"; body?: unknown };
export type WorkflowAction = string | WorkflowWebhookAction | { toolId: string; input?: Record<string, unknown> };
export type WorkflowTriggerType = "manual" | "new_customer";
export type WorkflowItem = { id: string; userId?: string; name?: string; description?: string; trigger?: string; triggerType?: WorkflowTriggerType; actions?: WorkflowAction[]; status?: string; createdAt?: unknown; updatedAt?: unknown };
export type ActivityItem = { id: string; userId?: string; message?: string; timestamp?: unknown };
export type NotificationItem = { id: string; userId?: string; title?: string; message?: string; read?: boolean; timestamp?: unknown };
export type ExecutionHistoryItem = { id: string; workflowId?: string; userId?: string; workflowName?: string; status?: string; startedAt?: unknown; completedAt?: unknown; currentAction?: string | null; totalActions?: number; completedActions?: number; errorMessage?: string | null };

type DashboardData = { profile?: UserProfile | null; workflows?: WorkflowItem[]; activity?: ActivityItem[]; notifications?: NotificationItem[]; executionHistory?: ExecutionHistoryItem[] };

export function useDashboardData() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);
  const [executionHistoryError, setExecutionHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      setCurrentUser(user);
      if (!user) {
        setProfile(null); setStats(null); setWorkflows([]); setActivity([]); setNotifications([]); setExecutionHistory([]); setLoading(false); setError(null);
        return;
      }
      setLoading(true); setError(null);
      void Promise.all([
        authFetch("/api/dashboard/data", { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error(await response.text());
          return (await response.json() as { data: DashboardData }).data;
        }),
        authFetch("/api/dashboard/summary", { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error(await response.text());
          return (await response.json() as { data: { metrics?: { activeWorkflows?: number } } }).data;
        }),
      ]).then(([data, summary]) => {
        if (!active) return;
        setProfile(data.profile ?? null); setWorkflows(data.workflows ?? []); setActivity(data.activity ?? []); setNotifications(data.notifications ?? []); setExecutionHistory(data.executionHistory ?? []); setExecutionHistoryError(null);
        setStats({ revenue: 0, totalUsers: 0, activeWorkflows: summary.metrics?.activeWorkflows ?? 0 });
      }).catch((cause) => {
        if (!active) return;
        const message = formatApiError(cause, "Unable to load dashboard data.");
        setError(message); setExecutionHistoryError(message);
      }).finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  return { currentUser, profile, stats, workflows, activity, notifications, executionHistory, executionHistoryError, loading, error };
}

export default useDashboardData;
