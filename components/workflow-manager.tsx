"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react";
import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import type {
  ActivityItem,
  NotificationItem,
  UserProfile,
  WorkflowItem,
} from "@/hooks/useDashboardData";
import { authFetch, responseError } from "@/lib/client/auth";

const emptyForm = {
  name: "",
  description: "",
  trigger: "",
  triggerType: "manual" as WorkflowTriggerType,
  actionsText: "",
};

type WorkflowFormState = typeof emptyForm;

type WorkflowManagerProps = {
  workflows: WorkflowItem[];
  activity: ActivityItem[];
  notifications: NotificationItem[];
  currentUser: User | null;
  profile: UserProfile | null;
};

type WorkflowTriggerType = "manual" | "new_customer";

type WorkflowExecutionStatus =
  | "running"
  | "completed"
  | "failed";

type WorkflowWebhookAction = {
  type: "webhook";
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
};

type WorkflowAction = string | WorkflowWebhookAction;

type WorkflowExecutionItem = {
  id: string;
  workflowId: string;
  userId?: string;
  workflowName?: string;
  status?: WorkflowExecutionStatus | "not_started";
  startedAt?: unknown;
  completedAt?: unknown;
  currentAction?: string | null;
  totalActions?: number;
  completedActions?: number;
  errorMessage?: string | null;
};

const formatTimestamp = (value: unknown) => {
  if (!value) return "—";

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

  if (typeof value === "number") {
    return new Date(value).toLocaleString();
  }

  return "—";
};

const toActionList = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const isWebhookAction = (
  action: unknown
): action is WorkflowWebhookAction => {
  if (!action || typeof action !== "object") {
    return false;
  }

  const candidate = action as Record<string, unknown>;

  return (
    candidate.type === "webhook" &&
    typeof candidate.url === "string" &&
    (candidate.method === undefined ||
      candidate.method === "GET" ||
      candidate.method === "POST")
  );
};

const getActionLabel = (action: WorkflowAction) => {
  if (typeof action === "string") {
    return action;
  }

  return `${action.method ?? "GET"} ${action.url}`;
};

const executeAction = async (
  _action: WorkflowAction,
  _workflowName: string,
  _userId: string,
  _executionId: string
): Promise<void> => {
  throw new Error(
    "Workflow execution is disabled in the browser. Workflow actions must be executed by the server."
  );
};

const addActivity = async (
  userId: string,
  message: string
) => {
  if (!userId) return;

  await addDoc(collection(db, "activity"), {
    userId,
    message,
    timestamp: serverTimestamp(),
  });
};

export default function WorkflowManager({
  workflows,
  activity,
  notifications,
  currentUser,
  profile,
}: WorkflowManagerProps) {
  const { can } = useAuth();
  const [form, setForm] = useState<WorkflowFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [executionMap, setExecutionMap] = useState<
    Record<string, WorkflowExecutionItem>
  >({});
  const runningWorkflowIdsRef = useRef<Set<string>>(new Set());
  const processedCustomerProfilesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser?.uid || !profile?.uid) {
      return;
    }

    if (processedCustomerProfilesRef.current.has(profile.uid)) {
      return;
    }

    const matchingNewCustomerWorkflows = workflows.filter(
      (workflow) =>
        workflow.userId === currentUser.uid &&
        workflow.triggerType === "new_customer"
    );

    if (matchingNewCustomerWorkflows.length === 0) {
      processedCustomerProfilesRef.current.add(profile.uid);
      return;
    }

    processedCustomerProfilesRef.current.add(profile.uid);

    const triggerEvent = async () => {
      for (const workflow of matchingNewCustomerWorkflows) {
        if (runningWorkflowIdsRef.current.has(workflow.id)) {
          continue;
        }

        await addActivity(
          currentUser.uid,
          `Automatic trigger started for workflow "${workflow.name}".`
        );

        await handleRun(workflow);
      }
    };

    void triggerEvent();
  }, [currentUser?.uid, profile?.uid, workflows]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setExecutionMap({});
      return;
    }

    const executionsQuery = query(
      collection(db, "workflowExecutions"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      executionsQuery,
      (snapshot) => {
        const nextExecutionMap: Record<string, WorkflowExecutionItem> = {};

        snapshot.docs.forEach((document) => {
          const item = document.data() as Record<string, unknown>;
          const workflowId =
            typeof item.workflowId === "string"
              ? item.workflowId
              : document.id;

          const execution: WorkflowExecutionItem = {
            id: document.id,
            workflowId,
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
                ? (item.status as WorkflowExecutionStatus)
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

          nextExecutionMap[workflowId] = execution;
        });

        setExecutionMap(nextExecutionMap);
      },
      (err) => {
        console.error("Failed to load workflow executions:", err);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowCreateForm(false);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!currentUser) {
      setError("You must be logged in to create a workflow.");
      return;
    }

    const name = form.name.trim();
    const description = form.description.trim();
    const trigger = form.trigger.trim();
    const actions = toActionList(form.actionsText);
    const triggerType = form.triggerType;

    if (!name) {
      setError("Workflow name is required.");
      return;
    }

    if (!description) {
      setError("Workflow description is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        const response = await authFetch(`/api/workflows/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, trigger: trigger || "Manual trigger", triggerType, actions, status: form.trigger ? "active" : "paused" }),
        });
        if (!response.ok) throw await responseError(response, "Unable to update workflow.");

        await addActivity(
          currentUser.uid,
          `Workflow "${name}" was updated.`
        );

        setSuccess("Workflow updated successfully.");
      } else {
        const response = await authFetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, trigger: trigger || "Manual trigger", triggerType, actions }),
        });
        if (!response.ok) throw await responseError(response, "Unable to create workflow.");

        await addActivity(
          currentUser.uid,
          `Workflow "${name}" was created.`
        );

        setSuccess("Workflow created successfully.");
      }

      resetForm();
    } catch (err) {
      console.error("Workflow save failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save workflow."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (workflow: WorkflowItem) => {
    setEditingId(workflow.id);
    setShowCreateForm(true);
    setError("");
    setSuccess("");
    setForm({
      name: workflow.name || "",
      description: workflow.description || "",
      trigger: workflow.trigger || "",
      triggerType: workflow.triggerType || "manual",
      actionsText: (workflow.actions || [])
        .map((action) =>
          typeof action === "string"
            ? action
            : getActionLabel(action)
        )
        .join("\n"),
    });
  };

  const handleToggleStatus = async (
    workflow: WorkflowItem
  ) => {
    if (!currentUser || workflow.userId !== currentUser.uid) {
      setError("You can only update your own workflow.");
      return;
    }

    const nextStatus =
      workflow.status === "active" ? "paused" : "active";

    setBusyId(workflow.id);
    setError("");
    setSuccess("");

    try {
      const response = await authFetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw await responseError(response, "Unable to update workflow status.");

      await addActivity(
        currentUser.uid,
        `Workflow "${workflow.name}" was ${nextStatus}.`
      );

      setSuccess(`Workflow set to ${nextStatus}.`);
    } catch (err) {
      console.error("Failed to toggle workflow status:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update workflow status."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (workflow: WorkflowItem) => {
    if (!currentUser || workflow.userId !== currentUser.uid) {
      setError("You can only delete your own workflow.");
      return;
    }

    const confirmed = window.confirm(
      `Delete workflow "${workflow.name}"?`
    );

    if (!confirmed) return;

    setBusyId(workflow.id);
    setError("");
    setSuccess("");

    try {
      const response = await authFetch(`/api/workflows/${workflow.id}`, { method: "DELETE" });
      if (!response.ok) throw await responseError(response, "Unable to delete workflow.");
      await addActivity(
        currentUser.uid,
        `Workflow "${workflow.name}" was deleted.`
      );
      setSuccess("Workflow deleted.");
    } catch (err) {
      console.error("Failed to delete workflow:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete workflow."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRun = async (workflow: WorkflowItem) => {
    if (!currentUser || workflow.userId !== currentUser.uid) {
      setError("You can only run your own workflow.");
      return;
    }

    setBusyId(workflow.id);
    setError(
      "Workflow execution is disabled in the browser. Workflow execution must be initiated by the server."
    );
    setSuccess("");
    setTimeout(() => setBusyId(null), 1500);
  };

  return (
    <div className="mt-5 space-y-4">
      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      {showCreateForm ? (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          onSubmit={handleSubmit}
          className="space-y-3 rounded-[1.4rem] border border-white/10 bg-white/5 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">
              {editingId ? "Edit workflow" : "Create workflow"}
            </p>

            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 transition hover:text-white"
            >
              Cancel
            </button>
          </div>

          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-slate-400">Workflow name</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white outline-none placeholder:text-slate-500"
              placeholder="Customer onboarding"
              required
            />
          </label>

          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-slate-400">Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white outline-none placeholder:text-slate-500"
              placeholder="Describe the workflow goal and what it automates."
              required
            />
          </label>

          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-slate-400">Trigger</span>
            <input
              value={form.trigger}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  trigger: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white outline-none placeholder:text-slate-500"
              placeholder="New signup, daily sync, webhook"
            />
          </label>

          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-slate-400">Trigger type</span>
            <select
              value={form.triggerType}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  triggerType: event.target.value as WorkflowTriggerType,
                }))
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white outline-none"
            >
              <option value="manual">Manual</option>
              <option value="new_customer">New customer</option>
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            <span className="mb-2 block text-slate-400">Actions</span>
            <textarea
              value={form.actionsText}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  actionsText: event.target.value,
                }))
              }
              className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white outline-none placeholder:text-slate-500"
              placeholder="One action per line or comma separated"
            />
          </label>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Close
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting
                ? editingId
                  ? "Saving..."
                  : "Creating..."
                : editingId
                  ? "Save changes"
                  : "Create workflow"}
            </button>
          </div>
        </motion.form>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          {workflows.length} workflow{workflows.length === 1 ? "" : "s"}
        </p>

        {can("manage_workflows") ? <button
          type="button"
          onClick={() => {
            setShowCreateForm((previous) => !previous);
            if (!showCreateForm) {
              setError("");
              setSuccess("");
              setEditingId(null);
              setForm(emptyForm);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/15"
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? "Hide form" : "Create workflow"}
        </button> : null}
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          No workflows yet. Create your first workflow to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow) => {
            const execution = executionMap[workflow.id];
            const totalActions = workflow.actions?.length ?? 0;
            const completedActions = execution?.completedActions ?? 0;
            const currentAction = execution?.currentAction ?? null;
            const executionStatus = execution?.status ?? "not_started";

            return (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
                      <Workflow className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="font-medium text-white">{workflow.name}</p>
                      <p className="text-xs text-slate-400">
                        {workflow.trigger || "Manual trigger"} · {workflow.triggerType === "new_customer" ? "New customer" : "Manual"}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      workflow.status === "active"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {workflow.status}
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {workflow.description || "No description provided."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(workflow.actions || []).length > 0 ? (
                    (workflow.actions || []).map((action, index) => (
                      <span
                        key={`${workflow.id}-${String(action)}-${index}`}
                        className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-300"
                      >
                        {typeof action === "string"
                          ? action
                          : getActionLabel(action)}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-400">
                      No actions yet
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <span>
                      {executionStatus === "not_started"
                        ? "Not started"
                        : executionStatus}
                    </span>
                    <span>
                      {completedActions}/{totalActions}
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                      style={{
                        width: `${
                          totalActions > 0
                            ? (completedActions / totalActions) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-sm text-slate-300">
                    {executionStatus === "running" && currentAction
                      ? `Current action: ${currentAction}`
                      : executionStatus === "completed"
                        ? "Execution complete."
                        : executionStatus === "failed"
                          ? execution?.errorMessage || "Execution failed."
                          : "Waiting to run."}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>{workflow.actions?.length || 0} action(s)</span>
                  <span>Updated {formatTimestamp(workflow.updatedAt)}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {can("manage_workflows") ? <button
                    type="button"
                    onClick={() => handleEdit(workflow)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button> : null}

                  {can("manage_workflows") ? <button
                    type="button"
                    onClick={() => handleToggleStatus(workflow)}
                    disabled={busyId === workflow.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {workflow.status === "active" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {workflow.status === "active" ? "Pause" : "Activate"}
                  </button> : null}

                  {can("manage_workflows") ? <button
                    type="button"
                    onClick={() => handleRun(workflow)}
                    disabled={
                      busyId === workflow.id ||
                      runningWorkflowIdsRef.current.has(workflow.id)
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Play className="h-4 w-4" />
                    {runningWorkflowIdsRef.current.has(workflow.id)
                      ? "Running..."
                      : "Run workflow"}
                  </button> : null}

                  <button
                    type="button"
                    onClick={() => handleDelete(workflow)}
                    disabled={busyId === workflow.id}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {activity.length > 0 ? (
        <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            Activity snapshot
          </p>

          <div className="space-y-2">
            {activity.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
              >
                {item.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            Alerts
          </p>

          <div className="space-y-2">
            {notifications.slice(0, 2).map((notification) => (
              <div
                key={notification.id}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
              >
                <p className="font-medium text-white">{notification.title}</p>
                <p className="mt-1 text-slate-400">{notification.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
