"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  company?: string;
  createdAt?: unknown;
};

export type DashboardStats = {
  revenue: number;
  totalUsers: number;
  activeWorkflows: number;
};

export type WorkflowWebhookAction = {
  type: "webhook";
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
};

export type WorkflowAction = string | WorkflowWebhookAction;

export type WorkflowTriggerType = "manual" | "new_customer";

export type WorkflowItem = {
  id: string;
  userId?: string;
  name?: string;
  description?: string;
  trigger?: string;
  triggerType?: WorkflowTriggerType;
  actions?: WorkflowAction[];
  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ActivityItem = {
  id: string;
  userId?: string;
  message?: string;
  timestamp?: unknown;
};

export type NotificationItem = {
  id: string;
  userId?: string;
  title?: string;
  message?: string;
  read?: boolean;
  timestamp?: unknown;
};

export type ExecutionHistoryItem = {
  id: string;
  workflowId?: string;
  userId?: string;
  workflowName?: string;
  status?: "running" | "completed" | "failed" | "not_started";
  startedAt?: unknown;
  completedAt?: unknown;
  currentAction?: string | null;
  totalActions?: number;
  completedActions?: number;
  errorMessage?: string | null;
};

/* =========================================================
   HELPERS
========================================================= */

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "");
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const getTimestampMs = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };

    if (typeof candidate.toMillis === "function") {
      return candidate.toMillis();
    }

    if (typeof candidate.seconds === "number") {
      return (
        candidate.seconds * 1000 +
        (candidate.nanoseconds ?? 0) / 1_000_000
      );
    }
  }

  return 0;
};

/*
 * Finds a Firestore field without depending on exact
 * capitalization, spaces, underscores, etc.
 *
 * Examples:
 * revenue
 * Revenue
 * REVENUE
 * revenue_
 * totalUsers
 * total_users
 */
const getField = (
  data: Record<string, unknown>,
  target: string
): unknown => {
  const normalize = (value: string) =>
    value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

  const wanted = normalize(target);

  const entry = Object.entries(data).find(([key]) => {
    return normalize(key) === wanted;
  });

  return entry ? entry[1] : undefined;
};

/* =========================================================
   MAIN HOOK
========================================================= */

export function useDashboardData() {
  const [currentUser, setCurrentUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [stats, setStats] =
    useState<DashboardStats | null>(null);

  const [workflows, setWorkflows] =
    useState<WorkflowItem[]>([]);

  const [activity, setActivity] =
    useState<ActivityItem[]>([]);

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [executionHistory, setExecutionHistory] =
    useState<ExecutionHistoryItem[]>([]);

  const [executionHistoryError, setExecutionHistoryError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let activeProfileUnsubscribe:
      (() => void) | undefined;

    let activeOverviewUnsubscribe:
      (() => void) | undefined;

    let activeWorkflowsUnsubscribe:
      (() => void) | undefined;

    let activeActivityUnsubscribe:
      (() => void) | undefined;

    let activeNotificationsUnsubscribe:
      (() => void) | undefined;

    let activeExecutionHistoryUnsubscribe:
      (() => void) | undefined;

    /* =====================================================
       CLEAR LISTENERS
    ===================================================== */

    const clearListeners = () => {
      activeProfileUnsubscribe?.();
      activeOverviewUnsubscribe?.();
      activeWorkflowsUnsubscribe?.();
      activeActivityUnsubscribe?.();
      activeNotificationsUnsubscribe?.();
      activeExecutionHistoryUnsubscribe?.();

      activeProfileUnsubscribe = undefined;
      activeOverviewUnsubscribe = undefined;
      activeWorkflowsUnsubscribe = undefined;
      activeActivityUnsubscribe = undefined;
      activeNotificationsUnsubscribe = undefined;
      activeExecutionHistoryUnsubscribe = undefined;
    };

    /* =====================================================
       ERROR HANDLER
    ===================================================== */

    const handleError = (
      context: string,
      err: unknown
    ) => {
      console.error(
        `❌ FIRESTORE ${context.toUpperCase()} ERROR:`,
        err
      );

      setError(
        `Unable to load ${context.toLowerCase()}.`
      );
    };

    /* =====================================================
       AUTH LISTENER
    ===================================================== */

    const authUnsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        clearListeners();

        /* -----------------------------------------------
           NO USER
        ------------------------------------------------ */

        if (!user) {
          setCurrentUser(null);
          setProfile(null);
          setStats(null);
          setWorkflows([]);
          setActivity([]);
          setNotifications([]);
          setExecutionHistory([]);
          setExecutionHistoryError(null);
          setLoading(false);
          setError(null);

          return;
        }

        /* -----------------------------------------------
           USER FOUND
        ------------------------------------------------ */

        console.log(
          "🔥 AUTH USER:",
          user.uid
        );

        console.log(
          "📧 USER EMAIL:",
          user.email
        );

        setCurrentUser(user);
        setLoading(true);
        setError(null);

        /* =================================================
           USER PROFILE
        ================================================= */

        const profileRef = doc(
          db,
          "users",
          user.uid
        );

        activeProfileUnsubscribe =
          onSnapshot(
            profileRef,
            (snapshot) => {
              console.log(
                "👤 PROFILE EXISTS:",
                snapshot.exists()
              );

              if (!snapshot.exists()) {
                setProfile(null);
                return;
              }

              const profileData =
                snapshot.data() as UserProfile;

              console.log(
                "👤 PROFILE DATA:",
                profileData
              );

              setProfile(profileData);
              setLoading(false);
            },
            (err) => {
              handleError("profile", err);
              setLoading(false);
            }
          );

        /* =================================================
           DASHBOARD OVERVIEW

           Firestore:
           dashboard
              └── overview
                   ├── revenue
                   ├── totalUsers
                   └── activeWorkflows
        ================================================= */

        const overviewRef = doc(
          db,
          "dashboard",
          "overview"
        );

        activeOverviewUnsubscribe =
          onSnapshot(
            overviewRef,
            (snapshot) => {
              console.log(
                "🔥 FIRESTORE OVERVIEW LISTENER FIRED"
              );

              console.log(
                "🔥 OVERVIEW EXISTS:",
                snapshot.exists()
              );

              /* -----------------------------------------
                 DOCUMENT DOES NOT EXIST
              ------------------------------------------ */

              if (!snapshot.exists()) {
                console.error(
                  "❌ dashboard/overview DOES NOT EXIST"
                );

                setStats({
                  revenue: 0,
                  totalUsers: 0,
                  activeWorkflows: 0,
                });

                return;
              }

              /* -----------------------------------------
                 GET COMPLETE FIRESTORE DATA

                 IMPORTANT:
                 We use snapshot.data().
                 No snapshot.get().
              ------------------------------------------ */

              const overviewData =
                snapshot.data() as Record<
                  string,
                  unknown
                >;

              console.log(
                "🔥 OVERVIEW RAW DATA:",
                overviewData
              );

              console.log(
                "🔥 OVERVIEW KEYS:",
                Object.keys(overviewData)
              );

              /* -----------------------------------------
                 READ REVENUE
              ------------------------------------------ */

              const revenueRaw = getField(
                overviewData,
                "revenue"
              );

              /* -----------------------------------------
                 READ TOTAL USERS
              ------------------------------------------ */

              const totalUsersRaw = getField(
                overviewData,
                "totalUsers"
              );

              /* -----------------------------------------
                 READ ACTIVE WORKFLOWS
              ------------------------------------------ */

              const activeWorkflowsRaw =
                getField(
                  overviewData,
                  "activeWorkflows"
                );

              console.log(
                "💰 REVENUE RAW:",
                revenueRaw
              );

              console.log(
                "💰 REVENUE TYPE:",
                typeof revenueRaw
              );

              console.log(
                "👥 TOTAL USERS RAW:",
                totalUsersRaw
              );

              console.log(
                "⚙️ ACTIVE WORKFLOWS RAW:",
                activeWorkflowsRaw
              );

              /* -----------------------------------------
                 CONVERT VALUES TO NUMBERS
              ------------------------------------------ */

              const revenue = toNumber(
                revenueRaw,
                0
              );

              const totalUsers = toNumber(
                totalUsersRaw,
                0
              );

              const activeWorkflows = toNumber(
                activeWorkflowsRaw,
                0
              );

              console.log(
                "💰 REVENUE AFTER CONVERSION:",
                revenue
              );

              console.log(
                "👥 TOTAL USERS AFTER CONVERSION:",
                totalUsers
              );

              console.log(
                "⚙️ ACTIVE WORKFLOWS AFTER CONVERSION:",
                activeWorkflows
              );

              /* -----------------------------------------
                 FINAL DASHBOARD STATS
              ------------------------------------------ */

              const newStats: DashboardStats = {
                revenue,
                totalUsers,
                activeWorkflows,
              };

              console.log(
                "📊 FINAL DASHBOARD STATS:",
                newStats
              );

              setStats(newStats);
            },
            (err) => {
              handleError(
                "overview",
                err
              );
            }
          );

        /* =================================================
           WORKFLOWS
        ================================================= */

        const workflowsQuery = query(
          collection(db, "workflows"),
          where(
            "userId",
            "==",
            user.uid
          )
        );

        activeWorkflowsUnsubscribe =
          onSnapshot(
            workflowsQuery,
            (snapshot) => {
              console.log(
                "⚙️ WORKFLOWS COUNT:",
                snapshot.size
              );

              const next: WorkflowItem[] =
                snapshot.docs
                  .map((document) => {
                    const item =
                      document.data() as Record<
                        string,
                        unknown
                      >;

                    const triggerType: WorkflowTriggerType =
                      item.triggerType === "new_customer"
                        ? "new_customer"
                        : "manual";

                    return {
                      id: document.id,

                      userId:
                        typeof item.userId ===
                        "string"
                          ? item.userId
                          : undefined,

                      name:
                        typeof item.name ===
                        "string"
                          ? item.name
                          : "Untitled workflow",

                      description:
                        typeof item.description ===
                        "string"
                          ? item.description
                          : "",

                      trigger:
                        typeof item.trigger ===
                        "string"
                          ? item.trigger
                          : "Manual trigger",

                      triggerType,

                      actions:
                        Array.isArray(item.actions)
                          ? item.actions.filter(
                              (
                                action
                              ): action is WorkflowAction =>
                                typeof action === "string" ||
                                (typeof action === "object" &&
                                  action !== null &&
                                  (action as Record<string, unknown>)
                                    .type === "webhook" &&
                                  typeof (action as Record<string, unknown>)
                                    .url === "string")
                            )
                          : [],

                      status:
                        typeof item.status ===
                        "string"
                          ? item.status
                          : "Unknown",

                      createdAt:
                        item.createdAt,

                      updatedAt:
                        item.updatedAt ??
                        item.createdAt,
                    };
                  })
                  .sort(
                    (left, right) =>
                      getTimestampMs(
                        right.createdAt
                      ) -
                      getTimestampMs(
                        left.createdAt
                      )
                  );

              setWorkflows(next);
            },
            (err) => {
              handleError(
                "workflows",
                err
              );
            }
          );

        /* =================================================
           ACTIVITY
        ================================================= */

        const activityQuery = query(
          collection(db, "activity"),
          where(
            "userId",
            "==",
            user.uid
          )
        );

        activeActivityUnsubscribe =
          onSnapshot(
            activityQuery,
            (snapshot) => {
              console.log(
                "📢 ACTIVITY COUNT:",
                snapshot.size
              );

              const next: ActivityItem[] =
                snapshot.docs
                  .map((document) => {
                    const item =
                      document.data() as Record<
                        string,
                        unknown
                      >;

                    return {
                      id: document.id,

                      userId:
                        typeof item.userId ===
                        "string"
                          ? item.userId
                          : undefined,

                      message:
                        typeof item.message ===
                        "string"
                          ? item.message
                          : "Activity update",

                      timestamp:
                        item.timestamp,
                    };
                  })
                  .sort(
                    (left, right) =>
                      getTimestampMs(
                        right.timestamp
                      ) -
                      getTimestampMs(
                        left.timestamp
                      )
                  );

              setActivity(next);
            },
            (err) => {
              handleError(
                "activity",
                err
              );
            }
          );

        /* =================================================
           NOTIFICATIONS
        ================================================= */

        const notificationsQuery =
          query(
            collection(
              db,
              "notifications"
            ),
            where(
              "userId",
              "==",
              user.uid
            )
          );

        activeNotificationsUnsubscribe =
          onSnapshot(
            notificationsQuery,
            (snapshot) => {
              console.log(
                "🔔 NOTIFICATIONS COUNT:",
                snapshot.size
              );

              const next: NotificationItem[] =
                snapshot.docs
                  .map((document) => {
                    const item =
                      document.data() as Record<
                        string,
                        unknown
                      >;

                    return {
                      id: document.id,

                      userId:
                        typeof item.userId ===
                        "string"
                          ? item.userId
                          : undefined,

                      title:
                        typeof item.title ===
                        "string"
                          ? item.title
                          : "Notification",

                      message:
                        typeof item.message ===
                        "string"
                          ? item.message
                          : "New update",

                      read: Boolean(
                        item.read
                      ),

                      timestamp:
                        item.timestamp,
                    };
                  })
                  .sort(
                    (left, right) =>
                      getTimestampMs(
                        right.timestamp
                      ) -
                      getTimestampMs(
                        left.timestamp
                      )
                  );

              setNotifications(next);
            },
            (err) => {
              handleError(
                "notifications",
                err
              );
            }
          );

        const executionHistoryQuery = query(
          collection(db, "workflowExecutions"),
          where("userId", "==", user.uid)
        );

        activeExecutionHistoryUnsubscribe =
          onSnapshot(
            executionHistoryQuery,
            (snapshot) => {
              const next: ExecutionHistoryItem[] =
                snapshot.docs
                  .map((document) => {
                    const item =
                      document.data() as Record<
                        string,
                        unknown
                      >;

                    return {
                      id: document.id,
                      workflowId:
                        typeof item.workflowId === "string"
                          ? item.workflowId
                          : undefined,
                      userId:
                        typeof item.userId === "string"
                          ? item.userId
                          : undefined,
                      workflowName:
                        typeof item.workflowName === "string"
                          ? item.workflowName
                          : "Workflow",
                      status:
                        typeof item.status === "string"
                          ? (item.status as ExecutionHistoryItem["status"])
                          : "not_started",
                      startedAt: item.startedAt,
                      completedAt: item.completedAt,
                      currentAction:
                        typeof item.currentAction === "string"
                          ? item.currentAction
                          : null,
                      totalActions:
                        typeof item.totalActions === "number"
                          ? item.totalActions
                          : undefined,
                      completedActions:
                        typeof item.completedActions === "number"
                          ? item.completedActions
                          : 0,
                      errorMessage:
                        typeof item.errorMessage === "string"
                          ? item.errorMessage
                          : null,
                    };
                  })
                  .sort(
                    (left, right) =>
                      getTimestampMs(right.startedAt) -
                      getTimestampMs(left.startedAt)
                  )
                  .slice(0, 10);

              setExecutionHistory(next);
              setExecutionHistoryError(null);
            },
            (err) => {
              console.error(
                "❌ FIRESTORE WORKFLOW EXECUTIONS ERROR:",
                err
              );
              setExecutionHistoryError(
                "Unable to load execution history."
              );
            }
          );
      }
    );

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      clearListeners();
      authUnsubscribe();
    };
  }, []);

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    currentUser,
    profile,
    stats,
    workflows,
    activity,
    notifications,
    executionHistory,
    executionHistoryError,
    loading,
    error,
  };
}

export default useDashboardData;