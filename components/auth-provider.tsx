"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import { authFetch } from "@/lib/client/auth";
import type { OrgRole } from "@/lib/ai/auth/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  role: OrgRole | null;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, role: null, can: () => false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<OrgRole | null>(null);
  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next); setLoading(false);
    if (next) void authFetch("/api/organization").then((response) => response.json()).then((body: { data?: { role?: OrgRole } }) => setRole(body.data?.role ?? null)).catch(() => setRole(null));
    else setRole(null);
  }), []);
  const can = (permission: string) => user?.getIdTokenResult && (user as User & { claims?: { admin?: boolean } }).claims?.admin === true || role === "owner" || role === "admin" || (role === "customer_success" && ["view_workflows", "manage_onboarding", "retry_actions", "view_audit"].includes(permission)) || (role === "sales" && ["view_workflows", "create_leads", "create_handoffs", "manage_handoffs"].includes(permission)) || (role === "viewer" && ["view_workflows", "view_audit", "view_integrations"].includes(permission)) || false;
  return <AuthContext.Provider value={{ user, loading, role, can }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function RedirectAuthenticated({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, router, user]);
  if (loading || user) return null;
  return <>{children}</>;
}
