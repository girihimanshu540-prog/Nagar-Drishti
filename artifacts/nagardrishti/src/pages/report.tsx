import { useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useSubmitReport, getGetMyReportsQueryKey, getGetTicketsQueryKey, getGetStatsQueryKey, getGetActivityQueryKey, type CaptureResult } from '@workspace/api-client-react';
import { PageHead, Panel } from '@/components/bits';
import { LiveCamera } from '@/components/live-camera';
import { RequireRole } from '@/components/shell';
import { errMsg } from '@/lib/core';

function Reporter() {
  const qc = useQueryClient();
  const [res, setRes] = useState<CaptureResult | null>(null);
  const m = useSubmitReport({ mutation: { onSuccess: (r) => { setRes(r); [getGetMyReportsQueryKey(), getGetTicketsQueryKey(), getGetStatsQueryKey(), getGetActivityQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k })); } } });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel kicker="Live capture" title="Point at the hazard">
        <LiveCamera submitLabel="File report" submitting={m.isPending} onSubmit={(input) => { setRes(null); m.mutate({ data: input }); }} />
      </Panel>
      <div className="space-y-4">
        <Panel kicker="Rules" title="What makes evidence count">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Frame taken live from this camera, not a gallery.</li>
            <li>High-accuracy GPS recorded at capture time.</li>
            <li>The detector must find a road defect in the frame.</li>
            <li>Nearby duplicates merge into one ticket and raise its priority.</li>
          </ol>
        </Panel>
        {m.isError && <div data-testid="text-report-error" className="rise rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-rose-200"><b>Not filed.</b> {errMsg(m.error)}</div>}
        {res && (
          <div data-testid="text-report-result" className={`rise rounded-md border p-4 ${res.accepted ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-amber-400/40 bg-amber-400/5'}`}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{res.detector_engine}</div>
            <div className="font-display text-lg font-bold">{res.accepted ? 'Report accepted' : 'Report not accepted'}</div>
            <div className="text-sm">{res.reason}</div>
            <div className="mt-1 font-mono text-xs">Decision: {res.decision}{res.severity !== undefined ? ` · severity ${res.severity}` : ''}</div>
            {res.ticket && <Link href={`/tickets/${res.ticket.id}`} className="mt-2 inline-block text-sm text-primary hover:underline">Open ticket {res.ticket.id}</Link>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Report() {
  return (
    <div>
      <PageHead kicker="Citizen" title="Report a road hazard" />
      <RequireRole roles={['citizen']}><Reporter /></RequireRole>
    </div>
  );
}
