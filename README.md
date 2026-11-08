# NagarDrishti

Road-hazard reporting and repair verification. **No closure without verified evidence.**

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
- Live image quality checks, timestamp/GPS checks, screen heuristic plus vision assessment.
- Vision detection fallback; optional YOLOv8 ONNX inference without PyTorch.
- 10 m report grouping, maximum severity aggregation, configured traffic-index prioritization.
- SSIM global and defect-region checks, ORB/RANSAC surrounding-feature matching, independent vision comparison.
- Conservative repair decisions: verified closure, reopening, rejection, or JE review. Uncertainty never closes a ticket.
- Assignment, reasoned JE approvals/rejections and transactional ticket audit events.
- Commissioner settings and traffic-zone create/edit/delete; open priorities recomputed on changes.
- Persistent evidence in App Storage; metadata in PostgreSQL.
- 15-second polling for operational data.
- 25 clearly labeled synthetic demonstration tickets; no fake AI results in live flows.

## Project map

| Location | Purpose |
|---|---|
| `api/` | FastAPI, SQLAlchemy models, role auth, serializers, App Storage |
| `api/ai/pipeline.py` | Detection, image quality, geometry, SSIM/ORB and repair decisions |
| `api/config.py` | Central defaults and AI/verification thresholds |
| `artifacts/nagardrishti/` | React, Vite, Tailwind web app |
| `artifacts/mobile/` | Expo native citizen/contractor companion; live camera, GPS and bearer sessions |
| `artifacts/api-server/` | Managed service launcher for the Python API |
| `lib/api-spec/openapi.yaml` | Web-client API contract |
| `lib/api-client-react/` | Generated React Query hooks |
| `seed.py` | Explicit, idempotent development-only schema/data initialization |
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
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Managed OpenAI integration endpoint |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Managed OpenAI integration credential |
| `OPENAI_API_KEY` | Optional direct OpenAI key if the managed integration is not configured |
| `VISION_MODEL` | Optional; default `gpt-5.4-mini` |
| `DETECTOR_MODE` | `auto`, `onnx`, `vision`; initial default; commissioner settings override it |
| `PRIVATE_OBJECT_DIR` | Managed App Storage bucket/prefix for evidence |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Managed App Storage bucket |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Managed public storage prefixes |
| `DEMO_CENTER_LAT` / `DEMO_CENTER_LNG` | Seed center, defaults `18.5204` / `73.8567` (Pune) |
| `CORS_ORIGINS` | Optional comma-separated allowed browser origins |
| `EXPO_PUBLIC_API_URL` | Public API origin for Expo; no `/api` suffix; must be reachable from the phone |
| `PORT` / `BASE_PATH` | Injected by the managed workflows |

AI uses Replit AI Integrations: no personal API key is required; usage is billed to
Replit credits. Missing provider credentials or failed analysis returns an explicit error.
No live endpoint silently substitutes seed data or test results.

## Demo accounts

These accounts are deliberately public evaluation accounts, **not production credentials**.
All use password **`NagarDemo2026!`**.

| Role | Email |
|---|---|
| Citizen | `citizen@nagardrishti.demo` |
| Contractor | `contractor@nagardrishti.demo` |
| Junior Engineer | `je@nagardrishti.demo` |
| Commissioner | `commissioner@nagardrishti.demo` |
| Contractor 2 | `contractor5@nagardrishti.demo` |
| Contractor 3 | `contractor6@nagardrishti.demo` |

Open **Sign in**, choose a demo role to populate the form, then submit.
Anonymous users only receive read-only public access. Never expose these seeded privileged
accounts in a real municipal deployment: use a fresh production database and provision
authorized staff securely. Public registration always creates a citizen, never staff.
Staff account provisioning is an operational setup step, not a public registration endpoint.

The demo images were generated for this project. Seed scores, boxes and outcomes are
illustrative and explicitly labeled, not measurements. Real repair submission against
synthetic seed evidence is blocked. JE decisions on demo review tickets can be explored
and are audited, but remain demonstration decisions.

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

## Verification policy

Capture must be tagged `live_camera`, within 120 seconds, and GPS accuracy <= 50 m.
Repair captures must be within 15 m of the ticket. Commissioner changes may tighten
but cannot loosen these product limits.

Priority is literally `0.6 * severity + 0.4 * configured_traffic_density`, where severity
is 1–5 and density is 0–1. Density is a **configured traffic index**, not live traffic.

The supplied trained ONNX model is installed at `api/models/pothole.onnx`:
float32 RGB input `[1,3,640,640]`, YOLO detection output `[1,9,8400]`.
Only class 2 (`Pothole`) is used; the other four metadata labels are dataset
attribution strings, not supported defect categories. Overlapping predictions
are suppressed before computing severity. No pothole detection does not override
a vision-detected crack or other hazard.

The 12.8 MB binary is excluded from Git and stored durably in private App Storage.
`api/models/pothole.json` pins its SHA-256, size, class and storage key. If the local
file is missing, the loader restores it from the configured private bucket and
verifies its integrity before loading. Inference sessions are cached on CPU.
`auto` uses ONNX plus the existing vision assessment, falling back explicitly to
vision if model restoration/loading/inference fails. `vision` bypasses ONNX;
forced `onnx` mode returns an explicit unavailable error if the model fails.
Vision independently screens for screen photography even when ONNX is used,
and the existing repair-closure gates are unchanged. Models may make mistakes.

Model metadata declares AGPL-3.0 and includes a dataset CC BY 4.0 attribution;
confirm applicable model/data licensing before distributing or commercializing.

ONNX integration verification: CPU loading/inference and checksum-verified App
Storage restoration succeeded. `uv run python -m pytest tests/test_onnx_detector.py
tests/test_pipeline.py tests/test_api.py -q` passed 31 tests. This verifies integration
and policy behavior, not real-world detector accuracy or genuine repair acceptance.

SSIM is similarity, not proof of repair: surroundings must match, while the original
defect region must change. Missing boxes or weak feature evidence require JE review.
The backend does not accept client-provided verification scores or close decisions.

### Limits that matter before field use

- A browser's `live_camera` metadata, GPS and time are **not cryptographic camera attestation**.
  A modified API client can lie about provenance. The camera-only UI and image checks reduce,
  but cannot eliminate, fraud. Do not use this build alone as authorization to pay contractors.
- No billing/payment integration or automatic bill release exists.
- ORB uses surrounding features and homography inliers, but does not warp SSIM regions.
  Significant viewpoint changes conservatively go to JE review.
- Screen FFT checks are heuristic; independent vision is required.
- Valid report GPS is assigned to the nearest configured ward. Production needs real ward
  boundary polygons and an explicit service-area policy.
- Rate limiting is per process; a distributed public service needs a shared limiter.
- Evidence is publicly viewable for published tickets. Photo privacy/redaction and retention
  policy need municipal approval before real public rollout.

## Tests and observed results

Run:

```sh
uv run python -m pytest tests/test_pipeline.py tests/test_api.py -q
pnpm run typecheck
```

**Observed: 24 tests passed; full TypeScript check passed.**
Policy tests use explicit controlled AI/storage fixtures in an isolated rolled-back
database transaction. They are never enabled in live service code.

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

This script only checks reads and demo logins; it is **not** a full camera E2E test and
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
