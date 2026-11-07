# NagarDrishti Mobile

Native Expo / React Native citizen and contractor companion to the existing
NagarDrishti FastAPI service. This package is at `artifacts/mobile/`, with
registered preview path `/mobile/`. It does not create a backend or database.
The existing Vite web app remains at `/`.

## Configure and run

From the repository root:

```sh
pnpm install
```

Set the non-secret **development** environment variable:

```text
EXPO_PUBLIC_API_URL=https://YOUR_REACHABLE_API_ORIGIN
```

Use the existing API's HTTPS origin, **without `/api`** or a trailing route.
The shared client supplies `/api/...` paths. Physical phones cannot reach
your computer using `localhost`; use the externally reachable development API.
There is deliberately no default or hardcoded production hostname.

For local development outside this workspace, copy `.env.example` to `.env.local`
and replace the example. `EXPO_PUBLIC_*` values are bundled publicly, so never
put passwords, JWTs, signing secrets or provider keys there. Restart Expo after
changing the API URL.

In this workspace start the managed workflow **`artifacts/mobile: expo`**.
The existing **`artifacts/api-server: API Server`** serves all API requests.
Use the native preview/Expo Go to exercise device camera and GPS. Browser preview
is a convenience and does not replace native verification.

For the Expo **browser preview**, the existing API's `CORS_ORIGINS` must include
the Expo browser origin. Native bearer requests do not require browser CORS.
Development configuration includes that origin; existing web cookie behavior
is unchanged.

## Flows

- **Citizen:** sign in, view own accepted/rejected captures and linked tickets,
  capture a new live hazard, preview/retake, submit, and view the server result.
  Existing web registration can create citizen accounts.
- **Contractor:** sign in, view own assigned tickets by active/closed/all, inspect
  before/after evidence and event history, open map directions, and submit repair
  evidence only for their own non-demo ASSIGNED/REOPENED tickets.
- Junior Engineers and commissioners use the web app for assignment and review.
- Tickets and reports refresh every 15 seconds while active; pull-to-refresh
  is available. Uploads invalidate the shared query cache.

## Sessions and uploads

- Login uses the existing `/api/auth/login`; protected requests send the returned
  bearer JWT. Native sessions are stored in Expo SecureStore and scoped to the
  configured API origin, then checked with `/api/me` on restoration.
- Browser-preview sessions are memory-only. No JWT is written to localStorage.
- Logout clears this client's token and private query cache. The existing API's
  JWTs are stateless: clearing this device does not revoke copies elsewhere.
  Native requests omit cookies to avoid mixing them with a web session.
- Shared generated React Query hooks remain the source of API operations.
  The shared fetch client has an optional transport override; this app opts in
  to `expo/fetch` on native so generated multipart uploads accept filesystem
  `File` objects. Vite continues to use normal browser fetch.
- Uploads have no automatic retries. If a timeout/network error leaves the
  outcome unknown, inspect the report/ticket list before making a new capture.

## Capture policy

`expo-camera` captures from the rear-facing camera. There is no gallery/import
control. Both camera and foreground location permissions are required, with
request/retry and device-settings guidance for denied permissions.

Capture metadata contains `capture_source=live_camera`, an ISO capture time,
latitude, longitude, and accuracy. A fresh high-accuracy GPS watch is obtained
after the photo, with a 25-second timeout. Its subscription is removed on
completion, cancellation, backgrounding or unmount.

Client guards reject photos older than 120 seconds, GPS accuracy worse than
50 m, stale GPS fixes older than 30 seconds, and repair distance over 15 m.
Retake if either photo or GPS freshness expires. The server remains authoritative
and may apply tighter commissioner settings, image-quality checks, screen
checks and AI verification. No client-generated closure decisions or AI scores
are sent.

Temporary capture files are discarded on retake, successful submission and
screen cleanup. No background tracking is requested.

Synthetic seeded photos **cannot** verify real repairs; the app explains this
and disables those submissions, matching backend policy.

## Verification

From the repository root:

```sh
pnpm run typecheck
pnpm --filter @workspace/mobile exec tsx --test tests/*.test.ts
```

From `artifacts/mobile`:

```sh
CI=1 pnpm exec expo install --check
pnpm dlx expo-doctor@latest
```

Unit tests cover client capture freshness/GPS/distance rules and shared fetch
native/default-browser transport behavior. They are not physical camera tests.

Observed during this addition:

- Workspace TypeScript checks passed; the final mobile-specific check passed.
- All 10 client policy/transport tests passed.
- Expo dependency alignment passed, and Expo Doctor passed 20/20 checks.
- iOS and Android native bundles compiled successfully (not installed on a device).
- At 400×850, browser interaction checks passed for invalid-login errors, citizen
  and contractor sign-in, role-scoped lists/details, contractor filters, and logout.
- A camera-route navigation-context failure was fixed using the installed Expo
  Router hooks. A focused browser recheck reached the camera/location permission
  screen without the previous crash and confirmed there was no gallery picker.
- The existing Vite `/tickets/ND-1058` page still loaded successfully.

The headless browser could not grant actual camera/location hardware permission.
No real capture upload or repair submission was performed in that browser run,
and native SecureStore restoration was not exercised on a physical device.

Physical-device acceptance still needs both citizen and contractor accounts
and real on-site evidence:

1. Deny each permission, then grant it and confirm recovery.
2. Capture an actual road defect, submit it, and check the returned ticket.
3. Confirm the same report appears on the existing web dashboard on its next
   15-second refresh.
4. Assign the genuine ticket to the contractor using authorized web staff access.
5. Capture the repaired location within 15 m; inspect the actual server decision
   on mobile and web. Uncertainty must not become an automatic closure.
6. Exercise stale capture, poor GPS, wrong location, interrupted network,
   background/foreground, logout and restored/expired sessions.

Generated pictures, injected AI fixtures and browser emulation are not proof
that genuine repairs are correctly verified. No publishing or deployment is
performed as part of this addition.
