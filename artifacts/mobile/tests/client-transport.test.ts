import test from 'node:test';
import assert from 'node:assert/strict';
import { customFetch, setAuthTokenGetter, setBaseUrl, setFetchImplementation } from '../../../lib/api-client-react/src/custom-fetch';

test('native transport sends bearer token and parses a response without Response.body', async () => {
  let observed: { input?: RequestInfo | URL; init?: RequestInit } = {};
  setBaseUrl('https://api.example.test');
  setAuthTokenGetter(() => 'test-token-not-a-credential');
  setFetchImplementation((async (input: RequestInfo | URL, init?: RequestInit) => {
    observed = { input, init };
    return {
      ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
      body: undefined, text: async () => '{"id":5}',
    } as unknown as Response;
  }) as typeof fetch);
  try {
    assert.deepEqual(await customFetch('/api/me'), { id: 5 });
    assert.equal(observed.input, 'https://api.example.test/api/me');
    assert.equal(new Headers(observed.init?.headers).get('Authorization'), 'Bearer test-token-not-a-credential');
  } finally { setFetchImplementation(null); setBaseUrl(null); setAuthTokenGetter(null); }
});

test('web still uses default fetch and preserves cookie request options', async () => {
  const original = globalThis.fetch;
  let observed: RequestInit | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    observed = init;
    return new Response('{"status":"ok"}', { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    assert.deepEqual(await customFetch('/api/healthz', { credentials: 'include' }), { status: 'ok' });
    assert.equal(observed?.credentials, 'include');
    assert.equal(new Headers(observed?.headers).has('Authorization'), false);
  } finally { globalThis.fetch = original; }
});
