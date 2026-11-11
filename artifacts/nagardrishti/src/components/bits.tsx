import { type ReactNode, useState } from 'react';
import { AlertTriangle, RotateCw, FlaskConical, Inbox } from 'lucide-react';
import type { TicketStatus } from '@workspace/api-client-react';
import { STATUS_META, errMsg, sevColor, sevLabel, fmtNum } from '@/lib/core';
import { cn } from '@/lib/utils';

export function StatusPill({ status }: { status: TicketStatus }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'text-muted-foreground border-border' };
  return (
    <span data-testid={`status-${status}`} className={cn('inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap', m.cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}

export function SevMeter({ value }: { value: number }) {
  const c = sevColor(value);
  return (
    <span className="inline-flex items-center gap-2" title={`Severity ${value}`}>
      <span className="flex gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-3 w-1 rounded-[1px] transition-colors" style={{ background: i <= Math.floor(Math.min(0.999, sevNormLocal(value)) * 4) ? c : 'hsl(224 16% 20%)' }} />
        ))}
      </span>
      <span className="font-mono text-xs tnum" style={{ color: c }}>{fmtNum(value, 2)}</span>
      <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground xl:inline">{sevLabel(value)}</span>
    </span>
  );
}
function sevNormLocal(v: number) {
  return v <= 1 ? v : v <= 5 ? v / 5 : v <= 10 ? v / 10 : v / 100;
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span title="Sample record for demonstration. Not a real report or real repair outcome." className={cn('inline-flex items-center gap-1 rounded-sm border border-dashed border-[#0A6CFF]/50 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-widest text-[#6EA8FF]', className)}>
      <FlaskConical className="h-2.5 w-2.5" /> Sample data
    </span>
  );
}

export function Panel({ title, kicker, right, children, className, bodyClass }: { title?: ReactNode; kicker?: string; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn('rise min-w-0 max-w-full rounded-md border border-card-border bg-card/80 backdrop-blur-sm', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
          <div className="min-w-0">
            {kicker && <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{kicker}</div>}
            {title && <h2 className="truncate font-display text-[15px] font-bold">{title}</h2>}
          </div>
          {right}
        </header>
      )}
      <div className={cn('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Skel({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-muted/70', className)} />;
}
export function SkelRows({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skel key={i} className="h-9" />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div data-testid="state-error" className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-rose-300"><AlertTriangle className="h-4 w-4" />{title}</div>
      <p className="font-mono text-xs text-muted-foreground">{errMsg(error)}</p>
      {onRetry && (
        <button data-testid="button-retry" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-xs hover:border-primary hover:text-primary transition-colors">
          <RotateCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div data-testid="state-empty" className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground">{icon ?? <Inbox className="h-4 w-4" />}</div>
      <div className="font-display text-base font-bold">{title}</div>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function Kpi({ label, value, sub, tone = 'default', testid, delay = 0 }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'orange' | 'blue' | 'green' | 'amber'; testid: string; delay?: number }) {
  const bar = { default: 'bg-muted-foreground/40', orange: 'bg-[#F26B1D]', blue: 'bg-[#0A6CFF]', green: 'bg-emerald-400', amber: 'bg-amber-400' }[tone];
  return (
    <div className="rise group relative overflow-hidden rounded-md border border-card-border bg-card/80 px-4 py-3 transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${delay}ms` }}>
      <span className={cn('absolute left-0 top-0 h-full w-[3px]', bar)} />
      <div className="break-words font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div data-testid={testid} className="mt-1 font-display text-3xl font-extrabold tnum">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="rise mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-primary">{kicker}</div>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function EvidenceImage({ src, alt, label, testid, privateNote }: { src?: string | null; alt: string; label: string; testid: string; privateNote?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="relative overflow-hidden rounded-md border border-border bg-[#07090D]">
      <figcaption className="absolute left-2 top-2 z-10 rounded-sm bg-[#0B0D12]/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest">{label}</figcaption>
      {src && !failed ? (
        <img data-testid={testid} src={src} alt={alt} onError={() => setFailed(true)} className="block aspect-[4/3] w-full object-cover" />
      ) : (
        <div data-testid={`${testid}-unavailable`} className="grid aspect-[4/3] place-items-center p-6 text-center text-xs text-muted-foreground">
          <span className="max-w-[260px] leading-relaxed">{!src ? (privateNote ?? 'No photo attached.') : 'Photo could not be loaded. You may need to sign in with an account that can access this ticket.'}</span>
        </div>
      )}
    </figure>
  );
}
