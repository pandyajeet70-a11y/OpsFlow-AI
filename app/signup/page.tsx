"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "@/components/auth-provider";

export default function SignUpPage() {
  const router = useRouter();

  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [authLoading, router, user]);

  if (authLoading || user) return null;

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      // 1. Create Firebase Auth account
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const user = userCredential.user;

      const name = company.trim() || "User";

      await updateProfile(user, {
        displayName: name,
      });

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        company: company.trim() || name,
        email: user.email ?? email.trim(),
        displayName: name,
        activeOrganizationId: null,
        createdAt: new Date(),
      });

      // 4. Establish server-side identity + organization, then go to dashboard.
      await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The freshly-signed-in user's ID token is the source of truth — the
          // server verifies it with the Admin SDK and ignores nothing here.
          authorization: `Bearer ${await user.getIdToken()}`,
        },
      }).catch(() => {
        /* Session bootstrap is best-effort; the dashboard will retry on demand. */
      });

      router.push("/onboarding");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* BRAND */}
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-cyan-400/30 bg-cyan-400/15 p-2">
            <Bot className="h-5 w-5 text-cyan-300" />
          </div>

          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200">
              OPSFLOW AI
            </p>

            <p className="text-xs text-slate-400">
              Secure onboarding
            </p>
          </div>
        </div>

        {/* HEADING */}
        <h1 className="mt-8 text-3xl font-semibold text-white">
          Create your workspace
        </h1>

        <p className="mt-2 text-sm leading-7 text-slate-300">
          Launch a premium AI operations environment designed
          for serious teams.
        </p>

        {/* FORM */}
        <form
          className="mt-8 grid gap-4 md:grid-cols-2"
          onSubmit={handleSubmit}
        >

          {/* COMPANY / NAME */}
          <label className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 md:col-span-2">
            <span className="mb-2 flex items-center gap-2 text-slate-400">
              <Building2 className="h-4 w-4" />
              Name / Company
            </span>

            <input
              value={company}
              onChange={(event) =>
                setCompany(event.target.value)
              }
              className="w-full border-none bg-transparent text-white outline-none"
              placeholder="Maya Chen"
            />
          </label>

          {/* EMAIL */}
          <label className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="mb-2 flex items-center gap-2 text-slate-400">
              <Mail className="h-4 w-4" />
              Work email
            </span>

            <input
              type="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="w-full border-none bg-transparent text-white outline-none"
              placeholder="you@company.com"
            />
          </label>

          {/* PASSWORD */}
          <label className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="mb-2 flex items-center gap-2 text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              Password
            </span>

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className="w-full border-none bg-transparent text-white outline-none"
              placeholder="••••••••"
            />
          </label>

          {/* ERROR */}
          {error ? (
            <p className="text-sm text-rose-400 md:col-span-2">
              {error}
            </p>
          ) : null}

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-medium text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
          >
            {loading
              ? "Creating account..."
              : "Create account"}

            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* SIGN IN */}
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}

          <Link
            href="/signin"
            className="text-cyan-300 transition hover:text-cyan-200"
          >
            Sign in
          </Link>
        </p>

      </div>
    </main>
  );
}