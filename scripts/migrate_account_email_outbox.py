"""Create the durable account-email outbox table in development only.

Run explicitly with: uv run python -m scripts.migrate_account_email_outbox
Publishing owns production schema changes; this script never modifies production.
"""
from api import config
from api.models import AccountEmailOutbox, engine


def migrate():
    if config.PRODUCTION:
        raise RuntimeError("This additive schema step is development-only; production schema is managed by Publish.")
    AccountEmailOutbox.__table__.create(engine, checkfirst=True)


if __name__ == "__main__":
    migrate()
