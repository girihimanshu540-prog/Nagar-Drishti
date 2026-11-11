import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Eye, LogIn, UserPlus } from 'lucide-react';
import { useLogin, useRegister, type AuthResult } from '@workspace/api-client-react';
import { useResetSession, errMsg } from '@/lib/core';

export default function Login() {
  const [, nav] = useLocation();
  const reset = useResetSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const done = async (r: AuthResult) => { await reset(r.user); nav(r.user.role === 'citizen' ? '/report' : r.user.role === 'je' ? '/reviews' : r.user.role === 'contractor' ? '/tickets' : '/'); };
  const login = useLogin({ mutation: { onSuccess: done } });
  const register = useRegister({ mutation: { onSuccess: done } });
  const pending = login.isPending || register.isPending;
  const error = login.error ?? register.error;
  const inp = 'min-h-[44px] w-full rounded-sm border border-input bg-background px-3 py-2 text-base sm:text-sm outline-none transition-colors focus:border-primary';

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-border p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full border border-primary/20" />
        <div className="absolute -left-20 top-[42%] h-[320px] w-[320px] rounded-full border border-[#0A6CFF]/25" />
        <Link href="/" className="relative flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-public"><ArrowLeft className="h-4 w-4" />Public overview</Link>
        <div className="relative">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-sm bg-primary text-primary-foreground"><Eye className="h-6 w-6" /></div>
          <h1 className="font-display text-6xl font-extrabold leading-[0.95]">Report it.<br />Track it.<br /><span className="text-primary">An engineer signs off.</span></h1>
          <p className="mt-5 max-w-md text-muted-foreground">Citizens report road hazards with a live photo and GPS. Contractors submit repair photos. A named junior engineer reviews every repair before a ticket closes. No automated detection is used.</p>
        </div>
        <div className="relative font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Independent tracker · not an official municipal service</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="rise w-full max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground lg:hidden"><ArrowLeft className="h-4 w-4" />Public overview</Link>
          <div className="mb-5 flex rounded-sm border border-border p-0.5">
            {(['login', 'register'] as const).map((m) => <button key={m} data-testid={`button-mode-${m}`} onClick={() => { setMode(m); login.reset(); register.reset(); }} className={`min-h-[40px] flex-1 rounded-sm py-1.5 text-sm transition-colors ${mode === m ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>{m === 'login' ? 'Sign in' : 'Citizen registration'}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (mode === 'login') login.mutate({ data: { email, password } }); else register.mutate({ data: { name, email, password } }); }} className="space-y-3">
            {mode === 'register' && <input data-testid="input-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" autoComplete="name" className={inp} />}
            <input data-testid="input-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" className={inp} />
            <input data-testid="input-password" type="password" required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" className={inp} />
            {error && <div data-testid="text-auth-error" className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-rose-200">{errMsg(error)}</div>}
            <button data-testid="button-submit-auth" disabled={pending} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-sm bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.98] disabled:opacity-60">
              {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{pending ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create citizen account'}
            </button>
          </form>

          <p data-testid="text-auth-notice" className="mt-5 text-xs leading-relaxed text-muted-foreground">
            {mode === 'register' ? 'By creating an account you agree that your name, email, and the photos and precise GPS you submit are stored and shared with authorised staff. ' : ''}
            NagarDrishti is not an official municipal service and is not for emergencies. <Link href="/privacy" data-testid="link-auth-privacy" className="text-primary hover:underline">Read the privacy notice</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
