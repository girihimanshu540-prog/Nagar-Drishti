import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Lock, Search } from 'lucide-react';
import { useGetTickets, getGetTicketsQueryKey, useGetPublicTicket, getGetPublicTicketQueryKey } from '@workspace/api-client-react';
import { PageHead, Panel, Skel, ErrorState, EmptyState, StatusPill, DemoTag } from '@/components/bits';
import { TicketMap } from '@/components/ticket-map';
import { POLL, fmtDate, errStatus } from '@/lib/core';

function Lookup({ id }: { id: string }) {
  const q = useGetPublicTicket(id, { query: { queryKey: getGetPublicTicketQueryKey(id), refetchInterval: POLL, retry: false } });
  if (q.isLoading) return <Skel className="h-40" />;
  if (q.isError || !q.data) return errStatus(q.error) === 404 ? <EmptyState title={`No ticket ${id}`} hint="Check the ID shown when you filed your report." /> : <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data;
  return (
    <div data-testid="card-lookup-result" className="rise space-y-3">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[#6EA8FF]">{t.id}</span><StatusPill status={t.status} />{t.is_demo && <DemoTag />}</div>
      {t.is_demo && <p className="text-xs text-[#9EC3FF]">Sample record for demonstration. Its status is a sample outcome, not real repair work.</p>}
      <div className="font-display text-xl font-bold">{t.title}</div>
      <div className="text-sm text-muted-foreground">{t.location} · {t.ward_name} · approximate location</div>
      <div className="text-xs text-muted-foreground">Opened {fmtDate(t.created_at)}</div>
      <div className="flex items-start gap-2 rounded-sm border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Photos, precise location and the activity timeline are private. The reporting citizen and authorised staff can see them after signing in.</div>
      <Link href={`/tickets/${t.id}`} className="inline-flex min-h-[40px] items-center text-sm text-primary hover:underline">Open ticket page</Link>
    </div>
  );
}

export default function PublicTracker() {
  const [, nav] = useLocation();
  const [val, setVal] = useState('');
  const [id, setId] = useState('');
  const q = useGetTickets(undefined, { query: { queryKey: getGetTicketsQueryKey(), refetchInterval: POLL } });
  const hasDemo = (q.data ?? []).some((t) => t.is_demo);
  return (
    <div>
      <PageHead kicker="Open to every resident" title="Public repair tracker" />
      <p className="rise -mt-3 mb-4 max-w-3xl text-sm text-muted-foreground">Markers show general, approximate locations of reported road hazards. Reports are unverified until reviewed by staff, and a ticket closes only after a human engineer approves the repair. This is not an official municipal service and no repair time is guaranteed.</p>
      {hasDemo && <div data-testid="banner-public-demo" className="rise mb-4 rounded-md border border-dashed border-[#0A6CFF]/50 bg-[#0A6CFF]/5 px-4 py-2.5 text-sm text-muted-foreground"><b className="text-[#6EA8FF]">Sample data shown.</b> Markers labelled sample data are demonstration records, not real reports or real repairs. Public totals count real reports only.</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel kicker="Approximate locations" title="Reported hazards" bodyClass="p-2">
          {q.isLoading ? <Skel className="h-[420px]" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <TicketMap tickets={q.data ?? []} height={460} onSelect={(i) => { setVal(i); setId(i); }} />}
        </Panel>
        <Panel kicker="Ticket lookup" title="Track by ID">
          <form onSubmit={(e) => { e.preventDefault(); setId(val.trim()); }} className="mb-4 flex gap-2">
            <label htmlFor="ticket-id" className="sr-only">Ticket ID</label>
            <input id="ticket-id" data-testid="input-ticket-id" value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. ND-1042" className="min-h-[44px] min-w-0 flex-1 rounded-sm border border-input bg-background px-3 py-1.5 font-mono text-base outline-none focus:border-primary sm:text-sm" />
            <button data-testid="button-lookup" aria-label="Look up ticket" className="grid h-11 w-11 place-items-center rounded-sm bg-primary text-primary-foreground"><Search className="h-4 w-4" /></button>
          </form>
          {id ? <Lookup key={id} id={id} /> : <EmptyState title="Enter a ticket ID" hint="Or select any marker on the map." action={<button onClick={() => nav('/report')} className="min-h-[40px] text-sm text-primary hover:underline" data-testid="button-go-report">Report a new hazard</button>} />}
        </Panel>
      </div>
    </div>
  );
}
