import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Search } from 'lucide-react';
import { useGetTickets, getGetTicketsQueryKey, useGetPublicTicket, getGetPublicTicketQueryKey } from '@workspace/api-client-react';
import { PageHead, Panel, Skel, ErrorState, EmptyState, StatusPill, DemoTag } from '@/components/bits';
import { TicketMap } from '@/components/ticket-map';
import { POLL, fmtDate, errStatus } from '@/lib/core';

function Lookup({ id }: { id: string }) {
  const q = useGetPublicTicket(id, { query: { queryKey: getGetPublicTicketQueryKey(id), refetchInterval: POLL, retry: false } });
  if (q.isLoading) return <Skel className="h-40" />;
  if (q.isError || !q.data) return errStatus(q.error) === 404 ? <EmptyState title={`No ticket ${id}`} hint="Check the ID printed on your report receipt." /> : <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data;
  return (
    <div data-testid="card-lookup-result" className="rise space-y-3">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[#6EA8FF]">{t.id}</span><StatusPill status={t.status} />{t.is_demo && <DemoTag />}</div>
      <div className="font-display text-xl font-bold">{t.title}</div>
      <div className="text-sm text-muted-foreground">{t.location} · {t.ward_name}</div>
      <ol className="space-y-1.5 border-l border-border pl-3 text-sm">
        {t.events.map((e) => <li key={e.id}><span className="font-mono text-[11px] text-muted-foreground">{fmtDate(e.at)}</span> {e.description}</li>)}
      </ol>
      <Link href={`/tickets/${t.id}`} className="text-sm text-primary hover:underline">View evidence</Link>
    </div>
  );
}

export default function PublicTracker() {
  const [, nav] = useLocation();
  const [val, setVal] = useState('');
  const [id, setId] = useState('');
  const q = useGetTickets(undefined, { query: { queryKey: getGetTicketsQueryKey(), refetchInterval: POLL } });
  return (
    <div>
      <PageHead kicker="Open to every resident" title="Public repair tracker" />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel kicker="Live map" title="Every reported hazard" bodyClass="p-2">
          {q.isLoading ? <Skel className="h-[520px]" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <TicketMap tickets={q.data ?? []} height={520} onSelect={(i) => { setVal(i); setId(i); }} />}
        </Panel>
        <Panel kicker="Ticket lookup" title="Track by ID">
          <form onSubmit={(e) => { e.preventDefault(); setId(val.trim()); }} className="mb-4 flex gap-2">
            <input data-testid="input-ticket-id" value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. ND-1042" className="flex-1 rounded-sm border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-primary" />
            <button data-testid="button-lookup" className="rounded-sm bg-primary px-3 text-primary-foreground"><Search className="h-4 w-4" /></button>
          </form>
          {id ? <Lookup key={id} id={id} /> : <EmptyState title="Enter a ticket ID" hint="Or click any marker on the map." action={<button onClick={() => nav('/report')} className="text-sm text-primary hover:underline" data-testid="button-go-report">Report a new hazard</button>} />}
        </Panel>
      </div>
    </div>
  );
}
