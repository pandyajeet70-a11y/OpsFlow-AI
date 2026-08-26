"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Bot,
  Clock3,
  MessageCircleMore,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

const features = [
  {
    title: "Autonomous workflows",
    desc: "Coordinate operations with AI that monitors, learns, and executes with precision.",
    icon: Zap,
  },
  {
    title: "Secure decisioning",
    desc: "Keep every action visible and governed with enterprise-grade controls.",
    icon: ShieldCheck,
  },
  {
    title: "Adaptive copilots",
    desc: "Turn every team into a high-velocity operating engine with context-aware assistance.",
    icon: BrainCircuit,
  },
];

const logos = ["Notion", "Stripe", "OpenAI", "Vercel", "Datadog", "Linear"];

const testimonials = [
  {
    quote:
      "OpsFlow AI gave our leadership team a single source of truth and elevated every decision.",
    name: "Maya Chen",
    role: "Chief Operating Officer, Northstar",
  },
  {
    quote:
      "The product feels like a $100k platform, but the implementation was surprisingly simple.",
    name: "Darius Hale",
    role: "VP Strategy, Meridian Labs",
  },
  {
    quote:
      "Every workflow now runs faster, with less overhead and far better visibility.",
    name: "Nadia Brooks",
    role: "Head of Revenue Ops, Solace",
  },
];

const activityTimeline = [
  ["09:40", "AI agent resolved 14 queue escalations"],
  ["11:20", "Forecast model updated with live revenue signal"],
  ["13:05", "Cross-team handoff completed without delay"],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">

        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/60 px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-cyan-400/30 bg-cyan-400/15 p-2">
              <Bot className="h-5 w-5 text-cyan-300" />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200">
                OPSFLOW AI
              </p>

              <p className="text-xs text-slate-400">
                Enterprise intelligence for modern operators
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm text-slate-300">
            <Link
              href="#platform"
              className="transition hover:text-white"
            >
              Platform
            </Link>

            <Link
              href="/pricing"
              className="transition hover:text-white"
            >
              Pricing
            </Link>

            <Link
              href="#customers"
              className="transition hover:text-white"
            >
              Customers
            </Link>

            <Link
              href="/signin"
              className="rounded-full border border-white/10 px-3 py-2 transition hover:border-cyan-400/40 hover:text-cyan-200"
            >
              Sign in
            </Link>
          </nav>
        </header>

        {/* HERO */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 shadow-[0_0_80px_rgba(34,211,238,0.14)] backdrop-blur-2xl sm:p-10 lg:p-12"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Premium AI operations suite
            </div>

            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Run your company at the speed of thought.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              OpsFlow AI pairs autonomous workflows, secure reasoning, and
              executive-grade analytics into one luminous operating layer for
              high-growth teams.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-medium text-slate-950 transition hover:scale-[1.01]"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href="#platform"
                className="rounded-full border border-white/10 bg-white/10 px-5 py-3 font-medium text-slate-100 backdrop-blur-xl"
              >
                Explore platform
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-300">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                99.9% uptime
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                SOC 2 ready
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                Live multi-team sync
              </div>
            </div>
          </motion.div>

          {/* CONTROL CENTER */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-2xl"
          >
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/70 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">
                    Live control center
                  </p>

                  <p className="text-2xl font-semibold text-white">
                    Systems aligned
                  </p>
                </div>

                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
                  Stable
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Weekly throughput</span>
                  <span className="font-medium text-white">+28%</span>
                </div>

                <div className="mt-3 flex items-end gap-2">
                  {[55, 72, 68, 84, 92, 98].map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t-xl bg-gradient-to-t from-cyan-500 to-violet-500"
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">
                    Automation
                  </p>

                  <p className="mt-2 text-xl font-semibold text-white">
                    94%
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">
                    Response
                  </p>

                  <p className="mt-2 text-xl font-semibold text-white">
                    &lt; 180ms
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* LOGOS */}
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 px-6 py-6 backdrop-blur-2xl">
          <p className="text-center text-sm uppercase tracking-[0.3em] text-slate-400">
            Trusted by teams shipping at enterprise speed
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {logos.map((logo) => (
              <div
                key={logo}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-slate-200"
              >
                {logo}
              </div>
            ))}
          </div>
        </section>

        {/* PLATFORM */}
        <section
          id="platform"
          className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"
        >
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">
                  Premium bento grid
                </p>

                <h2 className="mt-2 text-3xl font-semibold text-white">
                  A realistic AI command center
                </h2>
              </div>

              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
                Live
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-12">

              {/* REVENUE */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-cyan-500/20 via-slate-950/90 to-violet-500/20 p-5 lg:col-span-7"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">
                      Revenue pulse
                    </p>

                    <p className="mt-1 text-2xl font-semibold text-white">
                      $2.34M ARR
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
                    <TrendingUp className="h-4 w-4" />
                    +17.4%
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {["Forecast", "Expansion", "Retention"].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center text-sm text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* AI COPILOT */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05 }}
                className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 lg:col-span-5"
              >
                <div className="flex items-center gap-2 text-cyan-200">
                  <MessageCircleMore className="h-4 w-4" />
                  <span className="text-sm">AI copilot</span>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    "Summarize the last 24h",
                    "Draft a leadership update",
                    "Flag anomalies",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ANALYTICS */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 lg:col-span-5"
              >
                <div className="flex items-center gap-2 text-cyan-200">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm">
                    Operational analytics
                  </span>
                </div>

                <div className="mt-4 flex items-end gap-2">
                  {[28, 42, 61, 74, 86].map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t-2xl bg-gradient-to-t from-violet-500 to-cyan-400"
                      style={{ height: `${height * 2}px` }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* ACTIVITY */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.12 }}
                className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5 lg:col-span-7"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">
                      Activity timeline
                    </p>

                    <p className="text-xl font-semibold text-white">
                      Active across every team
                    </p>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                    24/7 monitoring
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {activityTimeline.map(([time, detail]) => (
                    <div
                      key={detail}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <Clock3 className="mt-0.5 h-4 w-4 text-cyan-300" />

                      <div>
                        <p className="text-sm font-medium text-white">
                          {time}
                        </p>

                        <p className="text-sm text-slate-400">
                          {detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* FEATURES */}
          <div className="space-y-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.45,
                    delay: 0.1 * index,
                  }}
                  className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl"
                >
                  <div className="mb-3 inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="text-lg font-semibold text-white">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    {feature.desc}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* CUSTOMERS */}
        <section
          id="customers"
          className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 backdrop-blur-2xl sm:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">
                Customer stories
              </p>

              <h2 className="mt-2 text-3xl font-semibold text-white">
                Trusted by operators building the next era of software.
              </h2>
            </div>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-medium text-cyan-100"
            >
              Compare plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {testimonials.map((item) => (
              <motion.article
                key={item.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="rounded-[1.5rem] border border-white/10 bg-white/10 p-6"
              >
                <div className="flex items-center gap-2 text-cyan-300">
                  <Sparkles className="h-4 w-4" />

                  <span className="text-sm">
                    Rated 4.9/5
                  </span>
                </div>

                <p className="mt-4 text-sm leading-8 text-slate-300">
                  “{item.quote}”
                </p>

                <div className="mt-6">
                  <p className="font-semibold text-white">
                    {item.name}
                  </p>

                  <p className="text-sm text-slate-400">
                    {item.role}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="workflow" className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 backdrop-blur-2xl lg:col-span-2">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Sales to success</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">One operating thread from signed deal to healthy customer.</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[["01", "Capture", "Turn CRM signals and webhooks into a structured workflow."], ["02", "Govern", "Pause risky actions for the right human approver."], ["03", "Prove", "Track execution, handoffs, and outcomes in one audit trail."]].map(([number, title, text]) => <div key={number} className="border-l border-cyan-300/40 pl-4"><p className="text-xs text-cyan-300">{number}</p><h3 className="mt-2 font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}
            </div>
          </div>
          <div id="security" className="rounded-[2rem] border border-emerald-300/20 bg-emerald-400/5 p-6"><ShieldCheck className="h-6 w-6 text-emerald-300" /><h2 className="mt-4 text-xl font-semibold text-white">Built for accountable automation</h2><p className="mt-3 text-sm leading-7 text-slate-300">Organization isolation, verified identity, role-based access, approval gates, and immutable operational history keep AI useful without making it opaque.</p></div>
        </section>

        <section id="faq" className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 backdrop-blur-2xl sm:p-10">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Questions, answered</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[['Who is OpsFlow AI for?', 'Revenue, operations, and customer-success teams that need reliable handoffs without losing human control.'], ['Can AI act without approval?', 'You decide. Mutating integrations are approval-gated by default, with every decision recorded.'], ['What can I connect?', 'Webhooks, SMTP email, and CRM adapters are supported, with safe mock fallback for evaluation.'], ['How does security work?', 'Firebase identity and organization RBAC protect tenant-scoped APIs, records, and configuration metadata.']].map(([question, answer]) => <details key={question} className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="cursor-pointer font-medium text-white">{question}</summary><p className="mt-3 text-sm leading-6 text-slate-400">{answer}</p></details>)}
          </div>
        </section>

        {/* LAUNCH */}
        <section
          id="launch"
          className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-cyan-500/10 via-slate-950/70 to-violet-500/10 p-8 backdrop-blur-2xl sm:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">
                Launch-ready
              </p>

              <h2 className="mt-2 text-3xl font-semibold text-white">
                Bring calm precision to your next rollout.
              </h2>

              <p className="mt-3 max-w-2xl text-slate-300">
                Built for executive teams that need depth, clarity, and
                velocity all at once.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-slate-950"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-5 py-3 font-medium text-slate-100"
              >
                View pricing
                <Play className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="flex flex-col gap-3 border-t border-white/10 px-2 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 OpsFlow AI. Built for the next generation of operators.
          </p>

          <div className="flex gap-4">
            <Link
              href="/pricing"
              className="transition hover:text-white"
            >
              Pricing
            </Link>

            <Link
              href="/signin"
              className="transition hover:text-white"
            >
              Sign in
            </Link>

            <Link
              href="/signup"
              className="transition hover:text-white"
            >
              Create account
            </Link>
          </div>
        </footer>

      </div>
    </main>
  );
}