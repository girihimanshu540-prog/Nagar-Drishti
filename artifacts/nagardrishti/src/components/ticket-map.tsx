import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Ticket } from '@workspace/api-client-react';
import { sevColor, STATUS_META } from '@/lib/core';

export function TicketMap({ tickets, onSelect, height = 420, center }: { tickets: Ticket[]; onSelect?: (id: string) => void; height?: number; center?: [number, number] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const selRef = useRef(onSelect);
  selRef.current = onSelect;
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(center ?? [18.5204, 73.8567], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    tickets.forEach((t) => {
      if (typeof t.lat !== 'number' || typeof t.lng !== 'number') return;
      const c = t.detector_engine === 'manual' ? '#8a8f9c' : sevColor(t.severity);
      const closed = t.status === 'VERIFIED_CLOSED';
      const mk = L.circleMarker([t.lat, t.lng], { radius: 6 + Math.min(8, t.report_count), color: closed ? '#34d399' : c, weight: 2, fillColor: c, fillOpacity: closed ? 0.15 : 0.55 });
      const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x] as string));
      mk.bindTooltip(`<div style="font-family:JetBrains Mono,monospace;font-size:11px"><b>${esc(t.id)}</b> ${t.is_demo ? '<span style="color:#6EA8FF">[SAMPLE DATA, not a real report]</span>' : ''}<br/>${esc(t.title)}<br/>${STATUS_META[t.status]?.label ?? t.status} · priority ${t.priority_score.toFixed(1)}<br/><span style="color:#8a8f9c">Location is approximate</span></div>`);
      mk.on('click', () => selRef.current?.(t.id));
      mk.addTo(g);
      pts.push([t.lat, t.lng]);
    });
    if (pts.length && !fitted.current) {
      m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
      fitted.current = true;
    }
  }, [tickets]);

  return (
    <div className="relative">
      <div ref={el} data-testid="map-tickets" style={{ height }} className="w-full overflow-hidden rounded-md border border-border" />
      <div className="pointer-events-none absolute bottom-2 left-2 z-[400] flex flex-wrap gap-2 rounded-sm bg-[#0B0D12]/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wider">
        {[['#F0384A', 'Critical'], ['#F26B1D', 'High'], ['#F5B83D', 'Mod'], ['#4FA3FF', 'Low'], ['#8a8f9c', 'Not triaged']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
        ))}
      </div>
    </div>
  );
}
