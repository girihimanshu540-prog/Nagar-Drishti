#!/bin/bash
set -e
pnpm install --frozen-lockfile
# The live API uses SQLAlchemy, not the unused Drizzle starter schema.
# These commands reject production and never create sample accounts/reports.
uv sync --frozen
uv run python -m scripts.migrate_account_security
uv run python -m scripts.retire_demo_accounts
