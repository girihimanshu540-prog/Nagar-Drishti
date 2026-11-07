import { useState } from 'react';
import { useGetContractors, getGetContractorsQueryKey, type Contractor } from '@workspace/api-client-react';
import { PageHead, Panel, SkelRows, ErrorState, EmptyState } from '@/components/bits';
import { POLL, fmtNum } from '@/lib/core';

const pct = (r: number) => (r <= 1 ? r * 100 : r);

export default function Contractors() {
  const q = useGetContractors({ query: { queryKey: getGetContractorsQueryKey(), refetchInterval: POLL } });
  const [key, setKey] = useState<keyof Contractor>('verification_rate');
  const list = [...(q.data ?? [])].sort((a, b) => Number(b[key]) - Number(a[key]));
  const cols: [keyof Contractor, string][] = [['assigned', 'Assigned'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['pending_review', 'Pending JE'], ['verification_rate', 'Verify rate'], ['avg_close_hours', 'Avg close h']];
  return (
    <div>
      <PageHead kicker="Accountability" title="Contractor scorecard" />
      <Panel>
        {q.isLoading ? <SkelRows n={6} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? <EmptyState title="No contractors on record" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="py-2 pr-3 font-normal">Contractor</th>
                  {cols.map(([k, l]) => <th key={k} className="py-2 pr-3 font-normal"><button data-testid={`button-sort-${k}`} onClick={() => setKey(k)} className={`uppercase tracking-[0.14em] hover:text-foreground ${key === k ? 'text-primary' : ''}`}>{l}{key === k ? ' ↓' : ''}</button></th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => {
                  const rate = pct(c.verification_rate);
                  return (
                    <tr key={c.id} data-testid={`row-contractor-${c.id}`} className="border-b border-border/50 transition-colors hover:bg-muted/40" style={{ animation: `rise .4s ${i * 40}ms both` }}>
                      <td className="py-2.5 pr-3"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.company}</div></td>
                      <td className="pr-3 font-mono tnum">{c.assigned}</td>
                      <td className="pr-3 font-mono tnum text-emerald-300">{c.verified}</td>
                      <td className="pr-3 font-mono tnum text-rose-300">{c.rejected}</td>
                      <td className="pr-3 font-mono tnum text-amber-300">{c.pending_review}</td>
                      <td className="pr-3">
                        <div className="flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full origin-left transition-transform duration-700" style={{ transform: `scaleX(${rate / 100})`, background: rate >= 75 ? '#34d399' : rate >= 50 ? '#F5B83D' : '#F0384A' }} /></span><span className="font-mono text-xs tnum">{rate.toFixed(1)}%</span></div>
                      </td>
                      <td className="pr-3 font-mono tnum">{fmtNum(c.avg_close_hours)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-3 text-xs text-muted-foreground">Rejected counts repairs that failed evidence verification or JE review. Every figure is computed by the server from the audit record.</p>
    </div>
  );
}
