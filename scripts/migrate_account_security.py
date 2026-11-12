"""Explicit, additive schema step. Never called at startup or during a build.

Run: uv run python -m scripts.migrate_account_security
No user records are marked verified or granted new roles.
"""
from api.models import engine, AccountSecurity, AccountToken, AuthThrottle
from api import config


def migrate():
    if config.PRODUCTION:
        raise RuntimeError("This additive schema step is development-only; production schema is managed by Publish.")
    with engine.begin() as connection:
        for table in (AccountSecurity.__table__, AccountToken.__table__, AuthThrottle.__table__):
            table.create(connection, checkfirst=True)


if __name__ == "__main__":
    migrate()
