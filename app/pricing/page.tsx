"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$49',
    desc: 'For lean teams building with AI for the first time.',
    features: ['3 active agents', 'Unlimited automations', 'Slack integration'],
    featured: false,
  },
  {
    name: 'Scale',
    price: '$149',
    desc: 'For fast-moving companies that need control and depth.',
    features: ['Unlimited workspaces', 'Custom analytics', 'Priority support'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'For global organizations with advanced governance needs.',
    features: ['Advanced security', 'Dedicated success team', 'Custom deployment'],
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#030712] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Pricing</p>
              <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">Choose the plan that matches your ambition.</h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-300">Every package includes polished AI workflows, premium support, and enterprise-grade reliability.</p>
            </div>
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-medium text-slate-950">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.article initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: index * 0.08 }} key={plan.name} className={`rounded-[2rem] border p-8 backdrop-blur-2xl ${plan.featured ? 'border-cyan-400/30 bg-gradient-to-b from-cyan-500/10 to-slate-950/70' : 'border-white/10 bg-slate-950/60'}`}>
              {plan.featured && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
                  <Sparkles className="h-4 w-4" /> Most popular
                </div>
              )}
              <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{plan.desc}</p>
              <p className="mt-6 text-4xl font-semibold text-white">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-400">per month</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-300" /> {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={`mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium ${plan.featured ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-white/10 text-slate-100'}`}>
                Choose {plan.name} <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.article>
          ))}
        </section>
      </div>
    </main>
  );
}
