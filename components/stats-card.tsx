import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function StatsCard({ label, value, delta, href, tone = 'cyan' }: { label: string; value: string; delta: string; href?: string; tone?: 'cyan' | 'violet' | 'emerald' }) {
  const toneClasses = {
    cyan: 'from-cyan-500/20 to-slate-950/80 border-cyan-400/20',
    violet: 'from-violet-500/20 to-slate-950/80 border-violet-400/20',
    emerald: 'from-emerald-500/20 to-slate-950/80 border-emerald-400/20',
  };

  return (
    <div className={`rounded-[1.4rem] border bg-gradient-to-br ${toneClasses[tone]} p-5 backdrop-blur-xl`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        {href ? <Link href={href} aria-label={`Open ${label}`} className="rounded-full border border-white/10 bg-white/10 p-2 transition hover:bg-white/20">
          <ArrowUpRight className="h-4 w-4 text-slate-200" />
        </Link> : <div className="rounded-full border border-white/10 bg-white/10 p-2">
          <ArrowUpRight className="h-4 w-4 text-slate-200" />
        </div>}
      </div>
      <p className="mt-5 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{delta}</p>
    </div>
  );
}
