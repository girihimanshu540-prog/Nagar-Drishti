/** EXPO_PUBLIC_API_URL is an origin, without /api. It is public, not a secret. */
export function parseApiOrigin(value: string | undefined): string {
  if (!value?.trim()) throw new Error('Set EXPO_PUBLIC_API_URL to the existing FastAPI HTTPS origin, then restart Expo.');
  const url = new URL(value.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname.replace(/\/+$/, '') || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must be an HTTP(S) origin without /api, credentials, query or fragment.');
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Use an HTTPS API origin reachable from the phone. localhost only works on the same machine.');
  }
  return url.origin;
}

let apiOrigin = '';
let configurationError: string | null = null;
try { apiOrigin = parseApiOrigin(process.env.EXPO_PUBLIC_API_URL); }
catch (error) { configurationError = error instanceof Error ? error.message : 'Invalid API configuration.'; }
export { apiOrigin, configurationError };

export function evidenceUrl(path: string): string {
  if (!path || !apiOrigin) return '';
  try { return new URL(path, `${apiOrigin}/`).toString(); } catch { return ''; }
}
/** True only when the URL is on the configured API origin, so credentials never go to third-party hosts. */
export function isApiUrl(url: string): boolean {
  if (!url || !apiOrigin) return false;
  try { return new URL(url).origin === apiOrigin; } catch { return false; }
}
/** Public privacy notice served by the web app on the same origin. */
export const privacyUrl = apiOrigin ? `${apiOrigin}/privacy` : '';
