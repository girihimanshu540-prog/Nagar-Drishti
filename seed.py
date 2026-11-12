"""Explicit development schema setup. Never creates accounts or sample reports.

Run: uv run python seed.py --init
Provision genuine wards and staff separately through an operator-controlled process.
"""
import argparse
from api import config
from api.models import Base, engine


def seed(initialize=False):
    if config.PRODUCTION:
        raise RuntimeError("Schema initialization is development-only.")
    if initialize:
        Base.metadata.create_all(engine)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--init", action="store_true", help="Create missing development tables only.")
    seed(parser.parse_args().init)
    print("Development schema ready. No accounts, wards or reports were created.")
