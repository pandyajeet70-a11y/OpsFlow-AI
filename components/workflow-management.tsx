"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Check, X, RotateCcw, ArrowLeft } from "lucide-react";
import { authFetch } from "@/lib/client/auth";
import { useAuth } from "./auth-provider";

type RecordItem = Record<string, unknown> & { id?: string };
type Mode = "handoffs" | "executions" | "approvals" | "activity";

function text(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value ? value : fallback;
}
function time(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}
function Status({ value }: { value: unknown }) {
  const status = text(value, "unknown");
  const tone = ["completed", "approved", "active"].includes(status)
    ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
    : ["failed", "rejected"].includes(status)
      ? "text-rose-300 border-rose-400/20 bg-rose-400/10"
      : "text-amber-200 border-amber-400/20 bg-amber-400/10";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[.16em] ${tone}`}>{status}</span>;
}

async function getData(url: string): Promise<RecordItem[]> {
  const response = await authFetch(url);
  if (!response.ok) throw new Error("Unable to load workflow data.");
  const body = (await response.json()) as { data?: RecordItem[] | { events?: RecordItem[]; audit?: RecordItem[] } };
  if (Array.isArray(body.data)) return body.data;
  if (body.data && "events" in body.data) return [...(body.data.events ?? []), ...(body.data.audit ?? [])];
  return [];
}

export default function WorkflowManagement({ mode, id }: { mode: Mode; id?: string }) {
  const [items, setItems] = useState<RecordItem[]>([]);
  const [detail, setDetail] = useState<RecordItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { can } = useAuth();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (id) {
        const resource = mode === "handoffs" ? "handoffs" : "executions";
        const response = await authFetch(`/api/workflow/${resource}/${id}`);
        if (!response.ok) throw new Error("Unable to load this record.");
        const body = (await response.json()) as { data: RecordItem };
        setDetail(body.data);
      } else {
        setItems(await getData(`/api/workflow/${mode}?limit=50`));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load workflow data.");
    } finally { setLoading(false); }
  }, [id, mode]);
  useEffect(() => { void load(); }, [load]);

  const approvalAction = async (approvalId: string, action: "approve" | "reject") => {
    const key = `${action}-${approvalId}`; setActionState(key); setError(null);
    try {
      const response = await authFetch(`/api/approvals/${approvalId}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error("Unable to update approval.");
      setNotice(`Approval ${action}d.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update approval."); }
    finally { setActionState(null); }
  };

  const retryAction = async (executionId: string, actionId: string) => {
    setActionState(`retry-${actionId}`); setError(null);
    try {
      const response = await authFetch(`/api/workflow/actions/${actionId}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ executionId }) });
      if (!response.ok) throw new Error("Unable to retry action.");
      setNotice("Action retry requested."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to retry action."); }
    finally { setActionState(null); }
  };

  if (loading) return <Panel><div className="animate-pulse text-sm text-slate-400">Loading workflow data...</div></Panel>;
  if (error) return <Panel><div className="flex items-center justify-between gap-4"><p className="text-sm text-rose-300">{error}</p><button onClick={() => void load()} className="icon-button" title="Retry"><RefreshCw className="h-4 w-4" /></button></div></Panel>;

  if (detail) return <Panel><div className="mb-6 flex items-center justify-between"><Link href={`/dashboard/${mode}`} className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft className="h-4 w-4" />Back</Link><Status value={detail.status} /></div><RecordDetail record={detail} /></Panel>;

  return <Panel><div className="mb-6 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.28em] text-cyan-300">Workspace data</p><h1 className="mt-2 text-2xl font-semibold text-white">{mode[0].toUpperCase() + mode.slice(1)}</h1></div><button onClick={() => void load()} className="icon-button" title="Refresh"><RefreshCw className="h-4 w-4" /></button></div>{notice && <p className="mb-4 text-sm text-emerald-300">{notice}</p>}{items.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">No {mode} found.</p> : <div className="space-y-3">{items.map((item, index) => <RecordRow key={String(item.id ?? index)} item={item} mode={mode} busy={actionState} onApproval={can("approve_actions") ? approvalAction : async () => undefined} onRetry={can("retry_actions") ? retryAction : async () => undefined} canApprove={can("approve_actions")} canRetry={can("retry_actions")} />)}</div>}</Panel>;
}

function Panel({ children }: { children: React.ReactNode }) { return <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">{children}</div>; }
function RecordRow({ item, mode, busy, onApproval, onRetry, canApprove, canRetry }: { item: RecordItem; mode: Mode; busy: string | null; onApproval: (id: string, action: "approve" | "reject") => Promise<void>; onRetry: (executionId: string, actionId: string) => Promise<void>; canApprove: boolean; canRetry: boolean }) {
  const id = text(item.id, "");
  const href = mode === "handoffs" ? `/dashboard/handoffs/${id}` : mode === "executions" ? `/dashboard/executions/${id}` : undefined;
  const heading = text(item.customerName ?? item.workflowType ?? item.name ?? item.eventType ?? item.toolName, "Workflow record");
  const content = <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-medium text-white">{heading}</p><p className="mt-1 text-sm text-slate-400">{text(item.company ?? item.toolId ?? item.name)} · {time(item.createdAt ?? item.timestamp)}</p></div><Status value={item.status} /></div>;
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{href ? <Link href={href}>{content}</Link> : content}{mode === "approvals" && canApprove && id && item.status === "pending" && <div className="mt-4 flex gap-2"><button disabled={busy !== null} onClick={() => void onApproval(id, "approve")} className="action-button text-emerald-200"><Check className="h-4 w-4" />Approve</button><button disabled={busy !== null} onClick={() => void onApproval(id, "reject")} className="action-button text-rose-200"><X className="h-4 w-4" />Reject</button></div>}{mode === "executions" && canRetry && Array.isArray(item.actions) && <div className="mt-3 space-y-2"><p className="text-xs text-slate-400">{item.actions.length} tracked action(s)</p>{item.actions.filter((action): action is Record<string, unknown> => typeof action === "object" && action !== null && !Array.isArray(action) && action.status === "failed").map((action) => <button key={String(action.actionId)} disabled={busy !== null} onClick={() => void onRetry(id, String(action.actionId))} className="action-button text-amber-200"><RotateCcw className="h-4 w-4" />Retry {String(action.actionId)}</button>)}</div>}</div>;
}
function RecordDetail({ record }: { record: RecordItem }) { return <div className="space-y-4">{Object.entries(record).filter(([key]) => key !== "id").map(([key, value]) => <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[.18em] text-slate-500">{key}</p><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-slate-200">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "-")}</pre></div>)}</div>; }
