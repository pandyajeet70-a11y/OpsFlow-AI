"use client";

import { Bell, ClipboardCheck, FileText, ListChecks, LogOut, Menu, Search, Settings, Activity, Workflow } from "lucide-react";
import { ReactNode } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "./auth-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { user } = useAuth();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/signin");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const displayName =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "User";

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6">
          {/* LEFT */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200 transition hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-sm text-slate-400">
                Operations workspace
              </p>

              <h1 className="text-xl font-semibold text-white">
                Executive overview
              </h1>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* SEARCH */}
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 sm:flex">
              <Search className="h-4 w-4 text-slate-400" />

              <input
                type="text"
                placeholder="Search"
                className="w-32 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            {/* NOTIFICATION */}
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 p-3 text-slate-300 transition hover:bg-white/10"
            >
              <Bell className="h-5 w-5" />
            </button>

            {/* PROFILE */}
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-2 py-2">
              {/* AVATAR */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-semibold text-white">
                {initial}
              </div>

              {/* USER INFO */}
              <div className="hidden pr-1 sm:block">
                <p className="max-w-[140px] truncate text-sm font-medium text-white">
                  {displayName}
                </p>

                <p className="max-w-[180px] truncate text-xs text-slate-400">
                  {user?.email || "No email"}
                </p>
              </div>

              {/* LOGOUT */}
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="rounded-full p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
        <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
          {[
            ["/dashboard", "Dashboard", Workflow],
            ["/dashboard/handoffs", "Handoffs", FileText],
            ["/dashboard/executions", "Executions", Activity],
            ["/dashboard/approvals", "Approvals", ClipboardCheck],
            ["/dashboard/activity", "Activity", ListChecks],
            ["/dashboard/settings", "Settings", Settings],
          ].map(([href, label, Icon]) => (
            <Link key={href as string} href={href as string} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition ${pathname === href ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="h-4 w-4" />{label as string}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}