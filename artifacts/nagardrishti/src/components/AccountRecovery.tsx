import { useEffect, useState } from 'react';
import { useConfirmPasswordReset, useRequestPasswordReset } from '@workspace/api-client-react';
import { errMsg, useResetSession } from '@/lib/core';

/** Links use fragments so secrets are not sent in URLs to the server or access logs. */
export function AccountRecovery() {
  const [initial] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [open, setOpen] = useState(initial.has('reset'));
  const [confirm, setConfirm] = useState(initial.has('reset'));
  const [token, setToken] = useState(initial.get('reset') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resetSession = useResetSession();
  const recovery = useRequestPasswordReset();
  const reset = useConfirmPasswordReset();
  useEffect(() => {
    if (initial.has('reset')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [initial]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      const result = confirm
        ? await reset.mutateAsync({ data: { token: token.trim(), password } })
        : await recovery.mutateAsync({ data: { email: email.trim() } });
      setMessage(result.message);
      if (confirm) {
        setToken(''); setPassword(''); setConfirm(false);
        await resetSession();
      }
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  const input = 'min-h-[44px] w-full rounded-sm border border-input bg-background px-3 py-2';
  return <section className="mt-5 space-y-3 border-t border-border pt-4" aria-label="Account recovery">
    <div className="flex flex-wrap gap-4 text-sm">
      <button type="button" disabled={busy} data-testid="recovery-open-reset"
        className="min-h-[44px] text-primary" onClick={() => { setOpen(true); setConfirm(false); setMessage(''); setError(''); setToken(''); setPassword(''); }}>
        Forgot password?
      </button>
    </div>
    {open && <form onSubmit={submit} className="space-y-3" data-testid="recovery-form">
      <h2 className="font-semibold">Reset your password</h2>
      <p className="text-sm text-muted-foreground">{confirm
        ? 'Enter your password-reset code and choose a new password (10–72 bytes). The code expires after 30 minutes. This signs out all existing sessions.'
        : 'Request a password-reset email. If email delivery is unavailable, contact the service operator.'}</p>
      {confirm ? <>
        <input className={input} data-testid="recovery-token" aria-label="Email code" autoComplete="off" required minLength={43} maxLength={43} value={token} onChange={e => setToken(e.target.value)} placeholder="Email code" disabled={busy} />
        <input className={input} data-testid="recovery-password" aria-label="New password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" disabled={busy} />
      </> : <input className={input} data-testid="recovery-email" aria-label="Account email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" disabled={busy} />}
      <button disabled={busy} data-testid="recovery-submit" className="min-h-[44px] w-full rounded-sm bg-primary px-3 text-primary-foreground disabled:opacity-60">{busy ? 'Please wait' : confirm ? 'Set new password' : 'Request reset email'}</button>
      <button type="button" disabled={busy} data-testid="recovery-toggle-code" className="min-h-[44px] text-sm text-primary"
        onClick={() => { setConfirm(!confirm); setError(''); setMessage(''); setToken(''); setPassword(''); }}>{confirm ? 'Request a new reset email' : 'I have a reset code'}</button>
      <button type="button" disabled={busy} className="ml-4 min-h-[44px] text-sm text-muted-foreground"
        onClick={() => { setOpen(false); setToken(''); setPassword(''); setMessage(''); setError(''); }}>Close</button>
      {message && <p role="status" data-testid="recovery-message" className="text-sm">{message}</p>}
      {error && <p role="alert" data-testid="recovery-error" className="text-sm text-destructive">{error}</p>}
    </form>}
  </section>;
}
