"use client";

import { motion } from 'framer-motion';
import { ArrowRight, Lock, Palette, ShieldCheck, Zap } from 'lucide-react';
import AppShell from '@/components/app-shell';
import AuthGuard from '@/components/auth-guard';
import Link from 'next/link';

const settings = [
  { title: 'Security posture', desc: 'Protect your workspace with SSO and role-based governance.', icon: ShieldCheck },
  { title: 'Automation defaults', desc: 'Tune AI execution preferences for your operating model.', icon: Zap },
  { title: 'Visual language', desc: 'Adjust the interface to better match your team brand.', icon: Palette },
];

export default function SettingsPage() {
  return (
    <AuthGuard><AppShell>
      <div className="space-y-6">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Settings</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Configure the platform to fit your operating model.</h2>
              <p className="mt-3 max-w-2xl text-slate-300">Fine-tune security, automation, and visual defaults with the same elegance as the rest of the product.</p>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">Updated 2 mins ago</div>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:grid-cols-3">
          {settings.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.08 }} key={item.title} className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
                <div className="mb-4 inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200"><Icon className="h-5 w-5" /></div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{item.desc}</p>
              </motion.article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-cyan-200">
            <Lock className="h-4 w-4" />
            <span className="text-sm uppercase tracking-[0.3em]">Security center</span>
          </div>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-white">Role-based access and audit trails are active.</h3>
              <p className="mt-2 text-slate-300">Every change stays reviewable, secure, and ready for governance review.</p>
            </div>
            <Link href="/dashboard/settings" className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-medium text-cyan-100">
              Review controls <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </AppShell></AuthGuard>
  );
}
