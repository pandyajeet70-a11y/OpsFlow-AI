"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "./auth-provider";

type AuthGuardProps = {
  children: ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();

  const { user, loading: checking } = useAuth();
  useEffect(() => {
    if (!checking && !user) router.replace("/signin");
  }, [checking, router, user]);

  if (checking || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#030712] text-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-400">
            Checking your session...
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
