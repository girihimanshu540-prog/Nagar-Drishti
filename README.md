# NagarDrishti

Citizen road-hazard reporting and human-reviewed repair tracking.

**Public-launch mode: all automated pothole detection and image verification are disabled.**
Reports are submissions, not AI-confirmed defects. Every repair requires an engineer's
written decision. See [launch review and remaining blockers](LAUNCH_READINESS.md).

## Delivered scope

The project includes the **web application**, a **native Expo / React Native companion**,
and one shared **FastAPI + PostgreSQL** backend. Both clients provide citizen and
contractor live-camera workflows. The native client lives in `artifacts/mobile/`,
registered at `/mobile/`; it does not duplicate the backend or replace the web app.
See [mobile setup and device acceptance](artifacts/mobile/README.md).

### Included

- Public read-only overview, public map and ticket-ID tracker.
- Role login, citizen registration, bcrypt password hashes, signed JWTs in secure HTTP-only cookies.
- Four role-specific views: citizen, contractor, Junior Engineer and commissioner.
- Leaflet / OpenStreetMap hazard map, search, status/ward/severity filters, priority sorting and CSV export.
- Live-camera citizen reports and contractor repairs; no gallery picker.
- Local image-quality and timestamp/GPS checks only; no content or screen detection.
- No ONNX inference, external vision fallback, SSIM or ORB in live submission routes.
- 10 m report grouping and configured traffic-index ordering. New reports use an
  untriaged default severity, not an automated risk assessment.
- Every valid repair submission enters engineer review; no automatic closure.
- Assignment, reasoned JE approvals/rejections and transactional ticket audit events.
- Commissioner settings and traffic-zone create/edit/delete; open priorities recomputed on changes.
- Persistent evidence in App Storage; metadata in PostgreSQL.
- 15-second polling for operational data.
- Clearly labeled synthetic demonstration tickets, excluded from live metrics.
- Public approximate locations; raw evidence and precise GPS restricted to authorized parties.
- Public privacy notice at `/privacy`; operator/contact and retention details still block launch.

## Project map

| Location | Purpose |
|---|---|
| `api/` | FastAPI, SQLAlchemy models, role auth, serializers, App Storage |
| `api/ai/pipeline.py` | Local capture checks plus archived, inactive analysis utilities |
| `api/config.py` | Capture defaults and hard-disabled launch detection mode |
| `artifacts/nagardrishti/` | React, Vite, Tailwind web app |
| `artifacts/mobile/` | Expo native citizen/contractor companion; live camera, GPS and bearer sessions |
| `artifacts/api-server/` | Managed service launcher for the Python API |
| `lib/api-spec/openapi.yaml` | Web-client API contract |
| `lib/api-client-react/` | Generated React Query hooks |
| `seed.py` | Explicit development-only schema initialization, without account or report seeding |
| `tests/` | Policy tests and optional deployment smoke runner |

## Setup

Requires Python 3.12+, uv, Node.js, pnpm and PostgreSQL. This project's managed workflows
already provide routing and ports.

```sh
pnpm install
uv sync --frozen
uv run python seed.py --init
pnpm --filter @workspace/api-spec run codegen
```

`seed.py --init` only creates missing **development** tables. It is never run at startup,
in a publish build or against production. Re-running the seed does not reset existing tickets.

Start or restart the two managed workflows:

- `artifacts/api-server: API Server`
- `artifacts/nagardrishti: web`

For native development also start `artifacts/mobile: expo`, after setting
`EXPO_PUBLIC_API_URL`. The existing web workflow and `/` routes are unchanged.

Outside Replit, the equivalent development commands are:

```sh
PORT=8080 uv run python -m api.run
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/nagardrishti run dev
```

For non-Replit hosting, route `/api`, `/docs` and `/health` to the API service and all
other paths to the Vite app. Both apps expect these same-origin paths. Configure your
reverse proxy rather than hardcoding a backend host in browser code.

## Environment variables

Never commit real secret values.

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection, provided by the project database |
| `SESSION_SECRET` | Required secret for JWT signatures; use a high-entropy value |
| `APP_ENV` | Set `production` for launch safeguards (production NODE_ENV also activates them) |
| `DETECTOR_MODE` | Ignored; runtime settings force `disabled` even if stored settings say otherwise |
| AI/vision credentials | Not required or used by public-launch reporting and repair routes |
| `PRIVATE_OBJECT_DIR` | Managed App Storage bucket/prefix for evidence |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Managed App Storage bucket |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Managed public storage prefixes |
| `CORS_ORIGINS` | Optional comma-separated allowed browser origins |
| `EXPO_PUBLIC_API_URL` | Public API origin for Expo; no `/api` suffix; must be reachable from the phone |
| `PORT` / `BASE_PATH` | Injected by the managed workflows |

No live submission route invokes an AI provider. Existing AI secrets do not enable
detection. No live endpoint substitutes seed data or test results.

## Account provisioning and recovery

No shared login credentials or sample sign-in buttons are provided. `seed.py --init`
creates missing development tables only: no accounts, wards, traffic zones or reports.
Provision genuine wards and staff through an operator-controlled process. Public
registration creates citizens only; unknown/duplicate email requests return the same
message. Citizens must prove email ownership before sign-in, including legacy accounts.

Verification and password reset use 30-minute single-use codes, stored only as SHA-256
digests. Requesting a replacement invalidates the previous code of that kind. Completion
invalidates every outstanding code and all existing cookie/bearer sessions, then requires
fresh sign-in. The owner chooses the final password during verification to prevent
pre-registered accounts retaining someone else's chosen password.

Both sign-in screens offer recovery and verification requests plus code entry. Web
email links carry the code in a fragment, removed on load; opening a link never consumes
it. Native users can enter the email code in the app or finish on the web and sign in
on their phone. Native SecureStore and bearer transport remain unchanged.

**Email delivery is not enabled.** The integration offer was dismissed; no provider
was connected and no messages were sent. Requests return `503 EMAIL_UNAVAILABLE`
until an operator explicitly approves and configures a provider. A vendor-neutral
SMTP adapter is available for that later setup; it requires authenticated TLS on port
587 and never falls back to plaintext, token logs, local mail files or fake success.
Delivery runs after the HTTP response to avoid exposing account existence through
provider latency; provider errors are logged without personal data and require operator
attention. The request response deliberately does not claim delivery.

Future operator configuration (use secure workspace secrets for credentials):
`ACCOUNT_EMAIL_APPROVED=true`, `ACCOUNT_PUBLIC_ORIGIN` (trusted HTTPS web origin),
`ACCOUNT_SMTP_HOST`, `ACCOUNT_SMTP_USERNAME`, `ACCOUNT_SMTP_PASSWORD`, and
`ACCOUNT_EMAIL_FROM` (authorized sender). Do not enable delivery before operator
approval and end-to-end delivery checks. No provider credentials belong in clients.

Apply additive development tables explicitly with
`uv run python -m scripts.migrate_account_security`; never run schema DDL at startup
or in a build. Production schema changes follow the managed Publish review when
publishing is authorized, not this development-only script.

`uv run python -m scripts.retire_demo_accounts` permanently removes legacy sample
sign-ins in development. Referenced account IDs are retained only as anonymized,
non-login historical identities, preserving all reports and audit links. Unreferenced
sample account rows are deleted. The cleanup never modifies real accounts or reports.
Legacy sample reports remain labeled and excluded from live metrics.

## API

- Interactive OpenAPI docs: `/docs` or `/api/docs`
- Runtime schema: `/api/openapi.json`
- Health: `/health` or `/api/healthz`
- All app operations use the `/api` prefix.
- Errors: `{"error":{"code":"…","message":"…"}}`
- Native clients may send `Authorization: Bearer <access_token>` from login.
- Web uses same-origin secure HTTP-only session cookies.
- Uploads are multipart JPEG/PNG/WebP, maximum 8 MB; decoded size is limited to 25 MP.
- Basic per-process rate limiting protects auth and mutation requests.

For the native client, set `EXPO_PUBLIC_API_URL` to the existing API's reachable HTTPS
origin before starting/bundling Expo, without `/api`. The current development
configuration uses the development API, not a published service. See
`artifacts/mobile/.env.example`. Native sessions use SecureStore and bearer JWTs;
the browser preview uses an in-memory bearer session. The existing Vite app keeps
its HTTP-only cookie authentication.

## Launch submission and review policy

Capture must be tagged `live_camera`, within 120 seconds, and GPS accuracy <= 50 m.
Repair captures must be within 15 m of the ticket. Commissioner changes may tighten
but cannot loosen these product limits.

Priority is literally `0.6 * severity + 0.4 * configured_traffic_density`, where severity
is 1–5 and density is 0–1. Density is a **configured traffic index**, not live traffic.

New citizen photos pass local image-quality, recency and GPS checks and create or
join an unverified road-hazard ticket. Severity starts at an explicitly untriaged
default of 1; it is not a model score. Repair photos pass the same checks plus
proximity validation and always enter `NEEDS_JE_REVIEW`. A scoped engineer or
commissioner must approve/reject with meaningful notes. Contractors cannot approve.

The old `VERIFIED_CLOSED` status identifier is retained for compatibility. Its UI
label is simply "Closed": older records may predate human-only review.
Engineer-approved KPI counts require an actual recorded engineer approval.

The trained model, private stored object, manifest and historical 65% constant are
retained unchanged for offline research. Live routes do not import its detector,
restore its weights or invoke either model/vision fallback. Commissioners cannot
re-enable analysis using settings. Old inference results are not displayed as proof.
Offline model licensing still applies if those weights are redistributed.

### Limits that matter before field use

- A browser's `live_camera` metadata, GPS and time are **not cryptographic camera attestation**.
  A modified API client can lie about provenance. The camera-only UI and image checks reduce,
  but cannot eliminate, fraud. Do not use this build alone as authorization to pay contractors.
- No billing/payment integration or automatic bill release exists.
- There is no automated screen-photo or road-defect check. Human reviewers must
  assess evidence and may require an on-site inspection.
- Valid report GPS is assigned to the nearest configured ward. Production needs real ward
  boundary polygons and an explicit service-area policy.
- Rate limiting is per process; a distributed public service needs a shared limiter.
- Raw evidence is private and served only after authentication and ticket access checks.
  Public ticket lists/details show rounded coordinates, no photos or raw timelines.
- Operator identity, privacy contact, retention/deletion policy, authorized staff
  and native on-device testing remain required before launch.

## Tests and observed results

Run:

```sh
uv run python -m pytest tests/test_pipeline.py tests/test_api.py tests/test_launch.py -q
pnpm run typecheck
```

Launch API tests use rolled-back transactions and explicit storage fixtures; AI
functions are replaced with traps that fail if called. They do not prove device
camera/GPS, real field conditions or production readiness.

### Historical pre-launch checks (retired AI workflow)

The following older observations describe the former experimental workflow only,
not the current launch behavior or evidence that AI can verify repairs:

| Requested acceptance case | Observed evidence |
|---|---|
| 1. Valid report creates ticket/severity | PASS, application test with explicit detection fixture |
| 2. 6 m groups; 40 m creates new ticket | PASS, application test with isolated DB transaction |
| 3. 10-minute-old report rejected | PASS, application + image-policy tests |
| 4. Non-live capture rejected | PASS, application + image-policy tests |
| 5. Unrelated repair does not close | PASS for decision-policy test; real camera/photo integration not run |
| 6. Genuine repair closes | PASS for all-gates decision-policy fixture; genuine on-site before/after acceptance not run |
| 7. JE approve/reject audited | PASS, application tests for both decisions |
| 8. Mobile actions appear on web within 15 s | Isolated bearer-to-cookie API tests pass: new reports and rejected-repair audit events are visible to web reads in under 15 s. This tests shared-backend visibility, not browser polling or genuine cross-device capture-to-web acceptance, which remain unrun. Both clients poll every 15 s. |

Also observed: a **real managed vision call** detected the defect in the synthetic test
image, and **App Storage write/read round-trip passed**. These connectivity checks do
not establish genuine on-site repair accuracy. Public desktop and phone-sized layouts
were visually checked. The original signed-in web screens were not browser-interaction
tested. The native addition's Expo browser checks covered citizen/contractor login,
role-scoped lists/details, filters, logout and the capture permission screen; the
existing Vite ticket page also passed a smoke check. Ten mobile policy/transport tests,
TypeScript checks and Expo Doctor's 20 checks passed. Native bundle compilation is not
physical-device camera/GPS, SecureStore or genuine field-image acceptance.

Optional deployment smoke runner:

```sh
uv run python tests/e2e.py --base-url https://YOUR_VERIFIED_HOST
```

This script checks public reads and photo redaction without using account credentials; it is **not** a full camera E2E test and
has not been run as a first-build browser test.

## Publishing

Artifact service definitions contain build/run/health configuration. The API build installs
locked Python dependencies; startup runs FastAPI through the managed service launcher.
No schema mutation runs during build/startup. The managed Publish flow handles development
schema changes for its production database. Review production data handling and provision
authorized accounts before use; do not seed public demo staff into a live municipal service.

The native Expo client is implemented. Genuine field-image acceptance and physical
cross-device end-to-end verification remain to be performed. This addition has not
been published or deployed.
