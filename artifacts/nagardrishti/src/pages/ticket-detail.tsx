import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Check, X, UserCheck, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetTicket, getGetTicketQueryKey, useGetPublicTicket, getGetPublicTicketQueryKey, useGetContractors, getGetContractorsQueryKey,
  useAssignTicket, useReviewTicket, useSubmitRepair, getGetTicketsQueryKey, getGetStatsQueryKey, getGetActivityQueryKey,
  type TicketDetail, type Repair, type CaptureResult,
} from '@workspace/api-client-react';
import { Panel, StatusPill, SevMeter, DemoTag, EvidenceImage, Skel, ErrorState, EmptyState } from '@/components/bits';
import { LiveCamera } from '@/components/live-camera';
import { POLL, useAuth, errMsg, errStatus, fmtDate, fmtNum, ago } from '@/lib/core';
import { useToast } from '@/hooks/use-toast';

function SyntheticNote() {
  return <div data-testid="banner-synthetic" className="rounded-sm border border-dashed border-[#0A6CFF]/60 bg-[#0A6CFF]/10 px-3 py-2 text-xs text-[#9EC3FF]"><b className="font-mono uppercase tracking-widest">Synthetic demonstration.</b> Images, bounding box and scores on this seeded ticket are illustrative values, not results from an AI model. Repairs submitted here return DEMO_EVIDENCE; file a real citizen report for real verification.</div>;
}

export function useInvalidateTicket() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetPublicTicketQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetTicketsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetActivityQueryKey() });
    qc.invalidateQueries({ queryKey: getGetContractorsQueryKey() });
  };
}

function Metric({ label, value, hint, good }: { label: string; value?: number | null; hint: string; good?: boolean }) {
  const v = value ?? null;
  return (
    <div className="rounded-sm border border-border p-2.5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-extrabold tnum ${v === null ? 'text-muted-foreground' : good ? 'text-emerald-300' : 'text-foreground'}`}>{v === null ? 'n/a' : v.toFixed(3)}</div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full origin-left bg-[#0A6CFF] transition-transform duration-700" style={{ transform: `scaleX(${v ?? 0})` }} /></div>
      <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</div>
    </div>
  );
}

export function RepairCard({ r, t }: { r: Repair; t: TicketDetail }) {
  const report = t.reports[0];
  return (
    <div data-testid={`card-repair-${r.id}`} className="space-y-3">
      {(t.is_demo || t.detector_engine === 'seed-demo') && <SyntheticNote />}
      <div className="grid gap-3 md:grid-cols-2">
        <EvidenceImage testid="img-before" label="Before · citizen" src={report?.image_url ?? t.before_image_url} bbox={report?.bbox} alt="Before repair" />
        <EvidenceImage testid={`img-after-${r.id}`} label={`After · ${fmtDate(r.captured_at)}`} src={r.image_url} bbox={report?.bbox} alt="After repair" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="SSIM global" value={r.ssim_global} hint="Whole-frame structural similarity. High means same scene framing." />
        <Metric label="SSIM defect region" value={r.ssim_defect_region} hint="Similarity inside the detection box. Low means the surface changed; high means the pothole may still be there." />
        <Metric label="Same location" value={r.same_location_score} hint="Confidence both photos show the same spot (GPS + scene match)." good={(r.same_location_score ?? 0) >= 0.7} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <div className="space-y-1 font-mono text-xs">
          <div><span className="text-muted-foreground">System decision </span><b className="uppercase text-primary">{r.decision}</b></div>
          <div><span className="text-muted-foreground">Vision verdict </span><b className="uppercase">{r.vision_verdict}</b></div>
          {r.je_decision && <div><span className="text-muted-foreground">JE decision </span><b className="uppercase text-[#6EA8FF]">{r.je_decision}</b></div>}
        </div>
        <div className="rounded-sm bg-muted/40 p-2.5 text-sm">
          <div>{r.vision_reason}</div>
          {r.je_notes && <div className="mt-1.5 border-t border-border pt-1.5 text-muted-foreground">JE notes: {r.je_notes}</div>}
        </div>
      </div>
    </div>
  );
}

export function ReviewForm({ t, onDone }: { t: TicketDetail; onDone?: () => void }) {
  const [notes, setNotes] = useState('');
  const inval = useInvalidateTicket();
  const { toast } = useToast();
  const m = useReviewTicket({ mutation: { onSuccess: () => { inval(t.id); setNotes(''); toast({ title: 'Review recorded', description: t.id }); onDone?.(); } } });
  const ok = notes.trim().length >= 10;
  return (
    <div className="space-y-2">
      <textarea data-testid={`input-review-notes-${t.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Engineering notes (min 10 characters): what you checked and why" className="w-full rounded-sm border border-input bg-background p-2 text-sm outline-none focus:border-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <button data-testid={`button-approve-${t.id}`} disabled={!ok || m.isPending} onClick={() => m.mutate({ id: t.id, data: { decision: 'approve', notes } })} className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-500/90 px-3 py-1.5 text-sm font-semibold text-[#0B0D12] transition-transform active:scale-95 disabled:opacity-40"><Check className="h-4 w-4" />Approve closure</button>
        <button data-testid={`button-reject-${t.id}`} disabled={!ok || m.isPending} onClick={() => m.mutate({ id: t.id, data: { decision: 'reject', notes } })} className="inline-flex items-center gap-1.5 rounded-sm bg-rose-500/90 px-3 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"><X className="h-4 w-4" />Reject and reopen</button>
        <span className="font-mono text-[10px] text-muted-foreground">{notes.trim().length}/10</span>
      </div>
      {m.isError && <div className="text-sm text-rose-300">{errMsg(m.error)}</div>}
    </div>
  );
}

function AssignBox({ t }: { t: TicketDetail }) {
  const c = useGetContractors({ query: { queryKey: getGetContractorsQueryKey() } });
  const [cid, setCid] = useState<string>(t.assigned_contractor_id ? String(t.assigned_contractor_id) : '');
  const inval = useInvalidateTicket();
  const { toast } = useToast();
  const m = useAssignTicket({ mutation: { onSuccess: () => { inval(t.id); toast({ title: 'Contractor assigned' }); } } });
  return (
    <div className="space-y-2">
      {c.isError ? <ErrorState error={c.error} onRetry={() => c.refetch()} /> : (
        <select data-testid="select-contractor" value={cid} onChange={(e) => setCid(e.target.value)} disabled={c.isLoading} className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm">
          <option value="">{c.isLoading ? 'Loading contractors' : 'Choose contractor'}</option>
          {c.data?.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.company} · {(x.verification_rate * (x.verification_rate <= 1 ? 100 : 1)).toFixed(0)}% verified</option>)}
        </select>
      )}
      <button data-testid="button-assign" disabled={!cid || m.isPending} onClick={() => m.mutate({ id: t.id, data: { contractor_id: Number(cid) } })} className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-[#0A6CFF] px-3 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"><UserCheck className="h-4 w-4" />{m.isPending ? 'Assigning' : t.assigned_contractor_id ? 'Reassign' : 'Assign'}</button>
      {m.isError && <div className="text-sm text-rose-300">{errMsg(m.error)}</div>}
    </div>
  );
}

function RepairSubmit({ t }: { t: TicketDetail }) {
  const inval = useInvalidateTicket();
  const [res, setRes] = useState<CaptureResult | null>(null);
  const m = useSubmitRepair({ mutation: { onSuccess: (r) => { setRes(r); inval(t.id); } } });
  return (
    <div className="space-y-3">
      <LiveCamera ticketLocation={{ lat: t.lat, lng: t.lng }} submitLabel="Submit repair evidence" submitting={m.isPending} onSubmit={(input) => { setRes(null); m.mutate({ id: t.id, data: input }); }} />
      {m.isError && <div data-testid="text-repair-error" className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-rose-200">{errMsg(m.error)}</div>}
      {res && <div data-testid="text-repair-result" className={`rounded-sm border p-2.5 text-sm ${res.accepted ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-amber-400/40 bg-amber-400/10'}`}><b className="uppercase">{res.decision}</b> · {res.reason} <span className="font-mono text-xs text-muted-foreground">({res.detector_engine})</span></div>}
    </div>
  );
}

export default function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const priv = useGetTicket(id, { query: { queryKey: getGetTicketQueryKey(id), refetchInterval: POLL, enabled: !!user && !!id, retry: false } });
  const pub = useGetPublicTicket(id, { query: { queryKey: getGetPublicTicketQueryKey(id), refetchInterval: POLL, enabled: !loading && (!user || (priv.isError && errStatus(priv.error) === 403)) && !!id, retry: false } });
  const q = user && !(priv.isError && errStatus(priv.error) === 403) ? priv : pub;
  const t = q.data;

  if (loading || q.isLoading) return <div className="space-y-4"><Skel className="h-16" /><div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Skel className="h-96" /><Skel className="h-96" /></div></div>;
  if (q.isError || !t) return <div className="space-y-3"><Link href="/tickets" className="text-sm text-primary">Back to tickets</Link><ErrorState error={q.error ?? new Error('Not found')} onRetry={() => q.refetch()} title={errStatus(q.error) === 404 ? 'Ticket not found' : 'Could not load ticket'} /></div>;

  const isPublic = q === pub;
  const role = user?.role;
  const canAssign = !isPublic && (role === 'je' || role === 'commissioner') && ['OPEN', 'REOPENED', 'ASSIGNED'].includes(t.status);
  const canReview = !isPublic && (role === 'je' || role === 'commissioner') && t.status === 'NEEDS_JE_REVIEW';
  const canRepair = !isPublic && role === 'contractor' && user && t.assigned_contractor_id === user.id && ['ASSIGNED', 'REOPENED'].includes(t.status);
  const report = t.reports[0];
  const repairs = [...t.repairs].reverse();

  return (
    <div>
      <Link href="/tickets" data-testid="link-back" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" />Tickets</Link>
      <div className="rise mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span data-testid="text-ticket-id" className="font-mono text-sm text-[#6EA8FF]">{t.id}</span><StatusPill status={t.status} />{t.is_demo && <DemoTag />}{isPublic && <span className="rounded-sm border border-border px-1.5 py-px font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">public view</span>}</div>
          <h1 data-testid="text-ticket-title" className="mt-1 font-display text-2xl font-extrabold md:text-3xl">{t.title}</h1>
          <div className="text-sm text-muted-foreground">{t.location} · {t.ward_name} · {t.lat.toFixed(5)}, {t.lng.toFixed(5)}</div>
          {role === 'contractor' && <a href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary hover:underline">Open location in maps</a>}
        </div>
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-md border border-border bg-border text-center">
          {[['Priority', fmtNum(t.priority_score)], ['Traffic', fmtNum(t.traffic_density, 2)], ['Reports', t.report_count], ['Opened', ago(t.created_at)]].map(([k, v]) => (
            <div key={k as string} className="bg-card px-3 py-2"><div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">{k}</div><div className="font-mono text-base font-bold tnum">{v}</div></div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Panel kicker={`Detector · ${t.detector_engine}`} title="Hazard evidence" right={<SevMeter value={t.severity} />}>
            {(t.is_demo || t.detector_engine === 'seed-demo') && <div className="mb-3"><SyntheticNote /></div>}
            <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
              <EvidenceImage testid="img-hazard" label="Detection" src={report?.image_url ?? t.before_image_url} bbox={report?.bbox} alt="Reported hazard" />
              {report ? (
                <dl className="grid content-start grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Validation</dt><dd className="font-mono uppercase">{report.validation_status}</dd>
                  <dt className="text-muted-foreground">Reason</dt><dd>{report.reason}</dd>
                  <dt className="text-muted-foreground">Captured</dt><dd className="font-mono">{fmtDate(report.captured_at)}</dd>
                  <dt className="text-muted-foreground">Source</dt><dd className="font-mono">{report.capture_source}</dd>
                  <dt className="text-muted-foreground">GPS accuracy</dt><dd className="font-mono">{report.gps_accuracy_m !== undefined ? `${report.gps_accuracy_m.toFixed(1)} m` : '—'}</dd>
                  <dt className="text-muted-foreground">Engine</dt><dd className="font-mono">{report.detector_engine}</dd>
                  <dt className="text-muted-foreground">BBox</dt><dd className="font-mono">{report.bbox?.map((n) => n.toFixed(2)).join(', ') ?? 'none'}</dd>
                </dl>
              ) : <EmptyState title="No report detail" hint={isPublic ? 'Report metadata is visible to signed-in staff.' : undefined} />}
            </div>
            {t.reports.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {t.reports.slice(1).map((r) => <img key={r.id} src={r.image_url} alt="" title={r.reason} className="h-16 w-24 shrink-0 rounded-sm border border-border object-cover" />)}
              </div>
            )}
          </Panel>

          <Panel kicker="Before / after" title="Repair verification">
            {repairs.length === 0 ? <EmptyState title="No repair submitted yet" hint="Closure requires live-camera repair evidence from the assigned contractor, compared against the original detection." /> : (
              <div className="space-y-6">{repairs.map((r) => <RepairCard key={r.id} r={r} t={t} />)}</div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          {canReview && <Panel kicker="Uncertain verification" title="JE decision" className="border-amber-400/40"><ReviewForm t={t} /></Panel>}
          {canAssign && <Panel kicker="Work order" title={t.contractor_name ? `Assigned · ${t.contractor_name}` : 'Assign contractor'}><AssignBox t={t} /></Panel>}
          {canRepair && <Panel kicker="Contractor" title="Submit repair evidence"><RepairSubmit t={t} /></Panel>}
          {!user && (
            <Panel bodyClass="text-sm text-muted-foreground"><ShieldCheck className="mb-1 h-4 w-4 text-primary" />Assignment, repair submission and JE review require sign-in. <Link href="/login" className="text-primary hover:underline">Sign in</Link></Panel>
          )}
          <Panel kicker="Immutable record" title="Audit timeline">
            {t.events.length === 0 ? <EmptyState title="No events" /> : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                {t.events.map((e) => (
                  <li key={e.id} data-testid={`event-${e.id}`} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-primary bg-background" />
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#6EA8FF]">{e.event_type}</div>
                    <div className="text-sm">{e.description}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{e.actor_name} · {fmtDate(e.at)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          {!isPublic && t.closed_at && <div className="font-mono text-xs text-muted-foreground">Closed {fmtDate(t.closed_at)}</div>}
        </div>
      </div>
      {q.isFetching && <span className="sr-only">refreshing</span>}
    </div>
  );
}
