import { useEffect, useRef, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetConfig, getGetConfigQueryKey, useUpdateConfig, useGetWards, getGetWardsQueryKey, getGetTicketsQueryKey, getGetStatsQueryKey, type Configuration, type TrafficZone } from '@workspace/api-client-react';
import { PageHead, Panel, SkelRows, ErrorState, EmptyState } from '@/components/bits';
import { RequireRole } from '@/components/shell';
import { errMsg } from '@/lib/core';
import { useToast } from '@/hooks/use-toast';

function Field({ label, hint, value, onChange, unit, id }: { label: string; hint: string; value: number; onChange: (n: number) => void; unit: string; id: string }) {
  return (
    <label className="block rounded-sm border border-border p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1"><input data-testid={`input-${id}`} type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-transparent font-display text-2xl font-extrabold outline-none tnum" /><span className="text-xs text-muted-foreground">{unit}</span></div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </label>
  );
}

function Editor() {
  const q = useGetConfig({ query: { queryKey: getGetConfigQueryKey() } });
  const wards = useGetWards({ query: { queryKey: getGetWardsQueryKey() } });
  const [c, setC] = useState<Configuration | null>(null);
  const init = useRef(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  useEffect(() => { if (q.data && !init.current) { init.current = true; setC(structuredClone(q.data)); } }, [q.data]);
  const m = useUpdateConfig({ mutation: { onSuccess: (d) => { qc.setQueryData(getGetConfigQueryKey(), d); setC(structuredClone(d)); qc.invalidateQueries({ queryKey: getGetTicketsQueryKey() }); qc.invalidateQueries({ queryKey: getGetStatsQueryKey() }); toast({ title: 'Thresholds saved' }); } } });
  if (q.isLoading || !c) return q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <SkelRows n={6} />;
  const set = (p: Partial<Configuration>) => setC({ ...c, ...p });
  const setZone = (i: number, p: Partial<TrafficZone>) => set({ traffic_zones: c.traffic_zones.map((z, j) => (j === i ? { ...z, ...p } : z)) });
  const dirty = JSON.stringify(c) !== JSON.stringify(q.data);
  const inp = 'w-full rounded-sm border border-input bg-background px-2 py-1 text-sm font-mono';
  return (
    <div className="space-y-4">
      <Panel kicker="Evidence gates" title="Capture and verification thresholds">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field id="capture-max-age" label="Max capture age" unit="s" value={c.capture_max_age_s} onChange={(n) => set({ capture_max_age_s: n })} hint="Older frames are rejected as non-live." />
          <Field id="gps-max-accuracy" label="GPS accuracy limit" unit="m" value={c.gps_max_accuracy_m} onChange={(n) => set({ gps_max_accuracy_m: n })} hint="Fixes coarser than this are refused." />
          <Field id="dedup-radius" label="Dedup radius" unit="m" value={c.dedup_radius_m} onChange={(n) => set({ dedup_radius_m: n })} hint="Reports within merge into one ticket." />
          <Field id="repair-radius" label="Repair radius" unit="m" value={c.repair_radius_m} onChange={(n) => set({ repair_radius_m: n })} hint="Repair photo must be taken this close." />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Detector mode</span>
          {(['auto', 'onnx', 'vision'] as const).map((d) => <button key={d} data-testid={`button-detector-${d}`} onClick={() => set({ detector_mode: d })} className={`rounded-sm border px-3 py-1 font-mono text-xs uppercase transition-colors ${c.detector_mode === d ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}>{d}</button>)}
        </div>
      </Panel>
      <Panel kicker="Configured traffic index" title="Traffic zones" right={<button data-testid="button-add-zone" onClick={() => set({ traffic_zones: [...c.traffic_zones, { id: Math.max(0, ...c.traffic_zones.map((z) => z.id)) + 1, name: 'New zone', ward_id: wards.data?.[0]?.id ?? 1, center_lat: wards.data?.[0]?.center_lat ?? 18.5204, center_lng: wards.data?.[0]?.center_lng ?? 73.8567, radius_m: 300, density: 0.5 }] })} className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs hover:border-primary"><Plus className="h-3 w-3" />Add zone</button>}>
        {c.traffic_zones.length === 0 ? <EmptyState title="No traffic zones" hint="Without zones, priority uses severity alone." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{['Name', 'Ward', 'Lat', 'Lng', 'Radius m', 'Density', ''].map((h) => <th key={h} className="pb-2 pr-2 font-normal">{h}</th>)}</tr></thead>
              <tbody>
                {c.traffic_zones.map((z, i) => (
                  <tr key={i} data-testid={`row-zone-${i}`}>
                    <td className="pr-2 py-1"><input className={inp} value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} /></td>
                    <td className="pr-2"><select className={inp} value={z.ward_id} onChange={(e) => setZone(i, { ward_id: Number(e.target.value) })}>{wards.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>) ?? <option value={z.ward_id}>{z.ward_id}</option>}</select></td>
                    <td className="pr-2"><input type="number" step="0.0001" className={inp} value={z.center_lat} onChange={(e) => setZone(i, { center_lat: Number(e.target.value) })} /></td>
                    <td className="pr-2"><input type="number" step="0.0001" className={inp} value={z.center_lng} onChange={(e) => setZone(i, { center_lng: Number(e.target.value) })} /></td>
                    <td className="pr-2"><input type="number" className={inp} value={z.radius_m} onChange={(e) => setZone(i, { radius_m: Number(e.target.value) })} /></td>
                    <td className="pr-2"><input type="number" step="0.05" className={inp} value={z.density} onChange={(e) => setZone(i, { density: Number(e.target.value) })} /></td>
                    <td><button data-testid={`button-remove-zone-${i}`} onClick={() => set({ traffic_zones: c.traffic_zones.filter((_, j) => j !== i) })} className="p-1 text-muted-foreground hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {m.isError && <span className="text-sm text-rose-300">{errMsg(m.error)}</span>}
        {dirty && <button data-testid="button-reset-config" onClick={() => q.data && setC(structuredClone(q.data))} className="rounded-sm px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Discard</button>}
        <button data-testid="button-save-config" disabled={!dirty || m.isPending} onClick={() => m.mutate({ data: c })} className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40"><Save className="h-4 w-4" />{m.isPending ? 'Saving' : 'Save thresholds'}</button>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <div>
      <PageHead kicker="Commissioner" title="Thresholds and traffic zones" />
      <RequireRole roles={['commissioner']}><Editor /></RequireRole>
    </div>
  );
}
