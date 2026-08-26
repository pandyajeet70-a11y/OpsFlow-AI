"use client";

import Link from 'next/link';
import { ArrowRight, Bot, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_35%),#030712] px-4 py-8 text-slate-100">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-cyan-400/30 bg-cyan-400/15 p-2">
            <Bot className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200">OPSFLOW AI</p>
            <p className="text-xs text-slate-400">Password recovery</p>
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-semibold text-white">Reset your password</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">Enter your email and we’ll send the recovery link instantly.</p>

        <form className="mt-8 space-y-4">
          <label className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="mb-2 flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" /> Email</span>
            <input className="w-full border-none bg-transparent text-white outline-none" placeholder="you@company.com" />
          </label>

          <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-medium text-slate-950">
            Send reset link <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Remembered it?{' '}
          <Link href="/signin" className="text-cyan-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
