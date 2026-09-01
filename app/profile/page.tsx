"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Mail,
  ShieldCheck,
} from "lucide-react";

import AuthGuard from "@/components/auth-guard";
import AppShell from "@/components/app-shell";
import { auth } from "@/lib/firebase";
import { authFetch, responseError } from "@/lib/client/auth";
import { updateProfile } from "firebase/auth";

type ProfileData = {
  name?: string;
  email?: string;
  company?: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      void authFetch("/api/profile", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw await responseError(response, "Unable to load profile.");
        const data = (await response.json() as { data?: ProfileData | null }).data;
        setProfile(data ?? null); setName(data?.name ?? currentUser.displayName ?? ""); setCompanyName(data?.company ?? "");
      }).catch((cause) => { setProfile(null); setMessage(cause instanceof Error ? cause.message : "Unable to load profile."); }).finally(() => setLoading(false));
    });

    return () => {
      authUnsubscribe();
    };
  }, []);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      const nextName = name.trim() || "User";
      const nextCompany = companyName.trim() || nextName;
      await updateProfile(user, { displayName: nextName });
      const response = await authFetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nextName, company: nextCompany }) });
      if (!response.ok) throw await responseError(response, "Unable to save profile.");
      setProfile({ name: nextName, company: nextCompany, email: user.email ?? "" });
      setEditing(false);
      setMessage("Profile saved.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    profile?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "User";

  const email =
    profile?.email ||
    user?.email ||
    "No email";

  const company =
    profile?.company ||
    "No company added";

  return (
    <AuthGuard><AppShell>
      <div className="space-y-6">

        {/* HEADER */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            Profile
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            {loading ? "Loading..." : displayName}
          </h1>

          <p className="mt-2 text-slate-400">
            {company}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            <BadgeCheck className="h-4 w-4" />
            Verified operator
          </div>
        </motion.section>

        {/* ACCOUNT + CONTACT */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">

          {/* ACCOUNT SUMMARY */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2 text-cyan-200">
              <BadgeCheck className="h-4 w-4" />

              <span className="text-sm uppercase tracking-[0.3em]">
                Account summary
              </span>
            </div>

            <div className="mt-5 space-y-3">

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Name
                </p>

                <p className="mt-1 text-sm text-white">
                  {loading ? "Loading..." : displayName}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Company
                </p>

                <p className="mt-1 text-sm text-white">
                  {loading ? "Loading..." : company}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Account status
                </p>

                <p className="mt-1 text-sm text-emerald-300">
                  Active
                </p>
              </div>

            </div>
          </motion.div>

          {/* CONTACT */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2 text-cyan-200">
              <Mail className="h-4 w-4" />

              <span className="text-sm uppercase tracking-[0.3em]">
                Contact
              </span>
            </div>

            <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Email
              </p>

              <p className="mt-2 break-all text-sm text-slate-200">
                {loading ? "Loading..." : email}
              </p>
            </div>

            <button
              type="button"
              onClick={() => { setMessage(""); setEditing((value) => !value); }}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-medium text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Edit profile
              <ArrowRight className="h-4 w-4" />
            </button>
            {editing ? <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="field w-full" required />
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company" className="field w-full" />
              <button type="submit" disabled={saving} className="action-button disabled:opacity-60">{saving ? "Saving..." : "Save profile"}</button>
            </form> : null}
            {message ? <p className="mt-3 text-sm text-cyan-200">{message}</p> : null}
          </motion.div>
        </section>

        {/* SECURITY */}
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-cyan-200">
            <ShieldCheck className="h-4 w-4" />

            <span className="text-sm uppercase tracking-[0.3em]">
              Security preference
            </span>
          </div>

          <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            Your account is protected by Firebase Authentication.
          </div>
        </section>

      </div>
    </AppShell></AuthGuard>
  );
}
