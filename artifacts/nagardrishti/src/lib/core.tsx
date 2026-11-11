import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey, useGetMe, type TicketStatus, type User } from '@workspace/api-client-react';

export const POLL = 15000;

export function useAuth() {
  const q = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 30000 } });
  const user: User | undefined = q.isError ? undefined : q.data ?? undefined;
  return { user, loading: q.isLoading };
}

export function useResetSession() {
  const qc = useQueryClient();
  return async (user?: User) => {
    await qc.cancelQueries();
    const key = getGetMeQueryKey();
    // Keep the observed auth query alive so all views see logout immediately.
    qc.removeQueries({ predicate: (query) => JSON.stringify(query.queryKey) !== JSON.stringify(key) });
    qc.setQueryData(key, user ?? null);
  };
}

export function errMsg(e: unknown): string {
  if (!e) return 'Unknown error';
  const anyE = e as { data?: unknown; message?: string; status?: number };
  const d = anyE.data as { detail?: unknown; error?: string | { message?: string }; message?: string } | null | undefined;
  if (d) {
    if (typeof d.detail === 'string') return d.detail;
    if (Array.isArray(d.detail)) return d.detail.map((x: { msg?: string }) => x.msg ?? String(x)).join('; ');
    if (typeof d.error === 'string') return d.error;
    if (d.error?.message) return d.error.message;
    if (d.message) return d.message;
  }
  return anyE.message ?? 'Request failed';
}

export function errStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}

export const STATUS_META: Record<TicketStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Open', cls: 'text-[#F26B1D] border-[#F26B1D]/40 bg-[#F26B1D]/10' },
  ASSIGNED: { label: 'Assigned', cls: 'text-[#5B9BFF] border-[#0A6CFF]/40 bg-[#0A6CFF]/10' },
  REPAIR_SUBMITTED: { label: 'Repair submitted', cls: 'text-sky-300 border-sky-400/30 bg-sky-400/10' },
  NEEDS_JE_REVIEW: { label: 'Needs JE review', cls: 'text-amber-300 border-amber-400/40 bg-amber-400/10' },
  VERIFIED_CLOSED: { label: 'Closed', cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
  REOPENED: { label: 'Reopened', cls: 'text-rose-300 border-rose-400/40 bg-rose-400/10' },
};

/** The API severity contract is always 1..5. */
export function sevNorm(s: number) {
  return Math.min(1, Math.max(0, s / 5));
}
export function sevColor(s: number) {
  const n = sevNorm(s);
  if (n >= 0.75) return '#F0384A';
  if (n >= 0.5) return '#F26B1D';
  if (n >= 0.25) return '#F5B83D';
  return '#4FA3FF';
}
export function sevLabel(s: number) {
  const n = sevNorm(s);
  return n >= 0.75 ? 'Critical' : n >= 0.5 ? 'High' : n >= 0.25 ? 'Moderate' : 'Low';
}
export const fmtNum = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(d);

export function fmtDate(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function ago(s?: string | null) {
  if (!s) return '—';
  const t = new Date(s).getTime();
  if (isNaN(t)) return s;
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const ROLE_LABEL: Record<string, string> = {
  citizen: 'Citizen',
  contractor: 'Contractor',
  je: 'Junior Engineer',
  commissioner: 'Commissioner',
};
