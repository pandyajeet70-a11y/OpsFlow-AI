"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Lock, Mail } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/auth-provider';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, router, user]);

  if (authLoading || user) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_35%),#030712] px-4 py-8 text-slate-100">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-cyan-400/30 bg-cyan-400/15 p-2">
            <Bot className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200">OPSFLOW AI</p>
            <p className="text-xs text-slate-400">Enterprise access</p>
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">Sign in to continue orchestrating your AI operations.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="mb-2 flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" /> Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border-none bg-transparent text-white outline-none" placeholder="you@company.com" />
          </label>
          <label className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="mb-2 flex items-center gap-2 text-slate-400"><Lock className="h-4 w-4" /> Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border-none bg-transparent text-white outline-none" placeholder="••••••••" />
          </label>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? 'Signing in...' : 'Sign in'} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          No account yet?{' '}
          <Link href="/signup" className="text-cyan-300">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
