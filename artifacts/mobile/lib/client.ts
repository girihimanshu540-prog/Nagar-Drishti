import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import {
  setAuthTokenGetter, setBaseUrl, setFetchImplementation,
} from '@workspace/api-client-react';
import { apiOrigin } from './config';

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
export const setToken = (value: string | null) => { token = value; };
export const setUnauthorizedHandler = (callback: (() => void) | null) => { onUnauthorized = callback; };
setBaseUrl(apiOrigin || null);
setAuthTokenGetter(() => token);

// Only the mobile bundle opts in. The existing Vite client's transport is unchanged.
const transport = Platform.OS === 'web' ? globalThis.fetch.bind(globalThis) : expoFetch;
setFetchImplementation((async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  init?.signal?.addEventListener('abort', abort);
  if (init?.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, init?.body instanceof FormData ? 300_000 : 25_000);
  try {
    // Do not mix a browser's existing web-session cookie with this bearer session.
    const response = await transport(input as string, { ...init, credentials: 'omit', signal: controller.signal });
    if (response.status === 401 && token) onUnauthorized?.();
    return response;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abort);
  }
}) as typeof fetch);

export function errorMessage(error: unknown): string {
  const candidate = error as { data?: { error?: { message?: string } }; name?: string; message?: string };
  if (candidate?.data?.error?.message) return candidate.data.error.message;
  if (candidate?.name === 'AbortError') return 'The request timed out. Refresh the ticket or report list before retrying; the server may have received it.';
  if (candidate?.message?.includes('Network request failed') || candidate?.message?.includes('Failed to fetch')) {
    return 'Cannot reach the API. Check your connection and the configured API address, then retry.';
  }
  return candidate?.message || 'Something went wrong. Please try again.';
}
