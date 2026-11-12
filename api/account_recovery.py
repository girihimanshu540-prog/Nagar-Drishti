"""Account ownership and recovery. Only token digests are persisted."""
import hashlib
import hmac
import secrets
from datetime import timedelta
from fastapi import BackgroundTasks, Depends, Request, Response, APIRouter
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert
from .auth import SECRET, COOKIE, account_enabled, fail, hash_password
from .models import AccountSecurity, AccountToken, AuthThrottle, User, Ward, utcnow
from . import account_email

MESSAGE = {"message": "If the account is eligible, email instructions have been requested. Check your inbox or try again later."}
router = APIRouter(prefix="/api/auth")


class EmailInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=200)


class Registration(EmailInput):
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=10, max_length=72)


class TokenInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    password: str = Field(min_length=10, max_length=72)


def normalize_email(email):
    email = email.lower().strip()
    if email.count("@") != 1 or "." not in email.rsplit("@", 1)[-1] or any(c.isspace() for c in email):
        fail(422, "INVALID_EMAIL", "Enter a valid email address.")
    return email


def throttle(db, request, email=None):
    """Atomic shared quotas, including unknown emails; never store email/IP text."""
    now = utcnow()
    bucket = int(now.timestamp()) // 900
    targets = [(f"ip:{request.client.host if request.client else 'unknown'}", 30)]
    if email is not None:
        targets.append((f"email:{email}", 3))
    db.execute(delete(AuthThrottle).where(AuthThrottle.expires_at <= now))
    for target, limit in targets:
        key = hmac.new(SECRET.encode(), f"{bucket}:{target}".encode(), hashlib.sha256).hexdigest()
        stmt = insert(AuthThrottle).values(key=key, count=1, expires_at=now + timedelta(minutes=16))
        count = db.scalar(stmt.on_conflict_do_update(
            index_elements=[AuthThrottle.key], set_={"count": AuthThrottle.count + 1},
        ).returning(AuthThrottle.count))
        if count > limit:
            db.commit()
            fail(429, "RATE_LIMITED", "Too many account requests. Try again in 15 minutes.")
    # Quotas must survive invalid tokens, SMTP configuration errors and rollback.
    db.commit()


def security_row(db, user):
    row = db.get(AccountSecurity, user.id)
    if row is None:
        row = AccountSecurity(user_id=user.id, email_verified=False, session_version=0)
        db.add(row)
        db.flush()
    return row


def issue(db, user, purpose, tasks, delivery):
    if not user or not account_enabled(user) or user.email.endswith("@nagardrishti.demo"):
        return
    row = security_row(db, user)
    if purpose == "verify" and (row.email_verified or user.role != "citizen"):
        return
    # Recovery can establish ownership of a legacy/unverified citizen account too.
    db.execute(delete(AccountToken).where(AccountToken.expires_at <= utcnow()))
    db.execute(delete(AccountToken).where(AccountToken.user_id == user.id, AccountToken.purpose == purpose))
    token = secrets.token_urlsafe(32)
    db.add(AccountToken(digest=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id,
                        purpose=purpose, expires_at=utcnow() + timedelta(minutes=30)))
    tasks.add_task(account_email.deliver, delivery, user.email, purpose, token)


def install(app, database):
    @router.post("/register")
    def register(data: Registration, request: Request, tasks: BackgroundTasks, db=Depends(database)):
        email = normalize_email(data.email)
        if email.endswith("@nagardrishti.demo"):
            fail(422, "RESERVED_EMAIL", "Use your own email address, not a demonstration account.")
        if len(data.name.strip()) < 2:
            fail(422, "INVALID_NAME", "Enter a name with at least two non-space characters.")
        password_hash = hash_password(data.password)  # Same cost for existing/unknown accounts.
        throttle(db, request, email)
        delivery = account_email.delivery_config()  # Fail identically, before account lookup.
        # Serialize registrations by normalized email, including concurrent first use.
        lock = int.from_bytes(hashlib.sha256(email.encode()).digest()[:8], "big", signed=True)
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
        user = db.scalar(select(User).where(User.email == email).with_for_update())
        if user is None:
            ward = db.scalar(select(Ward).order_by(Ward.id).limit(1))
            if not ward:
                fail(503, "SERVICE_NOT_CONFIGURED", "Citizen registration is not yet configured.")
            user = User(name=data.name.strip(), email=email, password_hash=password_hash, role="citizen", ward_id=ward.id)
            db.add(user)
            db.flush()
        # Never overwrite an existing password, name, or server-owned role.
        issue(db, user, "verify", tasks, delivery)
        db.commit()
        return MESSAGE

    def request_token(purpose, data, request, tasks, db):
        email = normalize_email(data.email)
        throttle(db, request, email)
        delivery = account_email.delivery_config()
        user = db.scalar(select(User).where(User.email == email).with_for_update())
        issue(db, user, purpose, tasks, delivery)
        db.commit()
        return MESSAGE

    @router.post("/verification/request")
    def request_verification(data: EmailInput, request: Request, tasks: BackgroundTasks, db=Depends(database)):
        return request_token("verify", data, request, tasks, db)

    @router.post("/password/request")
    def request_password(data: EmailInput, request: Request, tasks: BackgroundTasks, db=Depends(database)):
        return request_token("reset", data, request, tasks, db)

    def confirm(purpose, data, request, response, db):
        throttle(db, request)
        # Both verification and recovery establish a password chosen by the owner,
        # preventing a pre-registered account from retaining an attacker's password.
        password_hash = hash_password(data.password)
        digest = hashlib.sha256(data.token.encode()).hexdigest()
        token = db.get(AccountToken, digest)
        if token is None:
            fail(400, "INVALID_ACCOUNT_TOKEN", "This code is invalid or expired. Request a new email.")
        # Lock the user first in all paths; then re-read the token after any wait.
        user = db.scalar(select(User).where(User.id == token.user_id).with_for_update())
        db.expire_all()
        token = db.get(AccountToken, digest)
        if (not user or not account_enabled(user) or token is None or token.purpose != purpose
                or token.expires_at <= utcnow() or user.email.endswith("@nagardrishti.demo")):
            fail(400, "INVALID_ACCOUNT_TOKEN", "This code is invalid or expired. Request a new email.")
        row = security_row(db, user)
        if purpose == "verify" and (row.email_verified or user.role != "citizen"):
            fail(400, "INVALID_ACCOUNT_TOKEN", "This code is invalid or expired. Request a new email.")
        row.email_verified = True
        row.session_version += 1
        user.password_hash = password_hash
        # Invalidate every sibling token of either purpose, atomically with password/version.
        db.execute(delete(AccountToken).where(AccountToken.user_id == user.id))
        db.commit()
        response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="lax")
        return {"message": "Your password is set and email verified. Existing sessions are signed out. Sign in with your new password."}

    @router.post("/verification/confirm")
    def confirm_verification(data: TokenInput, request: Request, response: Response, db=Depends(database)):
        return confirm("verify", data, request, response, db)

    @router.post("/password/confirm")
    def confirm_password(data: TokenInput, request: Request, response: Response, db=Depends(database)):
        return confirm("reset", data, request, response, db)

    app.include_router(router)
