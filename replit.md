# NagarDrishti

Citizen reporting and human-reviewed repair tracking. Public-launch mode has no AI detection or automatic verification.

## Run and operate

- Managed frontend workflow: `artifacts/nagardrishti: web`
- Managed API workflow: `artifacts/api-server: API Server`
- Managed native workflow: `artifacts/mobile: expo` (preview `/mobile/`)
- `uv sync --frozen` — install locked Python dependencies
- `uv run python seed.py --init` — development-only, explicit idempotent schema/seed
- `uv run python -m pytest tests/test_pipeline.py tests/test_api.py -q` — policy tests
- `pnpm run typecheck` — all TypeScript packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate client contract
- Interactive docs `/docs` and `/api/docs`; API `/api`; health `/health`

## Stack and source of truth

- Python FastAPI + SQLAlchemy + PostgreSQL; Python entrypoint `api/run.py`
- Managed API artifact's Node launcher starts the Python service; Express starter files are unused.
- React + Vite + Tailwind web app `artifacts/nagardrishti`
- Expo / React Native citizen and contractor client `artifacts/mobile`; shares FastAPI.
- Native API origin is `EXPO_PUBLIC_API_URL`, without `/api`; never hardcode a hostname.
- Native tokens use SecureStore + bearer auth. Keep web HTTP-only cookie auth unchanged.
- SQLAlchemy model source: `api/models.py`. Do not run the unused Drizzle push command:
  the SQLAlchemy-managed tables are not represented in the starter Drizzle schema.
- Contract: `lib/api-spec/openapi.yaml`, runtime OpenAPI from FastAPI at `/api/openapi.json`
- Defaults and verification gates: `api/config.py`; commissioner configuration persists in DB
- Real evidence bytes live in App Storage, never database blobs or local app filesystem.
- Synthetic example images are labeled demo-only. Never use them to claim live AI verification.

## Product scope and operating constraints

- Web and native clients use the same existing backend; do not introduce a mobile-only backend.
- The user explicitly requests custom bcrypt/JWT auth, not Replit Auth.
- Seeded demo staff accounts are intentionally public; never use them in real municipal operations.
- Uncertain evidence must always require JE review; never relax this invariant for demos.
- All valid repair submissions now require human JE review, not only uncertain ones.
- Detection mode is hard-disabled in live routes and settings. Do not restore AI claims or model calls without a new explicit request.
- Public evidence photos are private: preserve ticket-scoped authorization and native bearer image headers.
- Demo account access is disabled by default and always disabled in production. Samples must remain labeled and excluded from live metrics.
- The live capture UI excludes gallery pickers; metadata is not cryptographic capture attestation.
- Never run schema creation or seed at application startup or in production build hooks.
- See `README.md` for setup, demo credentials, verification limitations and acceptance evidence.
