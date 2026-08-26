"use client";

import { motion } from 'framer-motion';
import { Activity, ArrowUpRight, BarChart3, BrainCircuit, Sparkles, TrendingUp } from 'lucide-react';
import AppShell from '@/components/app-shell';

const metrics = [
  { label: 'Qualified leads', value: '1,284', delta: '+18.4%' },
  { label: 'Conversion rate', value: '9.2%', delta: '+1.1%' },
  { label: 'AI confidence', value: '96%', delta: '+3.8%' },
];

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Analytics</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Live performance intelligence</h2>
              <p className="mt-3 max-w-2xl text-slate-300">Measure growth, model confidence, and team efficiency from one intelligent view.</p>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">Updated 6 min ago</div>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:grid-cols-3">
          {metrics.map((metric, index) => (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: index * 0.08 }} key={metric.label} className="rounded-[1.4rem] border border-white/10 bg-slate-950/60 p-5 backdrop-blur-2xl">
              <p className="text-sm text-slate-400">{metric.label}</p>
              <p className="mt-4 text-3xl font-semibold text-white">{metric.value}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-cyan-200"><ArrowUpRight className="h-4 w-4" /> {metric.delta}</p>
            </motion.div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Forecast</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Revenue confidence curve</h3>
              </div>
              <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-300">Q4 outlook</div>
            </div>
            <div className="mt-6 flex items-end gap-2 rounded-[1.4rem] border border-white/10 bg-gradient-to-r from-cyan-500/15 to-violet-500/15 p-5">
              {[28, 44, 52, 71, 84, 96].map((height) => (
                <div key={height} className="h-24 flex-1 rounded-t-2xl bg-gradient-to-t from-cyan-500 to-violet-500" style={{ height: `${height * 1.6}px` }} />
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-cyan-200">
              <BrainCircuit className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.3em]">AI signals</span>
            </div>
            <div className="mt-5 space-y-3">
              {['Seasonal demand rising', 'Expansion readiness strong', 'Churn risk lowered'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{item}</div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Performance KPIs</p>
              <h3 className="mt-2 text-xl font-semibold text-white">A durable operating rhythm</h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-300">Benchmarking</div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-cyan-200"><BarChart3 className="h-4 w-4" /> Adoption</div>
              <p className="mt-4 text-2xl font-semibold text-white">87%</p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-cyan-200"><TrendingUp className="h-4 w-4" /> Score uplift</div>
              <p className="mt-4 text-2xl font-semibold text-white">+12.5%</p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-cyan-200"><Activity className="h-4 w-4" /> Execution rate</div>
              <p className="mt-4 text-2xl font-semibold text-white">91%</p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
