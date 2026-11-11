import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { useGetStats, getGetStatsQueryKey, useGetTickets, getGetTicketsQueryKey, useGetActivity, getGetActivityQueryKey, useGetWards, getGetWardsQueryKey, type GetStatsParams } from '@workspace/api-client-react';
import { Kpi, Panel, PageHead, Skel, SkelRows, ErrorState, EmptyState } from '@/components/bits';
import { TicketMap } from '@/components/ticket-map';
import { TicketTable } from '@/components/ticket-table';
import { POLL, STATUS_META, ago, fmtNum, useAuth } from '@/lib/core';

export default function Overview() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const [ward, setWard] = useState<number | undefined>();
  const sp: GetStatsParams | undefined = ward ? { ward } : undefined;
  const stats = useGetStats(sp, { query: { queryKey: getGetStatsQueryKey(sp), refetchInterval: POLL } });
  const tp = { sort: 'priority', ...(ward ? { ward } : {}) };
  const tickets = useGetTickets(tp, { query: { queryKey: getGetTicketsQueryKey(tp), refetchInterval: POLL } });
  const activity = useGetActivity({ query: { queryKey: getGetActivityQueryKey(), refetchInterval: POLL } });
  const wards = useGetWards({ query: { queryKey: getGetWardsQueryKey() } });
  const s = stats.data;
  const list = [...(tickets.data ?? [])].sort((a, b) => b.priority_score - a.priority_score);
  const hasDemo = list.some((t) => t.is_demo);

  return (
    <div>
      <PageHead kicker={user ? `Signed in · ${user.name}` : 'Public read-only overview'} title="Road hazard reports, ward by ward">
        <select data-testid="select-ward" value={ward ?? ''} onChange={(e) => setWard(e.target.value ? Number(e.target.value) : undefined)} aria-label="Filter by ward" className="min-h-[40px] rounded-sm border border-input bg-card px-3 py-1.5 text-sm">
          <option value="">All wards</option>
          {wards.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </PageHead>

      {hasDemo && (
        <div data-testid="banner-demo" className="rise mb-4 flex items-start gap-3 rounded-md border border-dashed border-[#0A6CFF]/50 bg-[#0A6CFF]/5 px-4 py-2.5 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-[#6EA8FF]" />
          <span><b className="text-[#6EA8FF]">Sample data present.</b> <span className="text-muted-foreground">Records labelled sample data are demonstration examples. They are not real reports, and their statuses are sample outcomes, not real repairs. Totals above count real reports only.</span></span>
        </div>
      )}

      {stats.isError ? <ErrorState error={stats.error} onRetry={() => stats.refetch()} title="Statistics unavailable" /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {stats.isLoading || !s ? Array.from({ length: 7 }).map((_, i) => <Skel key={i} className="h-[88px]" />) : (
            <>
              <Kpi testid="kpi-total" label="Tickets" value={s.total} sub={`${s.reports_total} citizen reports`} delay={0} />
              <Kpi testid="kpi-open" label="Open" value={s.open} tone="orange" delay={40} />
              <Kpi testid="kpi-verified" label="Engineer-approved closures" value={s.verified_closures} tone="green" delay={80} />
              <Kpi testid="kpi-je-queue" label="Awaiting engineer review" value={s.je_queue} tone="amber" delay={120} />
              <Kpi testid="kpi-false-prevented" label="Repairs sent back" value={s.false_closures_prevented} tone="blue" sub="rejected in engineer review" delay={160} />
              <Kpi testid="kpi-avg-close" label="Avg to close" value={<>{fmtNum(s.avg_time_to_close_hours)}<span className="ml-1 text-base text-muted-foreground">h</span></>} delay={200} />
              <Kpi testid="kpi-reports" label="Reports" value={s.reports_total} delay={240} />
            </>
          )}
        </div>
      )}
      <p data-testid="text-stats-note" className="mt-2 text-xs text-muted-foreground">Totals count real reports only and exclude sample data. Reports are unverified until reviewed; new closures require engineer approval. Status and per-ward closed counts show recorded status; older closures may predate engineer-only review.</p>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel kicker="OpenStreetMap · approximate locations" title="Hazard map" bodyClass="p-2" right={<span className="font-mono text-[10px] text-muted-foreground">{list.length} plotted</span>}>
          {tickets.isLoading ? <Skel className="h-[420px]" /> : tickets.isError ? <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} /> : <TicketMap tickets={list} onSelect={(id) => nav(`/tickets/${id}`)} />}
        </Panel>
        <div className="grid gap-4">
          <Panel kicker="Pipeline" title="Status distribution">
            {!s ? <SkelRows n={5} /> : Object.keys(s.status_counts).length === 0 ? <EmptyState title="No tickets yet" /> : (
              <div className="space-y-2">
                {Object.entries(s.status_counts).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr_40px] items-center gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{STATUS_META[k as keyof typeof STATUS_META]?.label ?? k}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full origin-left rounded-full bg-gradient-to-r from-[#0A6CFF] to-[#F26B1D] transition-transform duration-700" style={{ transform: `scaleX(${s.total ? v / s.total : 0})` }} /></span>
                    <span className="text-right font-mono tnum">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel kicker="Per ward" title="Load vs closure">
            {!s ? <SkelRows n={4} /> : s.per_ward.length === 0 ? <EmptyState title="No ward data" /> : (
              <div className="space-y-1.5">
                {s.per_ward.map((w) => (
                  <button key={w.ward_id} data-testid={`button-ward-${w.ward_id}`} onClick={() => setWard(ward === w.ward_id ? undefined : w.ward_id)} className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60 ${ward === w.ward_id ? 'bg-muted ring-1 ring-primary/50' : ''}`}>
                    <span className="truncate">{w.name}</span>
                    <span className="font-mono tnum"><span className="text-primary">{w.open}</span> / <span className="text-emerald-300">{w.closed}</span> / {w.total}</span>
                  </button>
                ))}
                <div className="pt-1 font-mono text-[10px] text-muted-foreground">open / closed / total · click to filter</div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel kicker="Sorted by priority score" title="Work queue" right={<Link href="/tickets" data-testid="link-all-tickets" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">All tickets <ArrowRight className="h-3 w-3" /></Link>}>
          {tickets.isLoading ? <SkelRows /> : tickets.isError ? <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} /> : list.length === 0 ? <EmptyState title="No tickets in this view" hint="Citizen reports will appear here, ranked by priority." /> : <TicketTable tickets={list.slice(0, 10)} compact />}
        </Panel>
        <Panel kicker="Audit stream" title="Recent activity">
          {activity.isLoading ? <SkelRows /> : activity.isError ? <ErrorState error={activity.error} onRetry={() => activity.refetch()} /> : !activity.data?.length ? <EmptyState title="No activity yet" /> : (
            <ol className="relative max-h-[460px] space-y-3 overflow-y-auto border-l border-border pl-4">
              {activity.data.slice(0, 30).map((e) => (
                <li key={e.id} data-testid={`activity-${e.id}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-primary bg-background" />
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span className="text-[#6EA8FF]">{e.event_type}</span>· {ago(e.at)}</div>
                  <Link href={`/tickets/${e.ticket_id}`} className="text-sm hover:text-primary">{e.description}</Link>
                  <div className="text-xs text-muted-foreground">{e.actor_name} · {e.ticket_id}</div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
