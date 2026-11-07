export interface Coordinates { lat: number; lng: number; accuracy: number; timestamp: number }
export interface CapturedEvidence extends Coordinates { uri: string; capturedAt: string }
export interface TicketLocation { lat: number; lng: number }

export function distanceMetres(a: TicketLocation, b: TicketLocation): number {
  const rad = (v: number) => v * Math.PI / 180;
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function validateEvidence(evidence: CapturedEvidence, target?: TicketLocation, now = Date.now()): void {
  if (!Number.isFinite(evidence.lat) || !Number.isFinite(evidence.lng) ||
      Math.abs(evidence.lat) > 90 || Math.abs(evidence.lng) > 180) throw new Error('GPS returned invalid coordinates. Try again outdoors.');
  if (!Number.isFinite(evidence.accuracy) || evidence.accuracy <= 0 || evidence.accuracy > 50) {
    throw new Error('GPS accuracy must be 50 m or better. Move to an open area and retake.');
  }
  const captureTime = Date.parse(evidence.capturedAt);
  if (!Number.isFinite(captureTime) || now - captureTime > 120_000 || captureTime - now > 15_000) {
    throw new Error('This capture has expired or the device clock is incorrect. Retake a live photo.');
  }
  if (!Number.isFinite(evidence.timestamp) || now - evidence.timestamp > 30_000 || evidence.timestamp - now > 15_000) {
    throw new Error('The GPS fix is stale. Retake to obtain a fresh location.');
  }
  if (target && distanceMetres(evidence, target) > 15) {
    throw new Error('You must be within 15 m of the ticket location. Move closer and retake.');
  }
}
