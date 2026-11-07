import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import type { Ticket } from '@workspace/api-client-react';
import { StatusPill, SevMeter, DemoTag } from '@/components/bits';
import { ago } from '@/lib/core';

export function TicketTable({ tickets, compact = false }: { tickets: Ticket[]; compact?: boolean }) {
  const max = Math.max(1, ...tickets.map((t) => t.priority_score));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="py-2 pl-1 pr-3 font-normal">#</th>
            <th className="py-2 pr-3 font-normal">Priority</th>
            <th className="py-2 pr-3 font-normal">Ticket</th>
            <th className="py-2 pr-3 font-normal">Severity</th>
            <th className="py-2 pr-3 font-normal">Status</th>
            {!compact && <th className="py-2 pr-3 font-normal">Traffic</th>}
            {!compact && <th className="py-2 pr-3 font-normal">Contractor</th>}
            <th className="py-2 pr-3 font-normal">Reports</th>
            <th className="py-2 pr-1 font-normal">Age</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tickets.map((t, i) => (
            <tr key={t.id} data-testid={`row-ticket-${t.id}`} className="group border-b border-border/50 transition-colors hover:bg-muted/40" style={{ animation: `rise .4s ${Math.min(i, 20) * 25}ms both` }}>
              <td className="py-2 pl-1 pr-3 font-mono text-xs text-muted-foreground tnum">{String(i + 1).padStart(2, '0')}</td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold tnum text-primary" data-testid={`text-priority-${t.id}`}>{t.priority_score.toFixed(1)}</span>
                  <span className="h-1 w-12 overflow-hidden rounded-full bg-muted"><span className="block h-full origin-left bg-primary transition-transform duration-700" style={{ transform: `scaleX(${t.priority_score / max})` }} /></span>
                </div>
              </td>
              <td className="max-w-[300px] py-2 pr-3">
                <Link href={`/tickets/${t.id}`} className="block" data-testid={`link-ticket-${t.id}`}>
                  <div className="flex items-center gap-1.5"><span className="font-mono text-[11px] text-[#6EA8FF]">{t.id}</span>{t.is_demo && <DemoTag />}</div>
                  <div className="truncate font-medium group-hover:text-primary transition-colors">{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.location} · {t.ward_name}</div>
                </Link>
              </td>
              <td className="py-2 pr-3"><SevMeter value={t.severity} /></td>
              <td className="py-2 pr-3"><StatusPill status={t.status} /></td>
              {!compact && <td className="py-2 pr-3 font-mono text-xs tnum">{t.traffic_density.toFixed(2)}</td>}
              {!compact && <td className="py-2 pr-3 text-xs">{t.contractor_name ?? <span className="text-muted-foreground">Unassigned</span>}</td>}
              <td className="py-2 pr-3 font-mono text-xs tnum">{t.report_count}</td>
              <td className="py-2 pr-1 font-mono text-xs text-muted-foreground whitespace-nowrap">{ago(t.created_at)}</td>
              <td className="py-2 pr-1"><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
