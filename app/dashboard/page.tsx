"use client";

import { useState } from "react";
import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import StatsCard from "@/components/stats-card";
import WorkflowManager from "@/components/workflow-manager";
import useDashboardData from "@/hooks/useDashboardData";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  CircleDollarSign,
  Clock3,
  Users,
  Workflow,
} from "lucide-react";
import useWorkflowDashboard from "@/hooks/useWorkflowDashboard";
import { authFetch, formatApiError, responseError } from "@/lib/client/auth";
import { fetchDashboardSummary } from "@/lib/client/workflow-api";
import { resolveToolId } from "@/lib/ai/tools/registry";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

type WorkflowSuggestion = {
  trigger: "manual" | "new_customer";
  triggerLabel: string;
  actions: string[];
};

type AssistantAction = "health" | "workflow" | "activity";

type ExecutionSummary = {
  status?: string;
  workflowName?: string;
  currentAction?: string | null;
};

const parseWorkflowPrompt = (
  prompt: string
): WorkflowSuggestion => {
  const normalized = prompt.trim();

  if (!normalized) {
    return {
      trigger: "manual",
      triggerLabel: "Manual",
      actions: [],
    };
  }

  const lower = normalized.toLowerCase();

  const trigger: "manual" | "new_customer" =
    /new customer|new user|customer joins|new signup|customer created|user signup|user joins/.test(
      lower
    )
      ? "new_customer"
      : "manual";

  const suggestions: string[] = [];

  if (/create\s+(?:customer\s+)?profile|create\s+profile/.test(lower)) {
    suggestions.push("Create customer profile");
  }

  if (/send\s+welcome\s+email|email\s+customer/.test(lower)) {
    suggestions.push("Send welcome email");
  }

  if (/notify|alert/.test(lower)) {
    suggestions.push("Notify team");
  }

  if (/assign|route/.test(lower)) {
    suggestions.push("Assign owner");
  }

  if (/update|sync/.test(lower)) {
    suggestions.push("Sync customer record");
  }

  if (suggestions.length === 0) {
    suggestions.push("Review request");
  }

  return {
    trigger,
    triggerLabel:
      trigger === "new_customer"
        ? "New customer"
        : "Manual",
    actions: suggestions.map((action) => resolveToolId(action) ?? action),
  };
};

const formatExecutionTimestamp = (value: unknown) => {
  if (!value) {
    return "—";
  }

  if (typeof value === "number") {
    return new Date(value).toLocaleString();
  }

  if (typeof value === "object") {
    const candidate = value as {
      toDate?: () => Date;
      seconds?: number;
    };

    if (typeof candidate.toDate === "function") {
      return candidate.toDate().toLocaleString();
    }

    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000).toLocaleString();
    }
  }

  return "—";
};

export default function DashboardPage() {
  const {
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
  } = useDashboardData();
  const workflowDashboard = useWorkflowDashboard();
  const [assistantAction, setAssistantAction] = useState<AssistantAction | null>(null);
  const [assistantResult, setAssistantResult] = useState<string | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderMessage, setBuilderMessage] = useState("");

  const [builderPrompt, setBuilderPrompt] =
    useState(
      "when a new customer joins create customer profile"
    );

  const [builderSuggestion, setBuilderSuggestion] =
    useState<WorkflowSuggestion>(() =>
      parseWorkflowPrompt(
        "when a new customer joins create customer profile"
      )
    );

  const runAssistantAction = async (action: AssistantAction) => {
    setAssistantAction(action);
    setAssistantResult(null);
    setAssistantError(null);

    try {
      if (action === "health") {
        const summary = await fetchDashboardSummary();
        const { metrics } = summary;
        setAssistantResult(
          `${metrics.pendingApprovals} pending approval(s), ${metrics.pendingTasks} pending task(s), and ${metrics.failedActions} failed action(s).`
        );
      } else if (action === "workflow") {
        const response = await authFetch("/api/workflow/executions?limit=10", { cache: "no-store" });
        if (!response.ok) throw await responseError(response, "Unable to check active workflows.");
        const body = (await response.json()) as { data?: ExecutionSummary[] };
        const active = (body.data ?? []).filter((execution) => ["pending", "running", "waiting_for_approval", "retrying"].includes(execution.status ?? ""));
        setAssistantResult(
          active.length
            ? `${active.length} active workflow run(s). Latest: ${active[0].workflowName || "Unnamed workflow"}${active[0].currentAction ? `, currently ${active[0].currentAction}` : "."}`
            : "No active workflow runs were found."
        );
      } else {
        const summary = await fetchDashboardSummary();
        const latest = summary.recentActivity[0];
        setAssistantResult(
          latest
            ? `Latest activity: ${String(latest.eventType ?? latest.name ?? latest.status ?? "Workflow update")}.`
            : "No recent system activity was found."
        );
      }
    } catch (cause) {
      setAssistantError(formatApiError(cause, "Unable to complete assistant check."));
    } finally {
      setAssistantAction(null);
    }
  };

  const createSuggestedWorkflow = async () => {
    setBuilderSaving(true);
    setBuilderMessage("");
    try {
      const response = await authFetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `${builderSuggestion.triggerLabel} workflow`, description: builderPrompt.trim() || "Generated workflow", trigger: builderSuggestion.triggerLabel, triggerType: builderSuggestion.trigger, actions: builderSuggestion.actions }) });
      if (!response.ok) throw await responseError(response, "Unable to create workflow.");
      setBuilderMessage("Workflow created and added to Recent Workflows.");
    } catch (cause) {
      setBuilderMessage(formatApiError(cause, "Unable to create workflow."));
    } finally {
      setBuilderSaving(false);
    }
  };

  /* =====================================================
     USER / PROFILE
  ===================================================== */

  const displayName =
    profile?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "User";

  const company =
    profile?.company || "Workspace";

  const email =
    currentUser?.email ||
    profile?.email ||
    "No email";

  /* =====================================================
     FIRESTORE DASHBOARD DATA
  ===================================================== */

  const revenue =
    stats?.revenue ?? 0;

  const totalUsers =
    stats?.totalUsers ?? 0;

  const activeWorkflows =
    stats?.activeWorkflows ?? 0;

  /* =====================================================
     RECENT WORKFLOWS
  ===================================================== */

  const recentWorkflows =
    workflows.slice(0, 3).map((item) => ({
      id: item.id,
      name:
        item.name ||
        "Untitled workflow",
      owner: displayName,
      status:
        item.status ||
        "Unknown",
    }));

  /* =====================================================
     ACTIVITY FEED
  ===================================================== */

  const activityFeed =
    activity
      .slice(0, 3)
      .map(
        (item) =>
          item.message ||
          "System update"
      );

  /* =====================================================
     TEAM MEMBERS
  ===================================================== */

  const teamMembers = [
    {
      name: displayName,
      role: company,
    },
    {
      name: "Workspace",
      role: email,
    },
    {
      name: "Realtime sync",
      role: notifications.length
        ? `${notifications.length} alert(s)`
        : "Live",
    },
  ];

  /* =====================================================
     OVERVIEW STATUS
  ===================================================== */

  const overviewStatus = loading
    ? "Loading realtime data"
    : error
      ? "Data sync issue"
      : `${formatCompactNumber(
          totalUsers
        )} profiles connected`;

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <AuthGuard>
      <AppShell>
        <div className="space-y-6">

          {/* =================================================
              EXECUTIVE OVERVIEW
          ================================================= */}

          <motion.section
            initial={{
              opacity: 0,
              y: 18,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.45,
            }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Executive overview
            </p>

            <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              Precision operations for a modern revenue engine.
            </h1>

            <p className="mt-4 max-w-3xl text-slate-300">
              Monitor growth, delegate work, and keep decision-making aligned
              across your teams.
            </p>

            <div className="mt-8 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-200">
              {overviewStatus}
            </div>
          </motion.section>

          {/* =================================================
              STATS
          ================================================= */}

          <section className="grid gap-4 lg:grid-cols-3">

            <StatsCard
              label="Net revenue"
              value={
                loading
                  ? "Loading..."
                  : formatCurrency(revenue)
              }
              delta={
                stats
                  ? "Live from dashboard overview"
                  : "Awaiting Firestore sync"
              }
              tone="cyan"
              href="/analytics"
            />

            <StatsCard
              label="Active workflows"
              value={
                loading
                  ? "Loading..."
                  : String(activeWorkflows)
              }
              delta={
                stats
                  ? "Live from dashboard overview"
                  : "Awaiting Firestore sync"
              }
              tone="violet"
              href="/dashboard/executions"
            />

            <StatsCard
              label="System users"
              value={
                loading
                  ? "Loading..."
                  : String(totalUsers)
              }
              delta={
                notifications.length
                  ? `${notifications.length} active notification(s)`
                  : "No alerts"
              }
              tone="emerald"
              href="/settings"
            />

          </section>

          <section className="rounded-[2rem] border border-cyan-400/15 bg-cyan-400/[0.06] p-6 backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-xs uppercase tracking-[.28em] text-cyan-300">Workflow observability</p><h2 className="mt-2 text-xl font-semibold text-white">Live operating picture</h2></div>
              <button type="button" onClick={() => void workflowDashboard.refresh()} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/15">Refresh</button>
            </div>
            {workflowDashboard.error ? <p className="mt-4 text-sm text-rose-300">{workflowDashboard.error}</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{Object.entries(workflowDashboard.data?.metrics ?? {}).map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs uppercase tracking-[.12em] text-slate-500">{label.replace(/[A-Z]/g, (letter) => ` ${letter}`)}</p><p className="mt-2 text-2xl font-semibold text-white">{workflowDashboard.loading ? "..." : String(value)}</p></div>)}</div>}
            <div className="mt-5 grid gap-4 lg:grid-cols-2"><div><p className="text-sm font-medium text-white">Recent activity</p><div className="mt-3 space-y-2">{(workflowDashboard.data?.recentActivity ?? []).slice(0, 3).map((item, index) => <p key={String(item.id ?? index)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">{String(item.eventType ?? item.name ?? item.status ?? "Workflow update")}</p>)}{!workflowDashboard.loading && !(workflowDashboard.data?.recentActivity.length) && <p className="text-sm text-slate-500">No recent workflow activity.</p>}</div></div><div><p className="text-sm font-medium text-white">Pending approvals</p><div className="mt-3 space-y-2">{(workflowDashboard.data?.pendingApprovals ?? []).slice(0, 3).map((item, index) => <p key={String(item.id ?? index)} className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-sm text-amber-100">{String(item.toolName ?? item.toolId ?? "Approval request")}</p>)}{!workflowDashboard.loading && !(workflowDashboard.data?.pendingApprovals.length) && <p className="text-sm text-slate-500">No pending approvals.</p>}</div></div></div>
          </section>

          {/* =================================================
              REVENUE + AI ASSISTANT
          ================================================= */}

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

            {/* REVENUE */}

            <motion.div
              initial={{
                opacity: 0,
                y: 18,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.5,
              }}
              className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                    Revenue trend
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Healthy lift across all segments
                  </h2>
                </div>

                <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-300">
                  {loading
                    ? "Syncing"
                    : "Updated live"}
                </div>

              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">

                <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-5">

                  <div className="flex items-center gap-2 text-cyan-200">
                    <CircleDollarSign className="h-4 w-4" />
                    Monthly recurring
                  </div>

                  <p className="mt-4 text-3xl font-semibold text-white">
                    {loading
                      ? "..."
                      : formatCurrency(revenue)}
                  </p>

                </div>

                <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-5">

                  <div className="flex items-center gap-2 text-cyan-200">
                    <Activity className="h-4 w-4" />
                    Connected account
                  </div>

                  <p className="mt-4 text-3xl font-semibold text-white">
                    {loading
                      ? "..."
                      : company}
                  </p>

                </div>

              </div>

              {/* Revenue visualization */}

              <div className="mt-6 flex items-end gap-2 rounded-[1.4rem] border border-white/10 bg-gradient-to-r from-cyan-500/15 via-slate-950/80 to-violet-500/15 p-5">

                {[30, 50, 42, 72, 86, 92].map(
                  (height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t-2xl bg-gradient-to-t from-cyan-500 to-violet-500"
                      style={{
                        height: `${height * 1.6}px`,
                      }}
                    />
                  )
                )}

              </div>

            </motion.div>

            {/* AI ASSISTANT */}

            <motion.div
              initial={{
                opacity: 0,
                y: 18,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.55,
                delay: 0.08,
              }}
              className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
            >

              <div className="flex items-center gap-2 text-cyan-200">

                <Bot className="h-4 w-4" />

                <span className="text-sm uppercase tracking-[0.3em]">
                  AI assistant
                </span>

              </div>

              <div className="mt-4 rounded-[1.4rem] border border-cyan-400/20 bg-cyan-400/10 p-4">

                <p className="text-sm leading-6 text-slate-300">

                  {assistantError || assistantResult || (error
                    ? "Realtime data is temporarily unavailable."
                    : `Your workspace is synced for ${displayName}. Suggested next action: review the latest ${
                        notifications.length
                          ? "alerts"
                          : "updates"
                      }.`)}

                </p>

              </div>

              <div className="mt-4 space-y-3">

                <button type="button" onClick={() => void runAssistantAction("health")} disabled={assistantAction !== null} className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60">
                  {assistantAction === "health" ? "Reviewing workspace health..." : "Review workspace health"}
                </button>

                <button type="button" onClick={() => void runAssistantAction("workflow")} disabled={assistantAction !== null} className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60">
                  {assistantAction === "workflow" ? "Checking active workflow..." : "Check active workflow"}
                </button>

                <button type="button" onClick={() => void runAssistantAction("activity")} disabled={assistantAction !== null} className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60">
                  {assistantAction === "activity" ? "Checking latest system activity..." : "Check latest system activity"}
                </button>

              </div>

            </motion.div>

          </section>

          {/* =================================================
              WORKFLOWS + ACTIVITY
          ================================================= */}

          <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">

            {/* WORKFLOWS */}

            <motion.div
              initial={{
                opacity: 0,
                y: 18,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.6,
              }}
              className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
            >

              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                    Recent workflows
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Operational momentum in motion
                  </h2>
                </div>

                <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-300">
                  {loading
                    ? "Loading"
                    : "Live"}
                </div>

              </div>

              <WorkflowManager
                workflows={workflows}
                activity={activity}
                notifications={notifications}
                currentUser={currentUser}
                profile={profile}
              />

            </motion.div>

            {/* ACTIVITY */}

            <motion.div
              initial={{
                opacity: 0,
                y: 18,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.65,
                delay: 0.05,
              }}
              className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
            >

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                    Activity feed
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Signals and updates
                  </h2>
                </div>

                <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-300">
                  Live
                </div>

              </div>

              <div className="mt-5 space-y-3">

                {activityFeed.length > 0 ? (
                  activityFeed.map(
                    (item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="flex items-start gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 p-4"
                      >

                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />

                        <p className="text-sm leading-7 text-slate-300">
                          {item}
                        </p>

                      </div>
                    )
                  )
                ) : (
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    No recent activity for this account.
                  </div>
                )}

              </div>

            </motion.div>

          </section>

          {/* =================================================
              AI WORKFLOW BUILDER
          ================================================= */}

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.68 }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  AI workflow builder
                </p>

                <h2 className="mt-2 text-xl font-semibold text-white">
                  Draft workflow ideas locally
                </h2>
              </div>

              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
                Local preview
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <textarea
                value={builderPrompt}
                onChange={(event) =>
                  setBuilderPrompt(event.target.value)
                }
                rows={4}
                className="w-full rounded-[1.3rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                placeholder="Describe a workflow in natural language..."
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setBuilderSuggestion(
                      parseWorkflowPrompt(builderPrompt)
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/15"
                >
                  Generate workflow
                </button>
              </div>

              <div className="flex items-center justify-end gap-3">
                {builderMessage ? <p className="text-sm text-cyan-200">{builderMessage}</p> : null}
                <button type="button" onClick={() => void createSuggestedWorkflow()} disabled={builderSaving || builderSuggestion.actions.length === 0} className="action-button disabled:cursor-not-allowed disabled:opacity-60">{builderSaving ? "Creating..." : "Create workflow"}</button>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Preview
                </p>

                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                    <span className="text-slate-400">Trigger:</span>{" "}
                    {builderSuggestion.triggerLabel}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                    <span className="text-slate-400">Actions:</span>
                    <ul className="mt-2 space-y-1">
                      {builderSuggestion.actions.length > 0 ? (
                        builderSuggestion.actions.map(
                          (action: string) => (
                            <li key={action} className="list-disc pl-5">
                              {action}
                            </li>
                          )
                        )
                      ) : (
                        <li className="list-disc pl-5 text-slate-400">
                          No actions suggested
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* =================================================
              EXECUTION HISTORY
          ================================================= */}

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Execution history
                </p>

                <h2 className="mt-2 text-xl font-semibold text-white">
                  Latest workflow runs
                </h2>
              </div>

              <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-300">
                {executionHistory.length} recent
              </div>
            </div>

            {executionHistoryError ? (
              <div className="mt-5 rounded-[1.2rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                {executionHistoryError}
              </div>
            ) : executionHistory.length === 0 ? (
              <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No executions yet for this workspace.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {executionHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">
                        {item.workflowName || "Workflow"}
                      </p>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${
                          item.status === "completed"
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                            : item.status === "failed"
                              ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                              : item.status === "running"
                                ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                                : "border-white/10 bg-white/5 text-slate-300"
                        }`}
                      >
                        {item.status || "not_started"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <div>
                        <span className="text-slate-400">Started:</span>{" "}
                        {formatExecutionTimestamp(item.startedAt)}
                      </div>

                      <div>
                        <span className="text-slate-400">Completed:</span>{" "}
                        {formatExecutionTimestamp(item.completedAt)}
                      </div>

                      <div>
                        <span className="text-slate-400">Progress:</span>{" "}
                        {item.completedActions ?? 0}/{item.totalActions ?? 0}
                      </div>

                      <div>
                        <span className="text-slate-400">Current:</span>{" "}
                        {item.currentAction || "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* =================================================
              TEAM MEMBERS
          ================================================= */}

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Team members
                </p>

                <h2 className="mt-2 text-xl font-semibold text-white">
                  Operations leaders in motion
                </h2>
              </div>

              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
                Connected
              </div>

            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">

              {teamMembers.map(
                (member) => (
                  <div
                    key={`${member.name}-${member.role}`}
                    className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4"
                  >

                    <div className="flex items-center gap-3">

                      <div className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 p-3 text-white">
                        <Users className="h-4 w-4" />
                      </div>

                      <div>

                        <p className="font-medium text-white">
                          {member.name}
                        </p>

                        <p className="text-sm text-slate-400">
                          {member.role}
                        </p>

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>

          </section>

        </div>
      </AppShell>
    </AuthGuard>
  );
}