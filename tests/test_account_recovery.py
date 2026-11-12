"""Isolated ownership/session policy tests; no live email is sent."""
import hashlib
from datetime import timedelta
import pytest
from sqlalchemy import select, func
from fastapi.testclient import TestClient
from api import account_email
from api.main import app
from api.models import User, AccountSecurity, AccountToken, AuthThrottle, Report, Ticket, Repair, Event, utcnow
from api.auth import session_response
from fastapi import Response
from account_fixtures import TEST_PASSWORD, TEST_HASH
from test_api import isolated, login
from scripts.retire_demo_accounts import retire


@pytest.fixture
def mailbox(isolated, monkeypatch):
    messages = []
    monkeypatch.setattr(account_email, "delivery_config", lambda: {"origin": "https://testserver"})
    monkeypatch.setattr(account_email, "deliver", lambda settings, email, purpose, token: messages.append((email, purpose, token)))
    return messages


def request(client, email, purpose="reset"):
    path = "password" if purpose == "reset" else "verification"
    return client.post(f"/api/auth/{path}/request", json={"email": email})


def confirm(client, token, purpose="reset", password=TEST_PASSWORD):
    path = "password" if purpose == "reset" else "verification"
    return client.post(f"/api/auth/{path}/confirm", json={"token": token, "password": password})


def register(client, **changes):
    return client.post("/api/auth/register", json={
        "name": "Account Policy Test", "email": "new-owner@policy.invalid", "password": TEST_PASSWORD, **changes})


def test_unconfigured_delivery_is_explicit_and_does_not_create_accounts(isolated, monkeypatch):
    client, db, _ = isolated
    monkeypatch.delenv("ACCOUNT_EMAIL_APPROVED", raising=False)
    before = db.scalar(select(func.count()).select_from(User))
    for email in ("citizen@policy.invalid", "unknown@policy.invalid"):
        r = request(client, email)
        assert r.status_code == 503 and r.json()["error"]["code"] == "EMAIL_UNAVAILABLE"
    assert register(client).status_code == 503
    assert db.scalar(select(func.count()).select_from(User)) == before
    assert not db.scalar(select(func.count()).select_from(AccountToken))


def test_registration_requires_ownership_and_does_not_accept_roles(isolated, mailbox):
    client, db, _ = isolated
    assert register(client, role="commissioner").status_code == 422
    result = register(client)
    assert result.status_code == 200 and "access_token" not in result.json()
    assert not client.cookies
    user = db.scalar(select(User).where(User.email == "new-owner@policy.invalid"))
    assert user.role == "citizen"
    credentials = {"email": user.email, "password": TEST_PASSWORD}
    assert client.post("/api/auth/login", json=credentials).status_code == 403
    token = mailbox[-1][2]
    row = db.get(AccountToken, hashlib.sha256(token.encode()).hexdigest())
    assert row and row.digest != token and row.purpose == "verify"
    assert utcnow() + timedelta(minutes=29) < row.expires_at < utcnow() + timedelta(minutes=31)
    new_password = "OwnerChosenPassword2026!"
    assert confirm(client, token, "verify", new_password).status_code == 200
    assert confirm(client, token, "verify", new_password).status_code == 400
    assert client.post("/api/auth/login", json=credentials).status_code == 401
    assert client.post("/api/auth/login", json={**credentials, "password": new_password}).status_code == 200
    assert client.get("/api/me").json()["role"] == "citizen"


def test_enumeration_safe_requests_and_duplicate_registration(isolated, mailbox):
    client, db, _ = isolated
    known = request(client, "citizen@policy.invalid")
    unknown = request(client, "nobody@policy.invalid")
    disabled = db.get(User, 5)
    disabled.password_hash = "!disabled"
    db.flush()
    blocked = request(client, disabled.email)
    assert known.json() == unknown.json() == blocked.json()
    assert len(mailbox) == 1
    first = register(client)
    original = db.scalar(select(User).where(User.email == "new-owner@policy.invalid"))
    original_hash, original_name = original.password_hash, original.name
    duplicate = register(client, name="Changed name", password="AnotherPassword2026!")
    assert first.json() == duplicate.json() == known.json()
    assert original.password_hash == original_hash and original.name == original_name
    assert db.scalar(select(func.count()).select_from(User).where(User.email == original.email)) == 1
    assert len(mailbox) == 3


def test_reset_revokes_cookie_and_bearer_and_all_sibling_tokens(isolated, mailbox):
    web, db, _ = isolated
    result = login(web, "citizen")
    old_cookie = web.cookies.get("nagardrishti_session")
    assert request(web, result["user"]["email"]).status_code == 200
    reset_token = mailbox[-1][2]
    # A verification token from an earlier lifecycle must also be invalidated.
    db.add(AccountToken(digest="a"*64, user_id=result["user"]["id"], purpose="verify", expires_at=utcnow()+timedelta(minutes=30)))
    db.flush()
    with TestClient(app, base_url="https://testserver") as native:
        native.headers["Authorization"] = f"Bearer {result['access_token']}"
        assert native.get("/api/me").status_code == 200
        changed = confirm(web, reset_token, password="ReplacementPassword2026!")
        assert changed.status_code == 200 and "access_token" not in changed.json()
        assert native.get("/api/me").status_code == 401
        native.headers.clear()
        assert native.post("/api/auth/login", json={"email":result["user"]["email"],"password":TEST_PASSWORD}).status_code == 401
        fresh = native.post("/api/auth/login", json={"email":result["user"]["email"],"password":"ReplacementPassword2026!"})
        assert fresh.status_code == 200
        native.cookies.clear()
        native.headers["Authorization"] = f"Bearer {fresh.json()['access_token']}"
        assert native.get("/api/me").status_code == 200
    web.cookies.set("nagardrishti_session", old_cookie)
    assert web.get("/api/me").status_code == 401
    assert not db.scalar(select(func.count()).select_from(AccountToken).where(AccountToken.user_id == result["user"]["id"]))


def test_replacement_expiry_purpose_and_password_policy(isolated, mailbox):
    client, db, _ = isolated
    email = "citizen@policy.invalid"
    assert request(client, email).status_code == 200
    old = mailbox[-1][2]
    assert request(client, email).status_code == 200
    new = mailbox[-1][2]
    assert new != old and confirm(client, old).status_code == 400
    assert confirm(client, new, "verify").status_code == 400
    assert confirm(client, new, password="short").status_code == 422
    assert confirm(client, new, password="é"*40).status_code == 422
    row = db.get(AccountToken, hashlib.sha256(new.encode()).hexdigest())
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.flush()
    assert confirm(client, new).status_code == 400
    assert request(client, email).status_code == 200
    assert confirm(client, mailbox[-1][2]).status_code == 200


def test_rate_limits_are_persistent_and_apply_to_unknown_emails(isolated, mailbox):
    client, db, _ = isolated
    for _ in range(3):
        assert request(client, "absent@policy.invalid").status_code == 200
    assert request(client, "absent@policy.invalid").status_code == 429
    # Process-local middleware bookkeeping does not reset shared quotas.
    import api.main as routes
    routes.hits.clear()
    assert request(client, "absent@policy.invalid").status_code == 429
    assert not mailbox
    keys = db.scalars(select(AuthThrottle.key)).all()
    assert keys and all(len(key) == 64 for key in keys)


@pytest.mark.parametrize("role", ["contractor", "je", "commissioner"])
def test_staff_recovery_preserves_server_owned_role(isolated, mailbox, role):
    client, db, _ = isolated
    result = login(client, role)
    assert request(client, result["user"]["email"]).status_code == 200
    assert mailbox[-1][1] == "reset"
    assert confirm(client, mailbox[-1][2]).status_code == 200
    assert login(client, role)["user"]["role"] == role
    count = len(mailbox)
    assert request(client, result["user"]["email"], "verify").status_code == 200
    assert len(mailbox) == count  # Public verification cannot create/promote staff.


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


def test_legacy_citizens_require_verification_even_with_an_old_cookie(isolated, mailbox):
    client, db, _ = isolated
    result = login(client, "citizen")
    db.delete(db.get(AccountSecurity, result["user"]["id"]))
    db.flush()
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": result["user"]["email"], "password": TEST_PASSWORD}).status_code == 403
    assert request(client, result["user"]["email"], "verify").status_code == 200
    assert confirm(client, mailbox[-1][2], "verify").status_code == 200
    assert login(client, "citizen")["user"]["role"] == "citizen"


def test_smtp_adapter_uses_authenticated_tls_without_sending_live_mail(monkeypatch):
    calls, messages = [], []
    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.append((host, port, timeout))
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def ehlo(self): calls.append("ehlo")
        def starttls(self, context): calls.append("tls")
        def login(self, username, password): calls.append("login")
        def send_message(self, msg): messages.append(msg)
    monkeypatch.setattr(account_email.smtplib, "SMTP", FakeSMTP)
    settings = dict(origin="https://testserver", host="smtp.invalid", username="fixture", password="fixture", sender="sender@policy.invalid")
    account_email.deliver(settings, "recipient@policy.invalid", "verify", "x"*43)
    assert calls == [("smtp.invalid", 587, 10), "ehlo", "tls", "ehlo", "login"]
    text = messages[0].get_content()
    assert "/login#verify=" in text and "30 minutes" in text and "code" in text


def test_smtp_failure_logs_no_token_recipient_or_provider_error(monkeypatch, caplog):
    def offline(*args, **kwargs):
        raise OSError("Sensitive provider response must never reach logs")
    monkeypatch.setattr(account_email.smtplib, "SMTP", offline)
    account_email.deliver(dict(origin="https://testserver", host="smtp.invalid", username="fixture",
                              password="fixture", sender="sender@policy.invalid"),
                         "private@policy.invalid", "reset", "x"*43)
    assert "operator attention" in caplog.text
    assert "Sensitive provider" not in caplog.text and "private@" not in caplog.text and "x"*43 not in caplog.text


@pytest.mark.parametrize("origin", ["http://testserver", "https://testserver/unsafe", "https://testserver?next=evil", "https://user:pass@testserver"])
def test_email_links_require_an_operator_configured_https_origin(monkeypatch, origin):
    for key, value in dict(ACCOUNT_EMAIL_APPROVED="true", ACCOUNT_PUBLIC_ORIGIN=origin, ACCOUNT_SMTP_HOST="smtp.invalid",
                           ACCOUNT_SMTP_USERNAME="fixture", ACCOUNT_SMTP_PASSWORD="fixture", ACCOUNT_EMAIL_FROM="sender@policy.invalid").items():
        monkeypatch.setenv(key, value)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as err:
        account_email.delivery_config()
    assert err.value.status_code == 503
