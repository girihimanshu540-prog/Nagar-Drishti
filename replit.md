# NagarDrishti

Road-hazard reporting and accountable repair verification: **no closure without verified evidence**.

## Run and operate

- Managed frontend workflow: `artifacts/nagardrishti: web`
- Managed API workflow: `artifacts/api-server: API Server`
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
- SQLAlchemy model source: `api/models.py`. Do not run the unused Drizzle push command:
  the SQLAlchemy-managed tables are not represented in the starter Drizzle schema.
- Contract: `lib/api-spec/openapi.yaml`, runtime OpenAPI from FastAPI at `/api/openapi.json`
- Defaults and verification gates: `api/config.py`; commissioner configuration persists in DB
- Real evidence bytes live in App Storage, never database blobs or local app filesystem.
- Synthetic example images are labeled demo-only. Never use them to claim live AI verification.

## Product scope and operating constraints

- Selected artifact for this build is web. The shared API is implemented; native Expo app is not.
- The user explicitly requests custom bcrypt/JWT auth, not Replit Auth.
- Seeded demo staff accounts are intentionally public; never use them in real municipal operations.
- Uncertain evidence must always require JE review; never relax this invariant for demos.
- The live capture UI excludes gallery pickers; metadata is not cryptographic capture attestation.
- Never run schema creation or seed at application startup or in production build hooks.
- See `README.md` for setup, demo credentials, verification limitations and acceptance evidence.
