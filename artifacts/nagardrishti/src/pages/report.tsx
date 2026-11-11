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
        <Panel kicker="How it works" title="What happens to your report">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>The photo must be taken live from this camera, not a gallery.</li>
            <li>High-accuracy GPS is recorded at capture time.</li>
            <li>Simple checks confirm a recent photo and accurate GPS. They do not confirm that a hazard exists.</li>
            <li>Reports close together merge into one ticket. Staff review it and may assign a contractor.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Not an official municipal service and not for emergencies. No repair time is guaranteed. <Link href="/privacy" className="text-primary hover:underline" data-testid="link-report-privacy">Privacy notice</Link></p>
        </Panel>
        {m.isError && <div data-testid="text-report-error" className="rise rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-rose-200"><b>Not filed.</b> {errMsg(m.error)}</div>}
        {res && (
          <div role="status" data-testid="text-report-result" className={`rise rounded-md border p-4 ${res.accepted ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-amber-400/40 bg-amber-400/5'}`}>
            <div className="font-display text-lg font-bold">{res.accepted ? 'Report received, not yet reviewed' : 'Report not accepted'}</div>
            <div className="text-sm">{res.reason}</div>
            {res.accepted && <p className="mt-1 text-xs text-muted-foreground">Listed as an unverified road hazard report until staff review it.</p>}
            {res.ticket && <Link href={`/tickets/${res.ticket.id}`} className="mt-2 inline-flex min-h-[40px] items-center text-sm text-primary hover:underline">Open ticket {res.ticket.id}</Link>}
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
