import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Eye, LogIn, UserPlus } from 'lucide-react';
import { useLogin, useRegister, type AuthResult } from '@workspace/api-client-react';
import { useResetSession, errMsg, ROLE_LABEL } from '@/lib/core';

const DEMO = [
  { role: 'citizen', email: 'citizen@nagardrishti.demo', note: 'Files live-camera reports, tracks own tickets' },
  { role: 'contractor', email: 'contractor@nagardrishti.demo', note: 'Sees assigned work, submits repair evidence' },
  { role: 'je', email: 'je@nagardrishti.demo', note: 'Assigns work, reviews uncertain closures' },
  { role: 'commissioner', email: 'commissioner@nagardrishti.demo', note: 'All of the above, plus thresholds' },
];
const DEMO_PW = 'NagarDemo2026!';

export default function Login() {
  const [, nav] = useLocation();
  const reset = useResetSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const done = (r: AuthResult) => { reset(r.user); nav(r.user.role === 'citizen' ? '/report' : r.user.role === 'je' ? '/reviews' : r.user.role === 'contractor' ? '/tickets' : '/'); };
  const login = useLogin({ mutation: { onSuccess: done } });
  const register = useRegister({ mutation: { onSuccess: done } });
  const pending = login.isPending || register.isPending;
  const error = login.error ?? register.error;
  const inp = 'w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary';

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-border p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full border border-primary/20" />
        <div className="absolute -left-20 top-[42%] h-[320px] w-[320px] rounded-full border border-[#0A6CFF]/25" />
        <Link href="/" className="relative flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-public"><ArrowLeft className="h-4 w-4" />Public overview</Link>
        <div className="relative">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-sm bg-primary text-primary-foreground"><Eye className="h-6 w-6" /></div>
          <h1 className="font-display text-6xl font-extrabold leading-[0.95]">No closure<br />without<br /><span className="text-primary">verified evidence.</span></h1>
          <p className="mt-5 max-w-md text-muted-foreground">Every pothole ticket in NagarDrishti closes only when live before-and-after photos, location match and structural similarity agree, or a named engineer signs off.</p>
        </div>
        <div className="relative font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Municipal road health operations</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="rise w-full max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground lg:hidden"><ArrowLeft className="h-4 w-4" />Public overview</Link>
          <div className="mb-5 flex rounded-sm border border-border p-0.5">
            {(['login', 'register'] as const).map((m) => <button key={m} data-testid={`button-mode-${m}`} onClick={() => { setMode(m); login.reset(); register.reset(); }} className={`flex-1 rounded-sm py-1.5 text-sm transition-colors ${mode === m ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>{m === 'login' ? 'Sign in' : 'Citizen registration'}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (mode === 'login') login.mutate({ data: { email, password } }); else register.mutate({ data: { name, email, password } }); }} className="space-y-3">
            {mode === 'register' && <input data-testid="input-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inp} />}
            <input data-testid="input-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inp} />
            <input data-testid="input-password" type="password" required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={inp} />
            {error && <div data-testid="text-auth-error" className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-rose-200">{errMsg(error)}</div>}
            <button data-testid="button-submit-auth" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.98] disabled:opacity-60">
              {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{pending ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create citizen account'}
            </button>
          </form>

          {mode === 'login' && (
            <div className="mt-8">
              <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6EA8FF]">Demo accounts</span><span className="font-mono text-[10px] text-muted-foreground">password {DEMO_PW}</span></div>
              <p className="mb-2 text-xs text-muted-foreground">Choosing a role fills the form. Press Sign in to authenticate against the server.</p>
              <div className="grid gap-1.5">
                {DEMO.map((d) => (
                  <button key={d.role} type="button" data-testid={`button-demo-${d.role}`} onClick={() => { setEmail(d.email); setPassword(DEMO_PW); login.reset(); }} className={`group flex items-center justify-between rounded-sm border px-3 py-2 text-left transition-all hover:translate-x-1 ${email === d.email ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}>
                    <span><span className="block text-sm font-medium">{ROLE_LABEL[d.role]}</span><span className="text-xs text-muted-foreground">{d.note}</span></span>
                    <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary">{d.email.split('@')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
