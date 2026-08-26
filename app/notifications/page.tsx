"use client";

import { motion } from 'framer-motion';
import { Bell, CheckCircle2, Clock3, Sparkles } from 'lucide-react';
import AppShell from '@/components/app-shell';

const notifications = [
  { title: 'System health restored', body: 'Your AI agent returned to normal operating thresholds.', time: '3 min ago' },
  { title: 'Workflow review required', body: 'A launch sequence needs an approval before it continues.', time: '18 min ago' },
  { title: 'Revenue signal detected', body: 'A new expansion opportunity crossed the target threshold.', time: '1 hr ago' },
];

export default function NotificationsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Notifications</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Stay aligned without the noise.</h2>
              <p className="mt-3 max-w-2xl text-slate-300">Chronological updates, action prompts, and health signals delivered in a calm interface.</p>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">Live center</div>
          </div>
        </motion.section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-cyan-200">
            <Bell className="h-4 w-4" />
            <span className="text-sm uppercase tracking-[0.3em]">Incoming updates</span>
          </div>
          <div className="mt-5 space-y-3">
            {notifications.map((item, index) => (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.06 }} key={item.title} className="flex items-start justify-between gap-4 rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200"><Sparkles className="h-4 w-4" /></div>
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-7 text-slate-400">{item.body}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock3 className="h-4 w-4" /> {item.time}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-cyan-200">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm uppercase tracking-[0.3em]">Queue health</span>
          </div>
          <div className="mt-4 rounded-[1.3rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            4 items require review and 2 are ready to publish. Everything else is running smoothly.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
