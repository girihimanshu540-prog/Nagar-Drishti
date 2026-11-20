"""Signup, sign-in and durable password-reset policy tests; no live email is sent."""
import hashlib
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import FastAPI
from sqlalchemy import select, func
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from api import account_email
from api.main import app, database, login as login_route
from api import account_recovery
from api.models import (
    AccountEmailOutbox, User, AccountSecurity, AccountToken, AuthThrottle,
    Report, Ticket, Repair, Event, utcnow,
)
from account_fixtures import TEST_PASSWORD
from test_api import isolated, login
from scripts.retire_demo_accounts import retire


@pytest.fixture
def email_configured(isolated, monkeypatch):
    """Fake approved configuration only; dispatcher tests replace SMTP with a stub."""
    monkeypatch.setenv("ACCOUNT_EMAIL_ENCRYPTION_KEY", "eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=")
    monkeypatch.setattr(account_email, "delivery_config", lambda: {
        "origin": "https://testserver", "host": "smtp.invalid", "username": "fixture",
        "password": "fixture-only", "sender": "sender@policy.invalid",
    })


def request(client, email):
    return client.post("/api/auth/password/request", json={"email": email})


def confirm(client, token, password=TEST_PASSWORD):
    return client.post("/api/auth/password/confirm", json={"token": token, "password": password})


def register(client, **changes):
    return client.post("/api/auth/register", json={
        "name": "Account Policy Test", "email": "new-owner@policy.invalid",
        "password": TEST_PASSWORD, **changes,
    })


def login_worker(db, ip):
    """Independent ASGI app instance sharing only the database-backed limiter."""
    worker = FastAPI()
    worker.add_api_route("/api/auth/login", login_route, methods=["POST"])

    def provide_db():
        yield db

    worker.dependency_overrides[database] = provide_db
    return TestClient(worker, base_url="https://testserver", client=(ip, 50000))


def queued_token(db, user_id):
    row = db.scalar(select(AccountEmailOutbox).where(
        AccountEmailOutbox.user_id == user_id,
        AccountEmailOutbox.status.in_(("pending", "sending")),
    ).order_by(AccountEmailOutbox.id.desc()))
    assert row and row.encrypted_token
    return account_email.decrypt_token(row.encrypted_token)


def test_signup_activates_citizen_without_email_and_signs_in(isolated, monkeypatch):
    client, db, _ = isolated

    def unavailable():
        raise AssertionError("Signup must not depend on email configuration.")
    monkeypatch.setattr(account_email, "delivery_config", unavailable)
    result = register(client)
    assert result.status_code == 200
    assert "access_token" not in result.json()
    assert not client.cookies
    user = db.scalar(select(User).where(User.email == "new-owner@policy.invalid"))
    assert user and user.role == "citizen"
    security = db.get(AccountSecurity, user.id)
    assert security and security.email_verified is False
    assert not db.scalar(select(func.count()).select_from(AccountToken).where(AccountToken.user_id == user.id))
    assert not db.scalar(select(func.count()).select_from(AccountEmailOutbox).where(AccountEmailOutbox.user_id == user.id))
    signed_in = client.post("/api/auth/login", json={"email": user.email, "password": TEST_PASSWORD})
    assert signed_in.status_code == 200
    assert signed_in.json()["user"]["role"] == "citizen"
    assert client.get("/api/me").json()["id"] == user.id


def test_signup_never_accepts_a_staff_role_or_reserved_demo_address(isolated):
    client, db, _ = isolated
    assert register(client, role="commissioner").status_code == 422
    assert register(client, role="contractor").status_code == 422
    assert register(client, email="new@nagardrishti.demo").status_code == 422
    assert db.scalar(select(func.count()).select_from(User).where(User.email == "new-owner@policy.invalid")) == 0


def test_duplicate_signup_is_enumeration_safe_and_preserves_password(isolated):
    client, db, _ = isolated
    first = register(client)
    user = db.scalar(select(User).where(User.email == "new-owner@policy.invalid"))
    original_hash, original_name = user.password_hash, user.name
    duplicate = register(client, name="Changed name", password="AnotherPassword2026!")
    assert first.status_code == duplicate.status_code == 200
    assert first.json() == duplicate.json()
    assert (user.password_hash, user.name, user.role) == (original_hash, original_name, "citizen")
    assert client.post("/api/auth/login", json={"email": user.email, "password": TEST_PASSWORD}).status_code == 200
    assert client.post("/api/auth/login", json={"email": user.email, "password": "AnotherPassword2026!"}).status_code == 401


def test_login_rate_limit_and_session_version_protection_remain(isolated):
    client, db, _ = isolated
    result = login(client, "citizen")
    user = db.get(User, result["user"]["id"])
    row = db.get(AccountSecurity, user.id)
    row.email_verified = False
    db.flush()
    assert client.get("/api/me").status_code == 200
    row.session_version += 1
    db.flush()
    assert client.get("/api/me").status_code == 401
    for attempt in range(19):
        response = client.post("/api/auth/login", json={
            "email": f"absent{attempt}@policy.invalid", "password": TEST_PASSWORD,
        })
        assert response.status_code == 401
    response = client.post("/api/auth/login", json={
        "email": "another-absent@policy.invalid", "password": TEST_PASSWORD,
    })
    assert response.status_code == 429
    assert client.post("/api/auth/login", json={"email": "citizen@policy.invalid", "password": TEST_PASSWORD}).status_code == 429


def test_login_target_quota_is_shared_but_cannot_lock_out_the_account(isolated, monkeypatch):
    _, db, _ = isolated
    fixed_now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    monkeypatch.setattr(account_recovery, "utcnow", lambda: fixed_now)
    monkeypatch.setattr("api.main.bcrypt.checkpw", lambda password, hashed: password.decode() == TEST_PASSWORD)
    payload = {"email": "CITIZEN@policy.invalid", "password": "WrongPassword2026!"}

    with login_worker(db, "203.0.113.10") as worker_a, login_worker(db, "203.0.113.10") as worker_b:
        known = worker_a.post("/api/auth/login", json=payload)
        unknown = worker_b.post("/api/auth/login", json={
            "email": "unknown@policy.invalid", "password": payload["password"],
        })
        assert known.status_code == unknown.status_code == 401
        assert known.json() == unknown.json()
        for _ in range(4):
            assert worker_a.post("/api/auth/login", json=payload).status_code == 401
        payload["email"] = " citizen@policy.invalid "
        for _ in range(5):
            assert worker_b.post("/api/auth/login", json=payload).status_code == 401

        # A fresh worker sees the shared target counter, but a correct password
        # remains usable so an attacker cannot lock the account by guessing.
        payload["password"] = "WrongPassword2026!"
        assert worker_a.post("/api/auth/login", json=payload).status_code == 429
        payload["password"] = TEST_PASSWORD
        allowed = worker_b.post("/api/auth/login", json=payload)
        assert allowed.status_code == 200
        assert allowed.json()["user"]["role"] == "citizen"

    # A different client network gets an independent target budget.
    payload["password"] = "WrongPassword2026!"
    with login_worker(db, "203.0.113.11") as another_network:
        assert another_network.post("/api/auth/login", json=payload).status_code == 401

    keys = db.scalars(select(AuthThrottle.key)).all()
    assert keys and all(len(key) == 64 for key in keys)
    assert all("citizen@policy.invalid" not in key and "203.0.113." not in key for key in keys)


def test_login_network_quota_is_shared_across_workers_and_restart(isolated, monkeypatch):
    _, db, _ = isolated
    fixed_now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    monkeypatch.setattr(account_recovery, "utcnow", lambda: fixed_now)
    monkeypatch.setattr("api.main.bcrypt.checkpw", lambda *_: False)
    payload = {"password": "WrongPassword2026!"}

    with login_worker(db, "198.51.100.24") as worker_a, login_worker(db, "198.51.100.24") as worker_b:
        for attempt in range(10):
            assert worker_a.post("/api/auth/login", json={
                **payload, "email": f"absent-a-{attempt}@policy.invalid",
            }).status_code == 401
        for attempt in range(10):
            assert worker_b.post("/api/auth/login", json={
                **payload, "email": f"absent-b-{attempt}@policy.invalid",
            }).status_code == 401

    # A newly-created app instance models a restarted worker. The network
    # quota is persisted, not reset with that process.
    with login_worker(db, "198.51.100.24") as restarted_worker:
        response = restarted_worker.post("/api/auth/login", json={
            **payload, "email": "after-restart@policy.invalid",
        })
    assert response.status_code == 429


def test_password_requests_stay_enumeration_safe_and_queue_encrypted_data(isolated, email_configured):
    client, db, _ = isolated
    known = request(client, "citizen@policy.invalid")
    unknown = request(client, "nobody@policy.invalid")
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    rows = db.scalars(select(AccountEmailOutbox).order_by(AccountEmailOutbox.id)).all()
    assert len(rows) == 1
    row = rows[0]
    token = account_email.decrypt_token(row.encrypted_token)
    assert row.status == "pending" and row.attempts == 0 and row.purpose == "reset"
    assert row.token_digest == hashlib.sha256(token.encode()).hexdigest()
    assert "citizen@policy.invalid" not in row.encrypted_token and token not in row.encrypted_token
    token_row = db.get(AccountToken, row.token_digest)
    assert token_row.purpose == "reset"
    assert utcnow() + timedelta(minutes=29) < token_row.expires_at < utcnow() + timedelta(minutes=31)

def test_password_reset_email_stays_disabled_without_operator_approval(isolated, monkeypatch):
    client, db, _ = isolated
    for key in ("ACCOUNT_EMAIL_APPROVED", "ACCOUNT_PUBLIC_ORIGIN", "ACCOUNT_SMTP_HOST",
                "ACCOUNT_SMTP_USERNAME", "ACCOUNT_SMTP_PASSWORD", "ACCOUNT_EMAIL_FROM",
                "ACCOUNT_EMAIL_ENCRYPTION_KEY"):
        monkeypatch.delenv(key, raising=False)
    response = request(client, "citizen@policy.invalid")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "EMAIL_UNAVAILABLE"
    assert "no email was sent" in response.json()["error"]["message"]
    assert not db.scalar(select(func.count()).select_from(AccountEmailOutbox))


def test_reset_is_single_use_revokes_cookie_and_bearer_sessions(isolated, email_configured):
    web, db, _ = isolated
    result = login(web, "citizen")
    old_cookie = web.cookies.get("nagardrishti_session")
    assert request(web, result["user"]["email"]).status_code == 200
    reset_token = queued_token(db, result["user"]["id"])
    with TestClient(app, base_url="https://testserver") as native:
        native.headers["Authorization"] = f"Bearer {result['access_token']}"
        assert native.get("/api/me").status_code == 200
        changed = confirm(web, reset_token, password="ReplacementPassword2026!")
        assert changed.status_code == 200 and "access_token" not in changed.json()
        assert native.get("/api/me").status_code == 401
        native.headers.clear()
        assert native.post("/api/auth/login", json={"email": result["user"]["email"], "password": TEST_PASSWORD}).status_code == 401
        fresh = native.post("/api/auth/login", json={"email": result["user"]["email"], "password": "ReplacementPassword2026!"})
        assert fresh.status_code == 200
    web.cookies.set("nagardrishti_session", old_cookie)
    assert web.get("/api/me").status_code == 401
    assert confirm(web, reset_token).status_code == 400
    assert not db.scalar(select(func.count()).select_from(AccountToken).where(AccountToken.user_id == result["user"]["id"]))


def test_replacement_expiry_password_policy_and_superseded_email(isolated, email_configured):
    client, db, _ = isolated
    email = "citizen@policy.invalid"
    assert request(client, email).status_code == 200
    user = db.scalar(select(User).where(User.email == email))
    first = db.scalar(select(AccountEmailOutbox).where(AccountEmailOutbox.user_id == user.id))
    old_token = account_email.decrypt_token(first.encrypted_token)
    assert request(client, email).status_code == 200
    second = db.scalar(select(AccountEmailOutbox).where(
        AccountEmailOutbox.user_id == user.id, AccountEmailOutbox.status == "pending"))
    new_token = account_email.decrypt_token(second.encrypted_token)
    db.expire(first)
    assert first.status == "cancelled" and first.encrypted_token is None
    assert confirm(client, old_token).status_code == 400
    assert confirm(client, new_token, "short").status_code == 422
    assert confirm(client, new_token, "é" * 40).status_code == 422
    row = db.get(AccountToken, second.token_digest)
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.flush()
    assert confirm(client, new_token).status_code == 400
    assert request(client, email).status_code == 200
    assert confirm(client, queued_token(db, user.id)).status_code == 200


def test_rate_limits_are_persistent_and_apply_to_unknown_emails(isolated, email_configured):
    client, db, _ = isolated
    for _ in range(3):
        assert request(client, "absent@policy.invalid").status_code == 200
    assert request(client, "absent@policy.invalid").status_code == 429
    import api.main as routes
    routes.hits.clear()
    assert request(client, "absent@policy.invalid").status_code == 429
    keys = db.scalars(select(AuthThrottle.key)).all()
    assert keys and all(len(key) == 64 for key in keys)


@pytest.mark.parametrize("role", ["contractor", "je", "commissioner"])
def test_staff_recovery_preserves_operator_provisioned_role(isolated, email_configured, role):
    client, db, _ = isolated
    result = login(client, role)
    assert request(client, result["user"]["email"]).status_code == 200
    token = queued_token(db, result["user"]["id"])
    assert confirm(client, token).status_code == 200
    assert login(client, role)["user"]["role"] == role
    assert client.post("/api/auth/verification/request", json={"email": result["user"]["email"]}).status_code == 404
    assert client.post("/api/auth/verification/confirm", json={"token": "a"*43, "password": TEST_PASSWORD}).status_code == 404


def test_legacy_unverified_citizens_can_sign_in_without_migration(isolated):
    client, db, _ = isolated
    user = db.scalar(select(User).where(User.email == "citizen@policy.invalid"))
    row = db.get(AccountSecurity, user.id)
    row.email_verified = False
    db.flush()
    client.cookies.clear()
    result = client.post("/api/auth/login", json={"email": user.email, "password": TEST_PASSWORD})
    assert result.status_code == 200
    assert result.json()["user"]["role"] == "citizen"
    assert client.get("/api/me").status_code == 200


def test_retiring_sample_signins_preserves_reports_and_real_users(isolated):
    client, db, _ = isolated
    session = login(client, "citizen")
    user = db.get(User, session["user"]["id"])
    user.email = "legacy@nagardrishti.demo"
    db.add(Event(ticket_id="ND-1042", actor_id=user.id, event_type="TEST_HISTORY", payload_json={}))
    db.flush()
    before = {model: db.scalar(select(func.count()).select_from(model)) for model in (Report, Ticket, Repair, Event)}
    staff = db.get(User, 3)
    staff_values = (staff.email, staff.name, staff.password_hash, staff.role)
    result = retire(db)
    assert result["retired_historical_identities"] == 1
    assert user.password_hash == "!disabled" and user.email.endswith("@accounts.invalid")
    assert client.get("/api/me").status_code == 401
    assert (staff.email, staff.name, staff.password_hash, staff.role) == staff_values
    assert before == {model: db.scalar(select(func.count()).select_from(model)) for model in before}
    assert retire(db) == {"deleted_unreferenced_accounts": 0, "retired_historical_identities": 0}


def test_smtp_adapter_uses_tls_and_reset_only_without_live_mail(monkeypatch):
    calls, messages = [], []
    class FakeSMTP:
        def __init__(self, host, port, timeout): calls.append((host, port, timeout))
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def ehlo(self): calls.append("ehlo")
        def starttls(self, context): calls.append("tls")
        def login(self, username, password): calls.append("login")
        def send_message(self, msg): messages.append(msg)
    monkeypatch.setattr(account_email.smtplib, "SMTP", FakeSMTP)
    settings = dict(origin="https://testserver", host="smtp.invalid", username="fixture",
                    password="fixture", sender="sender@policy.invalid")
    account_email.deliver(settings, "recipient@policy.invalid", "reset", "x"*43)
    assert calls == [("smtp.invalid", 587, 10), "ehlo", "tls", "ehlo", "login"]
    text = messages[0].get_content()
    assert "/login#reset=" in text and "30 minutes" in text and "code" in text
    with pytest.raises(account_email.DeliveryFailure):
        account_email.deliver(settings, "recipient@policy.invalid", "verify", "x"*43)


def test_smtp_failure_logs_no_token_recipient_or_provider_error(monkeypatch, caplog):
    def offline(*args, **kwargs):
        raise OSError("Sensitive provider response must never reach logs")
    monkeypatch.setattr(account_email.smtplib, "SMTP", offline)
    with pytest.raises(account_email.DeliveryFailure):
        account_email.deliver(dict(origin="https://testserver", host="smtp.invalid", username="fixture",
                                   password="fixture", sender="sender@policy.invalid"),
                              "private@policy.invalid", "reset", "x"*43)
    assert "Sensitive provider" not in caplog.text and "private@" not in caplog.text and "x"*43 not in caplog.text


@pytest.mark.parametrize("origin", ["http://testserver", "https://testserver/unsafe", "https://testserver?next=evil", "https://user:pass@testserver"])
def test_email_links_require_approved_https_origin(monkeypatch, origin):
    for key, value in dict(ACCOUNT_EMAIL_APPROVED="true", ACCOUNT_PUBLIC_ORIGIN=origin, ACCOUNT_SMTP_HOST="smtp.invalid",
                           ACCOUNT_SMTP_USERNAME="fixture", ACCOUNT_SMTP_PASSWORD="fixture", ACCOUNT_EMAIL_FROM="sender@policy.invalid",
                           ACCOUNT_EMAIL_ENCRYPTION_KEY="eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg=").items():
        monkeypatch.setenv(key, value)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as err:
        account_email.delivery_config()
    assert err.value.status_code == 503


def test_outbox_retries_are_bounded_and_status_is_visible(isolated, email_configured, monkeypatch, caplog):
    client, db, _ = isolated
    from api import account_email_outbox as outbox
    factory = sessionmaker(bind=db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False)
    monkeypatch.setattr(outbox, "Session", factory)
    assert request(client, "citizen@policy.invalid").status_code == 200
    row = db.scalar(select(AccountEmailOutbox).where(AccountEmailOutbox.status == "pending"))
    token = account_email.decrypt_token(row.encrypted_token)
    def provider_timeout(*args, **kwargs):
        raise OSError(f"private@policy.invalid {token} provider details")
    monkeypatch.setattr(account_email, "deliver", provider_timeout)
    for attempt in range(1, outbox.MAX_ATTEMPTS + 1):
        outbox.process_outbox_batch()
        db.refresh(row)
        assert row.attempts == attempt
        if attempt < outbox.MAX_ATTEMPTS:
            assert row.status == "pending"
            row.next_attempt_at = utcnow() - timedelta(seconds=1)
            db.flush()
    assert row.status == "failed" and row.encrypted_token is None and row.token_digest is None
    assert row.last_failure_code == "provider_error"
    assert "private@policy.invalid" not in caplog.text
    assert token not in caplog.text and "provider details" not in caplog.text
    login(client, "commissioner")
    status = client.get("/api/ops/account-email")
    assert status.status_code == 200 and status.json()["failed"] == 1
    login(client, "citizen")
    assert client.get("/api/ops/account-email").status_code == 403


def test_outbox_skips_expired_reset_codes(isolated, email_configured, monkeypatch):
    client, db, _ = isolated
    from api import account_email_outbox as outbox
    factory = sessionmaker(bind=db.connection(), join_transaction_mode="create_savepoint", expire_on_commit=False)
    monkeypatch.setattr(outbox, "Session", factory)
    assert request(client, "citizen@policy.invalid").status_code == 200
    row = db.scalar(select(AccountEmailOutbox).where(AccountEmailOutbox.status == "pending"))
    token_row = db.get(AccountToken, row.token_digest)
    token_row.expires_at = utcnow() - timedelta(seconds=1)
    db.flush()
    deliveries = []
    monkeypatch.setattr(account_email, "deliver", lambda *args, **kwargs: deliveries.append(args))
    outbox.process_outbox_batch()
    db.refresh(row)
    assert row.status == "cancelled" and row.encrypted_token is None
    assert row.last_failure_code == "expired_or_superseded"
    assert not deliveries
