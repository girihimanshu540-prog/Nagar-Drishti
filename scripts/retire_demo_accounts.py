"""Development-only removal of public sample sign-ins; preserve every report.

Referenced rows become non-login historical identities to preserve foreign keys.
No report, ticket, event, repair or non-sample account is changed.
"""
from sqlalchemy import select, exists, delete
from api import config
from api.models import Session, User, Ticket, Report, Repair, Event, AccountSecurity, AccountToken


def retire(db):
    removed = retired = 0
    users = db.scalars(select(User).where(User.email.ilike("%@nagardrishti.demo")).with_for_update()).all()
    for user in users:
        linked = any(db.scalar(select(exists().where(condition))) for condition in (
            Ticket.assigned_contractor_id == user.id, Report.citizen_id == user.id,
            Repair.contractor_id == user.id, Event.actor_id == user.id,
        ))
        db.execute(delete(AccountToken).where(AccountToken.user_id == user.id))
        db.execute(delete(AccountSecurity).where(AccountSecurity.user_id == user.id))
        if linked:
            user.name = "Removed sample account"
            user.email = f"retired-{user.id}@accounts.invalid"
            user.company = ""
            user.password_hash = "!disabled"
            retired += 1
        else:
            db.delete(user)
            removed += 1
    db.flush()
    return {"deleted_unreferenced_accounts": removed, "retired_historical_identities": retired}


if __name__ == "__main__":
    if config.PRODUCTION:
        raise RuntimeError("This cleanup only targets development. No production changes are permitted.")
    with Session.begin() as db:
        print(retire(db))
