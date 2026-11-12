"""Ephemeral policy-test identities; never seeded into the running application."""
import secrets
from sqlalchemy import select
from api.auth import hash_password
from api.models import User, Ward, AccountSecurity, Ticket, Repair, utcnow

TEST_PASSWORD = secrets.token_urlsafe(20)
TEST_HASH = hash_password(TEST_PASSWORD)


def provision(db):
    if not db.get(Ward, 1):
        db.add(Ward(id=1, name="Policy test ward", center_lat=18.52, center_lng=73.85))
        db.flush()
    for id, role in enumerate(("citizen", "contractor", "je", "commissioner", "contractor", "contractor"), 1):
        user = db.get(User, id)
        values = dict(name=f"Policy test {id}", email=f"{role if id <= 4 else f'contractor{id}'}@policy.invalid",
                      password_hash=TEST_HASH, role=role, ward_id=1, company="")
        if user:
            for key, value in values.items():
                setattr(user, key, value)
        else:
            db.add(User(id=id, **values))
        db.flush()
        security = db.get(AccountSecurity, id)
        if not security:
            db.add(AccountSecurity(user_id=id, email_verified=True, session_version=0))
        else:
            security.email_verified = True
            security.session_version = 0
    for id, status in (("ND-1042", "ASSIGNED"), ("ND-1043", "NEEDS_JE_REVIEW")):
        if not db.get(Ticket, id):
            db.add(Ticket(id=id, title="Synthetic policy fixture", location="Test location",
                          lat=18.52, lng=73.85, ward_id=1, status=status, severity=3,
                          traffic_density=.5, priority_score=.5, report_count=1,
                          assigned_contractor_id=2, before_image_url="", detector_engine="test",
                          is_demo=True, created_at=utcnow()))
    db.flush()
    if not db.scalar(select(Repair).where(Repair.ticket_id == "ND-1043")):
        db.add(Repair(ticket_id="ND-1043", contractor_id=2, image_url="", lat=18.52, lng=73.85,
                      captured_at=utcnow(), after_detections_json={}, vision_verdict="not_run",
                      vision_reason="Test fixture only", decision="NEEDS_JE_REVIEW"))
    db.flush()
