"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { auth } from "@/lib/firebase";
import { authFetch } from "@/lib/client/auth";

type OrganizationData = { organization?: { name?: string }; role?: string; members?: Array<{ id: string; role?: string; userId?: string }> };
type Integration = { id: string; name: string; provider: string; status: "enabled" | "disabled"; configured?: boolean; metadata?: Record<string, unknown>; lastTestedAt?: string };

export default function SettingsPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [provider, setProvider] = useState("webhook");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [message, setMessage] = useState("");
  const canView = can("view_integrations");
  const canManage = can("manage_organization");

  async function loadIntegrations() {
    if (!canView) return;
    const response = await authFetch("/api/organization/integrations");
    const body = await response.json() as { data?: Integration[] };
    setIntegrations(body.data ?? []);
  }

  useEffect(() => {
    void authFetch("/api/organization").then((response) => response.json()).then((body: { data: OrganizationData }) => setOrganization(body.data)).catch(() => setOrganization(null));
    void loadIntegrations().catch(() => setIntegrations([]));
  }, [canView]);

  async function createIntegration() {
    setMessage("");
    const response = await authFetch("/api/organization/integrations", { method: "POST", body: JSON.stringify({ provider, name: name || provider, metadata: endpoint ? { endpoint } : {} }) });
    setMessage(response.ok ? "Integration saved." : "Unable to save integration.");
    if (response.ok) { setName(""); setEndpoint(""); await loadIntegrations(); }
  }

  async function updateIntegration(integration: Integration, enabled: boolean) {
    const response = await authFetch(`/api/organization/integrations/${integration.id}`, { method: "PUT", body: JSON.stringify({ enabled }) });
    setMessage(response.ok ? "Integration updated." : "Unable to update integration.");
    if (response.ok) await loadIntegrations();
  }

  async function testIntegration(integration: Integration) {
    const response = await authFetch(`/api/organization/integrations/${integration.id}/test`, { method: "POST" });
    const body = await response.json() as { data?: { status?: string } };
    setMessage(response.ok ? `Connection test: ${body.data?.status ?? "complete"}.` : "Unable to test integration.");
    if (response.ok) await loadIntegrations();
  }

  return <AuthGuard><AppShell><div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
    <p className="text-xs uppercase tracking-[.28em] text-cyan-300">Workspace settings</p>
    <h1 className="mt-2 text-2xl font-semibold text-white">Profile and access</h1>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[.18em] text-slate-500">Display name</p><p className="mt-2 text-white">{user?.displayName || "User"}</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/5 bg-white/5 p-5"><p className="text-xs uppercase tracking-[.18em] text-slate-500">Email</p><p className="mt-2 text-white">{user?.email || "-"}</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[.18em] text-slate-500">Active organization</p><p className="mt-2 text-white">{organization?.organization?.name || "Loading..."}</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-[.18em] text-slate-500">Role</p><p className="mt-2 text-white">{organization?.role || "Loading..."}</p></div>
    </div>
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm font-medium text-white">Members</p><div className="mt-3 space-y-2">{organization?.members?.length ? organization.members.map((member) => <div key={member.id} className="flex justify-between text-sm text-slate-300"><span>{member.userId || member.id}</span><span className="text-slate-500">{member.role || "viewer"}</span></div>) : <p className="text-sm text-slate-500">No member records yet.</p>}</div></div>
    {canView && <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium text-white">Integrations</p><span className="text-xs text-slate-500">Credentials stay server-side</span></div>
      {canManage && <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Connection name" className="field" /><select value={provider} onChange={(event) => setProvider(event.target.value)} className="field"><option value="webhook">Webhook</option><option value="email">Email</option><option value="crm">CRM</option></select><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="Safe endpoint metadata" className="field" /><button onClick={() => void createIntegration()} className="action-button">Add</button></div>}
      <div className="mt-4 space-y-2">{integrations.length ? integrations.map((integration) => <div key={integration.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-3 text-sm"><div><span className="font-medium text-white">{integration.name}</span><span className="ml-3 text-slate-500">{integration.provider}</span><span className="ml-3 text-slate-400">{integration.configured ? "Configured" : "Mock fallback"}</span><span className="ml-3 text-slate-500">{integration.lastTestedAt ? new Date(integration.lastTestedAt).toLocaleString() : "Not tested"}</span></div>{canManage && <div className="flex gap-2"><button onClick={() => void updateIntegration(integration, integration.status !== "enabled")} className="action-button">{integration.status === "enabled" ? "Disable" : "Enable"}</button><button onClick={() => void testIntegration(integration)} className="action-button">Test</button></div>}</div>) : <p className="text-sm text-slate-500">No integrations configured.</p>}</div>
      {message && <p className="mt-3 text-sm text-cyan-200">{message}</p>}
    </div>}
    <button onClick={async () => { await signOut(auth); router.replace("/signin"); }} className="action-button mt-6 text-rose-200">Sign out</button>
  </div></AppShell></AuthGuard>;
}
