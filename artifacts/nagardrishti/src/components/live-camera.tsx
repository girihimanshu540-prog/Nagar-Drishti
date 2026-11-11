import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Camera, CameraOff, Crosshair, RefreshCw, Send, X } from 'lucide-react';
import type { CaptureInput } from '@workspace/api-client-react';

type Captured = { blob: Blob; url: string; input: CaptureInput };

function camError(e: unknown): string {
  const n = (e as { name?: string })?.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Camera permission was denied. Allow camera access in your browser settings, then try again.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No usable camera was found on this device.';
  if (n === 'NotReadableError') return 'The camera is in use by another app. Close it and retry.';
  return 'Could not start the camera. ' + ((e as Error)?.message ?? '');
}
function geoError(e: GeolocationPositionError): string {
  if (e.code === 1) return 'Location permission denied. Precise GPS is required to file evidence.';
  if (e.code === 3) return 'GPS timed out. Move to open sky and capture again.';
  return 'Location unavailable: ' + e.message;
}

export function LiveCamera({ onSubmit, submitting, submitLabel, ticketLocation }: { onSubmit: (input: CaptureInput) => void; submitting: boolean; submitLabel: string; ticketLocation?: { lat: number; lng: number } }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'locating' | 'captured'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [shot, setShot] = useState<Captured | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => () => { stop(); }, [stop]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  async function start() {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia) { setErr('This browser does not support live camera capture. Use a recent mobile browser over HTTPS.'); return; }
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => undefined); }
      setState('live');
    } catch (e) { setErr(camError(e)); setState('idle'); }
  }

  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) { setErr('Camera frame not ready yet.'); return; }
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    const capturedAt = new Date().toISOString();
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    if (!blob) { setErr('Failed to encode the frame.'); return; }
    if (!navigator.geolocation) { setErr('Geolocation is not available on this device.'); return; }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (p.coords.accuracy > 50) {
          setErr('GPS accuracy is worse than 50 m. Move outdoors and retake the photo.');
          setState('live');
          return;
        }
        if (ticketLocation) {
          const rad = (n: number) => n * Math.PI / 180;
          const a = Math.sin(rad(p.coords.latitude - ticketLocation.lat) / 2) ** 2
            + Math.cos(rad(p.coords.latitude)) * Math.cos(rad(ticketLocation.lat))
            * Math.sin(rad(p.coords.longitude - ticketLocation.lng) / 2) ** 2;
          const distance = 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
          if (distance > 15) {
            setErr(`You are ${Math.round(distance)} m from this ticket. Move within 15 m and retake the photo.`);
            setState('live');
            return;
          }
        }
        stop();
        setShot({ blob, url: URL.createObjectURL(blob), input: { image: blob, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, captured_at: capturedAt, capture_source: 'live_camera' } });
        setState('captured');
      },
      (e) => { setErr(geoError(e)); setState('live'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function retake() { setShot(null); start(); }
  function cancel() { stop(); setShot(null); setState('idle'); }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-[#07090D]">
        <video ref={video} playsInline muted data-testid="video-camera" className={`h-full w-full object-cover transition-opacity duration-500 ${state === 'live' || state === 'locating' ? 'opacity-100' : 'opacity-0'}`} />
        {shot && <img src={shot.url} alt="Captured frame" data-testid="img-captured" className="absolute inset-0 h-full w-full object-cover" />}
        {(state === 'live' || state === 'locating') && (
          <>
            <div className="pointer-events-none absolute inset-6 border border-white/20">
              {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((k) => <span key={k} className={`absolute h-5 w-5 border-[#F26B1D] ${k}`} />)}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden"><div className="scanline h-16 w-full bg-gradient-to-b from-transparent via-[#F26B1D]/15 to-transparent" /></div>
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-[#0B0D12]/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"><span className="live-dot h-1.5 w-1.5 rounded-full bg-rose-500" />Live</div>
          </>
        )}
        {state === 'locating' && <div className="absolute inset-0 grid place-items-center bg-[#0B0D12]/70 font-mono text-xs uppercase tracking-widest"><span className="flex items-center gap-2"><Crosshair className="h-4 w-4 animate-spin" />Acquiring high-accuracy GPS</span></div>}
        {(state === 'idle' || state === 'starting') && !shot && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="space-y-3">
              <CameraOff className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Photos are taken live only. Gallery uploads are not accepted. Your photo and precise GPS are sent when you submit.</p>
              <button data-testid="button-start-camera" onClick={start} disabled={state === 'starting'} className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60">
                <Camera className="h-4 w-4" />{state === 'starting' ? 'Starting camera' : 'Start live camera'}
              </button>
            </div>
          </div>
        )}
      </div>
      <p data-testid="text-capture-consent" className="text-xs leading-relaxed text-muted-foreground">Frame the road surface only. Do not photograph faces, number plates or private property. Photos and precise location are visible only to you and authorised staff; the public tracker shows a general location. <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy notice</Link></p>
      {err && <div data-testid="text-camera-error" className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-rose-200">{err}</div>}
      {shot && (
        <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded-sm border border-border px-2 py-1.5"><div className="text-muted-foreground">LAT, LNG</div><div className="tnum">{shot.input.lat.toFixed(5)}, {shot.input.lng.toFixed(5)}</div></div>
          <div className="rounded-sm border border-border px-2 py-1.5"><div className="text-muted-foreground">ACCURACY</div><div className="tnum">{shot.input.accuracy.toFixed(1)} m</div></div>
          <div className="rounded-sm border border-border px-2 py-1.5"><div className="text-muted-foreground">CAPTURED</div><div className="tnum">{new Date(shot.input.captured_at).toLocaleTimeString('en-IN')}</div></div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {state === 'live' && <button data-testid="button-capture" onClick={capture} className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"><Camera className="h-4 w-4" />Capture frame</button>}
        {shot && <button data-testid="button-submit-capture" disabled={submitting} onClick={() => onSubmit(shot.input)} className="inline-flex items-center gap-2 rounded-sm bg-[#0A6CFF] px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"><Send className="h-4 w-4" />{submitting ? 'Uploading' : submitLabel}</button>}
        {shot && <button data-testid="button-retake" disabled={submitting} onClick={retake} className="inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm hover:border-primary"><RefreshCw className="h-4 w-4" />Retake</button>}
        {(state === 'live' || shot) && <button data-testid="button-cancel-camera" disabled={submitting} onClick={cancel} className="inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><X className="h-4 w-4" />Cancel</button>}
      </div>
    </div>
  );
}
