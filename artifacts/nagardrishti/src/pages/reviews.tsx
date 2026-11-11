import { useState } from 'react';
import { Link } from 'wouter';
import { ExternalLink } from 'lucide-react';
import { useGetTickets, getGetTicketsQueryKey, useGetTicket, getGetTicketQueryKey, type Ticket } from '@workspace/api-client-react';
import { PageHead, Panel, SkelRows, Skel, ErrorState, EmptyState, SevMeter, DemoTag } from '@/components/bits';
import { RepairCard, ReviewForm } from '@/pages/ticket-detail';
import { POLL, ago } from '@/lib/core';

function ReviewItem({ id }: { id: string }) {
  const q = useGetTicket(id, { query: { queryKey: getGetTicketQueryKey(id), refetchInterval: POLL } });
  if (q.isLoading) return <Skel className="h-96" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data;
  const r = t.repairs[t.repairs.length - 1];
  return (
    <div className="space-y-4">
      {r ? <RepairCard r={r} t={t} /> : <EmptyState title="No repair evidence attached" />}
      <ReviewForm t={t} />
    </div>
  );
}

export default function Reviews() {
  const p = { status: 'NEEDS_JE_REVIEW', sort: 'priority' };
  const q = useGetTickets(p, { query: { queryKey: getGetTicketsQueryKey(p), refetchInterval: POLL } });
  const [sel, setSel] = useState<string | null>(null);
  const list: Ticket[] = q.data ?? [];
  const active = sel && list.some((t) => t.id === sel) ? sel : list[0]?.id;
  return (
    <div>
      <PageHead kicker="Junior Engineer" title="Repairs awaiting review" />
      <p className="rise -mt-3 mb-5 max-w-2xl text-sm text-muted-foreground">Every submitted repair lands here. Nothing closes automatically: a named engineer compares the before and after photos and approves or rejects with notes.</p>
      {q.isLoading ? <SkelRows n={6} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? <EmptyState title="Queue is clear" hint="No repairs are awaiting engineering judgement right now." /> : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-1.5">
            {list.map((t) => (
              <button key={t.id} data-testid={`button-review-item-${t.id}`} onClick={() => setSel(t.id)} className={`w-full rounded-md border p-3 text-left transition-all ${active === t.id ? 'border-amber-400/60 bg-amber-400/5 translate-x-1' : 'border-border bg-card hover:border-muted-foreground/40'}`}>
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-[#6EA8FF]">{t.id}</span>{t.is_demo && <DemoTag />}<span className="ml-auto font-mono text-[10px] text-muted-foreground">{ago(t.created_at)}</span></div>
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{t.contractor_name ?? 'No contractor'}</span>{t.detector_engine === 'manual' ? <span className="font-mono text-[10px] uppercase">Not triaged</span> : <SevMeter value={t.severity} />}</div>
              </button>
            ))}
          </div>
          {active && (
            <Panel kicker="Before and after" title={list.find((t) => t.id === active)?.title} right={<Link href={`/tickets/${active}`} className="inline-flex items-center gap-1 text-xs text-primary"><ExternalLink className="h-3 w-3" />Full ticket</Link>}>
              <ReviewItem key={active} id={active} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
