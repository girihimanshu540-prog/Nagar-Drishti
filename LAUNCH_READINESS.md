# NagarDrishti public-launch review

## Current decision: prepared for review, NOT cleared to launch

Nothing was published. This is a human-reviewed reporting service, not an AI
pothole verifier or an authorized municipal dispatch service.

## Implemented

- Citizen registration/login, live photo/GPS reporting and 10 m report grouping remain.
- Email ownership and recovery use 30-minute single-use codes, digest-only storage,
  shared account-request quotas and cookie/bearer session revocation. Public role
  assignment remains citizen-only. Live delivery is not configured.
- Every valid contractor repair enters engineer review. Only a scoped engineer or
  commissioner can close/reopen it with written notes. No AI, vision fallback,
  ONNX, SSIM or feature-matching call runs in either submission route.
- Stored detector settings cannot enable inference; current weights and 65% legacy
  constant remain unchanged and inactive.
- Six former sample sign-ins were permanently retired in development. All were
  referenced by history, so account IDs remain as anonymized, non-login identities.
  Every existing report, ticket, repair, audit event and real user was preserved.
  There is no development override. No credentials or sample account seed remain.
- Sample records are labeled in both clients and public tracking. Live statistics
  exclude them. Engineer-approved counts require an actual recorded approval.
- Public ticket lists/details hide raw evidence, exact location, contractor
  identity, report/repair metadata and timelines. Public coordinates are rounded
  to three decimals (roughly 100 m, varying by latitude), not anonymization.
- Evidence GET requires authentication plus ticket access; private no-store
  caching. Native image requests send bearer headers only to the configured API.
- Cookie mutation origin checks, bounded per-process rate-limit bookkeeping,
  basic security headers, input limits and meaningful review notes are enforced.
- Privacy and service notices at `/privacy`, linked from account/capture flows.
- Phone layouts, touch targets and empty public-photo states were adjusted.
- Mobile static serving now checks decoded paths and real symlink targets;
  manifest platforms are allowlisted and landing-page URLs HTML-escaped.

## Required configuration — do not put secrets in client bundles

| Setting | Requirement |
|---|---|
| `DATABASE_URL` | Production PostgreSQL; initialized SQLAlchemy schema and genuine wards |
| `SESSION_SECRET` | Dedicated high-entropy production secret, at least 32 bytes; do not reuse the development secret |
| `APP_ENV=production` | Explicitly recommended; production `NODE_ENV`/deployment marker also activates safeguards |
| `PRIVATE_OBJECT_DIR` | Production private App Storage location; evidence read/write access required |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Managed App Storage configuration |
| `CORS_ORIGINS` | Only exact trusted HTTPS browser origins if cross-origin access is needed; no wildcard |
| `EXPO_PUBLIC_API_URL` | Native build's reachable HTTPS API origin, without `/api`; public value, not a credential |
| `PORT`, `BASE_PATH` | Supplied by managed service configuration |
| Account email | Operator-approved provider, authorized sender and trusted HTTPS callback origin; not configured |
| AI provider keys / `DETECTOR_MODE` | Not needed; do not enable the retired AI workflow |

Production settings inspection found database, session and storage secret names
present, but did not validate their values or production connectivity.
`EXPO_PUBLIC_API_URL` and explicit `APP_ENV` were not configured.
Do not substitute a development preview address for the native production API.

The service build already uses locked Python dependencies. Use `uv sync --frozen`,
not an unconstrained requirements install. The compatibility requirements now
match current direct dependency minimums rather than obsolete vulnerable bounds.
No schema/seed is run at startup; provision real wards and staff separately.

## Remaining launch blockers

1. **Operator and privacy policy:** supply the service operator, privacy/deletion
   contact, approved retention schedule and a functioning deletion process. The
   current notice explicitly says these are not configured; do not launch it as
   a completed policy. Confirm municipal authorization, service area and response
   ownership. No report currently notifies a municipality automatically.
2. **Production provisioning:** validate the real production database/schema,
   private storage, separate signing secret and genuine staff accounts. Test
   evidence access against production-like infrastructure before launch. Sample
   sign-in removal was applied to development only; production data was not modified.
3. **Native configuration/device acceptance:** configure the native HTTPS API
   origin, rebuild, and perform genuine iOS/Android camera, denied permissions,
   GPS, upload/retry, private-image and SecureStore checks. Browser checks cannot
   establish physical-device acceptance.
4. **Dependency risk:** compatible transitive security patches were applied to
   body-parser, Undici, Zod 4 and fast-uri. Post-update pnpm audit reports no
   critical advisories but one high Zod 3 advisory plus three moderate tooling
   advisories. Zod 3 is used by existing JS tooling/generated schemas; a forced
   major replacement was deliberately not attempted. Resolve or formally assess
   exposure before release. The live backend is FastAPI, not the Express starter.
   Initial scanner findings from obsolete requirements bounds must not be
   mistaken for installed Python versions: installed PyJWT 2.15.1, certifi
   2026.10.23, httpx2/httpcore2 2.16.0 exceed the reported fixes.
5. **Public-operation safeguards:** sign-in attempts now use shared atomic
   PostgreSQL quotas. Shared/edge abuse limiting for general API reads and writes,
   monitoring, backup/restore and incident ownership remain to be established.
   Browser camera metadata is not capture attestation. Configure HTTPS/public access
   and trusted origins when the owner authorizes publishing.
6. **Account email delivery:** citizen signup and sign-in no longer require email
   verification; the submitted email address is not proof of identity. No provider
   is connected, no email was sent, and password-reset requests fail explicitly while
   delivery is unconfigured. The durable reset queue encrypts tokens, retries at most
   five times and exposes aggregate status only to commissioners. Approve a provider,
   configure authenticated delivery plus an authorized sender, stable encryption key
   and trusted HTTPS web origin, then verify real inbox delivery and both web/native
   recovery flows. This does not resolve the operator/privacy-contact/retention blocker
   in item 1.

## Verification boundaries

Current ownership/recovery and account-removal checks: **47 Python policy tests
passed**, workspace TypeScript checks passed, and both public sign-in screens
rendered at phone width. Tests cover expired/reused/replaced codes, role protection,
unconfigured email, TLS adapter behavior, and revocation of cookie/bearer sessions.
Development cleanup left zero legacy sample-email sign-ins, six non-login historical
identities and all 70 reports intact. No real account was modified. These checks
do not prove live inbox delivery or physical-device behavior.

Run `uv run python -m pytest tests/test_pipeline.py tests/test_api.py tests/test_launch.py tests/test_account_recovery.py -q`
for capture, dedup, role, private-photo, disabled-AI and human-review regressions.
These use transaction rollback and storage doubles; no test data is committed.
Typechecks/builds and browser evidence are reported in the handoff separately.
Earlier launch-review checks (not all re-run in this task): 10 mobile policy/transport tests,
workspace
TypeScript checks and the web production build passed. Nine targeted static-server
containment/escaping checks passed. Browser registration, cookie restoration,
camera-unavailable messaging, public tracking/privacy and immediate logout passed.
An earlier 360 px overflow was corrected and rechecked: document/body widths
were 345 px within a 360 px viewport (15 px vertical scrollbar). Wide tables now
scroll inside their own panels, not the page. No real camera/photo/GPS capture or
physical-device acceptance was claimed.
The initial static scan reported two mobile-serving paths; explicit containment,
symlink and platform checks were added. The privacy scanner reported no findings,
which is not legal approval or proof that no privacy risk exists.

No model retraining, stored-model mutation, threshold change, publication or
deployment was performed. Archived evaluation assets are not launch evidence.
