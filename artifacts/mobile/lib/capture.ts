import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as Location from 'expo-location';
import type { CaptureInput } from '@workspace/api-client-react';
import { type CapturedEvidence, type Coordinates, type TicketLocation, validateEvidence } from './capture-policy';
export type { CapturedEvidence, TicketLocation };

/** Active subscription is removed on success, timeout, unmount or app background. */
export function freshLocation(signal: AbortSignal): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    let subscription: Location.LocationSubscription | undefined;
    let browserWatch: number | undefined;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      subscription?.remove();
      if (browserWatch !== undefined && Platform.OS === 'web') navigator.geolocation.clearWatch(browserWatch);
      signal.removeEventListener('abort', cancelled);
    };
    const finish = (value?: Coordinates, error?: Error) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(value!);
    };
    const cancelled = () => finish(undefined, new Error('Capture cancelled. Retake when you return to the camera.'));
    const timer = setTimeout(() => finish(undefined, new Error('Could not get an accurate GPS fix in 25 seconds. Move outdoors and retry.')), 25_000);
    signal.addEventListener('abort', cancelled);
    if (signal.aborted) { cancelled(); return; }
    const receive = (lat: number, lng: number, accuracy: number | null, timestamp: number) => {
      if (accuracy !== null && accuracy > 0 && accuracy <= 50 && Date.now() - timestamp <= 10_000) {
        finish({ lat, lng, accuracy, timestamp });
      }
    };
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) { finish(undefined, new Error('This browser does not support location. Use the native app.')); return; }
      browserWatch = navigator.geolocation.watchPosition(
        p => receive(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp),
        e => finish(undefined, new Error(e.message || 'Location is unavailable.')),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 },
      );
    } else {
      Location.watchPositionAsync({ accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 0 },
        p => receive(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp),
        e => finish(undefined, new Error(e)),
      ).then(s => { subscription = s; if (settled) s.remove(); })
        .catch(e => finish(undefined, e instanceof Error ? e : new Error('Location is unavailable.')));
    }
  });
}

export async function captureInput(evidence: CapturedEvidence, target?: TicketLocation): Promise<CaptureInput> {
  validateEvidence(evidence, target);
  const image = Platform.OS === 'web' ? await (await fetch(evidence.uri)).blob() : new File(evidence.uri);
  if (!image.size || image.size > 8 * 1024 * 1024) throw new Error('Photo must be smaller than 8 MB. Retake the photo.');
  // expo/fetch supports filesystem File/Blob through the generated FormData client.
  return {
    image: image as Blob, lat: evidence.lat, lng: evidence.lng, accuracy: evidence.accuracy,
    captured_at: evidence.capturedAt, capture_source: 'live_camera',
  };
}

export async function discardCapture(uri: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* OS may already have evicted the cache. */ }
  }
}
