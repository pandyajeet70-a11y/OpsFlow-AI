"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import { auth } from "@/lib/firebase";
import { authFetch, responseError } from "@/lib/client/auth";

type Notification = {
  id: string;
  title?: string;
  message?: string;
  read?: boolean;
};

export default function NotificationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      void authFetch("/api/dashboard/data", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw await responseError(response, "Unable to load notifications.");
        const body = await response.json() as { data?: { notifications?: Notification[] } };
        setNotifications(body.data?.notifications ?? []);
      }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load notifications.")).finally(() => setLoading(false));
    });
    return () => {
      unsubscribeAuth();
    };
  }, []);

  const markRead = async (notificationId: string) => {
    if (!user) return;
    try {
      const response = await authFetch(`/api/notifications/${notificationId}`, { method: "PATCH" });
      if (!response.ok) throw await responseError(response, "Unable to update notification.");
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read: true } : item));
    } catch {
      setError("Unable to update notification.");
    }
  };

  return <AuthGuard><AppShell><div className="space-y-6">
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Notifications</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Workspace updates</h2>
      <p className="mt-3 max-w-2xl text-slate-300">Review alerts and mark them complete as your team responds.</p>
    </section>
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
      <div className="flex items-center gap-2 text-cyan-200"><Bell className="h-4 w-4" /><span className="text-sm uppercase tracking-[0.3em]">Incoming updates</span></div>
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="mt-5 text-sm text-slate-400">Loading notifications...</p> : notifications.length === 0 ? <p className="mt-5 text-sm text-slate-500">No notifications for this workspace.</p> : <div className="mt-5 space-y-3">{notifications.map((item) => <div key={item.id} className={`flex items-start justify-between gap-4 rounded-[1.3rem] border p-4 ${item.read ? "border-white/10 bg-white/5" : "border-cyan-400/20 bg-cyan-400/5"}`}><div className="flex items-start gap-3"><div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200"><Sparkles className="h-4 w-4" /></div><div><p className="font-medium text-white">{item.title || "Notification"}</p><p className="mt-1 text-sm leading-7 text-slate-400">{item.message || "Workspace update"}</p></div></div><div className="flex shrink-0 items-center gap-2 text-sm text-slate-400"><Clock3 className="h-4 w-4" />{!item.read ? <button type="button" onClick={() => void markRead(item.id)} className="text-cyan-300 hover:text-cyan-100">Mark read</button> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}</div></div>)}</div>}
    </section>
  </div></AppShell></AuthGuard>;
}
