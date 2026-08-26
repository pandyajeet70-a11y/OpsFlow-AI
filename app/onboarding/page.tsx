"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Play, ShieldCheck } from "lucide-react";
import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { authFetch } from "@/lib/client/auth";

type Progress = { step: number; integrationSkipped?: boolean; demoCreated?: boolean; completed?: boolean };
const steps = ["Welcome", "Workspace", "Integrations", "Demo workflow"];

export default function OnboardingPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [progress, setProgress] = useState<Progress>({ step: 0 });
  const [message, setMessage] = useState("");
  useEffect(() => { void authFetch("/api/onboarding").then((response) => response.json()).then((body: { data?: Progress }) => setProgress(body.data ?? { step: 0 })).catch(() => setMessage("Unable to load onboarding progress.")); }, []);

  async function save(next: Partial<Progress>) {
    const response = await authFetch("/api/onboarding", { method: "PUT", body: JSON.stringify({ ...progress, ...next }) });
    if (!response.ok) { setMessage("Unable to save progress."); return; }
    const body = await response.json() as { data: Progress };
    setProgress(body.data);
  }

  async function seedDemo() {
    const response = await authFetch("/api/demo/seed", { method: "POST" });
    if (!response.ok) { setMessage("Demo mode is available in development only."); return; }
    await save({ step: 4, demoCreated: true });
    setMessage("Demo workspace created.");
  }

  return <AuthGuard><AppShell><div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[.28em] text-cyan-300">First-run setup</p><h1 className="mt-2 text-3xl font-semibold text-white">Build your operating layer</h1><p className="mt-3 max-w-2xl text-slate-300">Connect your team, choose how much automation to allow, and see one governed workflow in motion.</p></div><ShieldCheck className="h-10 w-10 text-cyan-300" /></div>
    <div className="mt-8 grid gap-2 sm:grid-cols-4">{steps.map((label, index) => <div key={label} className={`border-t-2 pt-3 text-sm ${progress.step >= index ? "border-cyan-300 text-white" : "border-white/10 text-slate-500"}`}><span className="mr-2">{index + 1}</span>{label}</div>)}</div>
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-sm uppercase tracking-[.18em] text-slate-500">Step {Math.min(progress.step + 1, 4)} of 4</p>{progress.step === 0 && <><h2 className="mt-3 text-2xl font-semibold text-white">Welcome to OpsFlow AI</h2><p className="mt-3 max-w-xl leading-7 text-slate-300">Sales signals become customer-success handoffs, onboarding actions, and measurable execution. Every mutating action can pause for human approval.</p><button onClick={() => void save({ step: 1 })} className="action-button mt-6 inline-flex items-center gap-2">Set up workspace <ArrowRight className="h-4 w-4" /></button></>}{progress.step === 1 && <><h2 className="mt-3 text-2xl font-semibold text-white">Workspace ready</h2><p className="mt-3 text-slate-300">Your organization and role permissions are active. Owners and admins can configure integrations; operators can monitor them.</p><button onClick={() => void save({ step: 2 })} className="action-button mt-6">Continue</button></>}{progress.step === 2 && <><h2 className="mt-3 text-2xl font-semibold text-white">Choose your integrations</h2><p className="mt-3 text-slate-300">Configure secure server-side credentials in Settings, or skip this optional step and use mock providers while evaluating the product.</p><div className="mt-6 flex flex-wrap gap-3">{can("manage_organization") && <button onClick={() => router.push("/dashboard/settings")} className="action-button">Configure in Settings</button>}<button onClick={() => void save({ step: 3, integrationSkipped: true })} className="action-button">Skip for now</button></div></>}{progress.step >= 3 && !progress.demoCreated && <><h2 className="mt-3 text-2xl font-semibold text-white">See a governed workflow</h2><p className="mt-3 text-slate-300">Seed isolated sample workflows, approvals, executions, integrations, and activity only when explicitly requested in development or demo mode.</p><button onClick={() => void seedDemo()} className="action-button mt-6 inline-flex items-center gap-2"><Play className="h-4 w-4" /> Create demo workspace</button></>}{progress.demoCreated && <><h2 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-white"><Check className="h-6 w-6 text-emerald-300" /> You are ready</h2><p className="mt-3 text-slate-300">Your setup is complete. Open the dashboard to review workflow health and activity.</p><button onClick={() => { void save({ completed: true, step: 4 }); router.push("/dashboard"); }} className="action-button mt-6">Open dashboard</button></>}</div>
    {message && <p className="mt-4 text-sm text-cyan-200">{message}</p>}
  </div></AppShell></AuthGuard>;
}
