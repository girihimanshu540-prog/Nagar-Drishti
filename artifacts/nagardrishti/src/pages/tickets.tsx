import { useMemo, useState } from 'react';
import { Download, Search, Map as MapIcon, Rows3 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useGetTickets, getGetTicketsQueryKey, useGetWards, getGetWardsQueryKey, useGetMyReports, getGetMyReportsQueryKey, type GetTicketsParams, type Ticket } from '@workspace/api-client-react';
import { PageHead, Panel, SkelRows, ErrorState, EmptyState } from '@/components/bits';
import { TicketTable } from '@/components/ticket-table';
import { TicketMap } from '@/components/ticket-map';
import { POLL, STATUS_META, fmtDate, useAuth } from '@/lib/core';

function exportCsv(rows: Ticket[]) {
  const cols: (keyof Ticket)[] = ['id', 'title', 'location', 'ward_name', 'status', 'severity', 'traffic_density', 'priority_score', 'report_count', 'contractor_name', 'lat', 'lng', 'created_at', 'closed_at', 'is_demo'];
  const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `nagardrishti-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function Tickets() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [ward, setWard] = useState('');
  const [severity, setSeverity] = useState('');
  const [sort, setSort] = useState('priority');
  const [view, setView] = useState<'table' | 'map'>('table');
  const mineDefault = user?.role === 'contractor';
  const [mine, setMine] = useState(false);
  const params: GetTicketsParams = useMemo(() => {
    const p: GetTicketsParams = { sort };
    if (search.trim()) p.search = search.trim();
    if (status) p.status = status;
    if (ward) p.ward = Number(ward);
    if (severity) p.severity = Number(severity);
    if (user && (mine || mineDefault)) p.mine = true;
    return p;
  }, [search, status, ward, severity, sort, mine, mineDefault, user]);
  const q = useGetTickets(params, { query: { queryKey: getGetTicketsQueryKey(params), refetchInterval: POLL, placeholderData: (p) => p } });
  const wards = useGetWards({ query: { queryKey: getGetWardsQueryKey() } });
  const mineReports = useGetMyReports({ query: { queryKey: getGetMyReportsQueryKey(), refetchInterval: POLL, enabled: user?.role === 'citizen' } });
  const rows = q.data ?? [];
  const sel = 'rounded-sm border border-input bg-card px-2.5 py-1.5 text-sm';

  return (
    <div>
      <PageHead kicker={user?.role === 'contractor' ? 'Assigned to you' : 'Priority sorted'} title={user?.role === 'contractor' ? 'My assigned work' : 'Tickets'}>
        <div className="flex gap-2">
          <div className="flex rounded-sm border border-border p-0.5">
            {(['table', 'map'] as const).map((v) => (
              <button key={v} data-testid={`button-view-${v}`} onClick={() => setView(v)} className={`flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs transition-colors ${view === v ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{v === 'table' ? <Rows3 className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}{v}</button>
            ))}
          </div>
          <button data-testid="button-export-csv" disabled={!rows.length} onClick={() => exportCsv(rows)} className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary disabled:opacity-40 transition-colors"><Download className="h-3.5 w-3.5" />Export CSV ({rows.length})</button>
        </div>
      </PageHead>

      <div className="rise mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <input data-testid="input-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, road, location" className="w-full rounded-sm border border-input bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary transition-colors" />
        </label>
        <select data-testid="select-status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select data-testid="select-ward" value={ward} onChange={(e) => setWard(e.target.value)} className={sel}>
          <option value="">All wards</option>
          {wards.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select data-testid="select-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={sel}>
          <option value="">Any severity</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Severity {n}</option>)}
        </select>
        <select data-testid="select-sort" value={sort} onChange={(e) => setSort(e.target.value)} className={sel}>
          <option value="priority">Sort: priority</option>
          <option value="severity">Sort: severity</option>
          <option value="created_at">Sort: newest</option>
        </select>
        {user && user.role !== 'contractor' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input data-testid="checkbox-mine" type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-[#F26B1D]" />Mine only</label>
        )}
      </div>

      <Panel bodyClass={view === 'map' ? 'p-2' : 'p-3'}>
        {q.isLoading ? <SkelRows n={8} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState title="No tickets match" hint="Loosen the filters or clear the search." /> : view === 'map' ? <TicketMap tickets={rows} height={560} onSelect={(id) => nav(`/tickets/${id}`)} /> : <TicketTable tickets={rows} />}
      </Panel>

      {user?.role === 'citizen' && (
        <Panel className="mt-4" kicker="Your submissions" title="My reports">
          {mineReports.isLoading ? <SkelRows n={3} /> : mineReports.isError ? <ErrorState error={mineReports.error} onRetry={() => mineReports.refetch()} /> : !mineReports.data?.length ? <EmptyState title="You have not filed a report yet" /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mineReports.data.map((r) => (
                <div key={r.id} data-testid={`card-report-${r.id}`} className="flex flex-wrap gap-3 rounded-md border border-border p-2">
                  <img src={r.image_url} alt="" className="h-16 w-20 rounded-sm object-cover" />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-mono text-[#6EA8FF]">{r.ticket_id ?? 'No ticket'}</div>
                    <div className="uppercase tracking-wider">{r.validation_status}</div>
                    <div className="truncate text-muted-foreground">{r.reason}</div>
                    <div className="text-muted-foreground">{fmtDate(r.captured_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
