"use client";

import { motion } from 'framer-motion';
import { ArrowRight, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import AppShell from '@/components/app-shell';
import AuthGuard from '@/components/auth-guard';

export default function BillingPage() {
  return (
    <AuthGuard><AppShell>
      <div className="space-y-6">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Billing</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Manage your subscription with confidence.</h2>
              <p className="mt-3 max-w-2xl text-slate-300">Keep your account current, unlock premium capabilities, and retain full visibility into your plan.</p>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">Enterprise plan</div>
          </div>
        </motion.section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-cyan-200">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.3em]">Payment method</span>
            </div>
            <div className="mt-6 rounded-[1.4rem] border border-cyan-400/20 bg-cyan-400/10 p-5">
              <p className="text-sm text-slate-300">Visa •••• 4242</p>
              <p className="mt-3 text-2xl font-semibold text-white">Next charge: Aug 24 • $1,490</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" disabled title="Billing provider is not configured." className="rounded-full bg-white px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">Update card</button>
              <button type="button" disabled title="Billing provider is not configured." className="rounded-full border border-white/10 bg-white/10 px-5 py-3 font-medium text-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Download invoice</button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-cyan-200">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.3em]">Coverage</span>
            </div>
            <div className="mt-5 space-y-3">
              {['Global invoicing', 'Priority support', 'SOC 2-ready controls'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{item}</div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-cyan-200">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm uppercase tracking-[0.3em]">Plan value</span>
          </div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-white">Premium access to advanced AI controls</h3>
              <p className="mt-2 text-slate-300">Scale your operations without sacrificing clarity, governance, or speed.</p>
            </div>
            <button type="button" disabled title="Billing provider is not configured." className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-medium text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
              Upgrade plan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </AppShell></AuthGuard>
  );
}
