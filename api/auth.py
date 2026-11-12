"""Explicitly requested bcrypt passwords and JWT sessions, with route-level RBAC."""
import os
from datetime import timedelta
import bcrypt
import jwt
from fastapi import Request, HTTPException, Response
from sqlalchemy import select
from .models import User, AccountSecurity, utcnow
from . import config

SECRET = os.environ["SESSION_SECRET"]
if config.PRODUCTION and len(SECRET.encode()) < 32:
    raise RuntimeError("Production SESSION_SECRET must contain at least 32 bytes of high-entropy secret material.")
COOKIE = "nagardrishti_session"

def account_enabled(user):
    return (not user.email.lower().endswith("@nagardrishti.demo")
            and user.password_hash != "!disabled")

def fail(status, code, message):
    raise HTTPException(status, detail={"code": code, "message": message})

def hash_password(password):
    if len(password) < 10 or len(password.encode()) > 72:
        fail(422, "PASSWORD_POLICY", "Use a password between 10 and 72 bytes.")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

def user_json(u):
    return {k: getattr(u, k) for k in ("id", "name", "email", "role", "ward_id")}

def verified_for_login(user, security):
    # Staff are provisioned by operators, never by public registration.
    return (user.role != "citizen"
            or (security is not None and security.email_verified))

def authenticate(request: Request, db, roles=None, optional=False):
    token = request.cookies.get(COOKIE)
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        token = header[7:]
    try:
        claims = jwt.decode(token or "", SECRET, algorithms=["HS256"], issuer="nagardrishti")
        user = db.get(User, int(claims["sub"]))
        if not user or not account_enabled(user):
            raise ValueError("Unknown user")
        security = db.get(AccountSecurity, user.id)
        if claims.get("sv", 0) != (security.session_version if security else 0) or not verified_for_login(user, security):
            raise ValueError("Revoked or unverified session")
    except (jwt.PyJWTError, ValueError, KeyError):
        if optional:
            return None
        fail(401, "AUTH_REQUIRED", "Sign in to continue.")
    if roles and user.role not in roles:
        fail(403, "ROLE_FORBIDDEN", "Your role cannot perform this action.")
    return user

def session_response(user, response: Response, security=None):
    token = jwt.encode({"sub": str(user.id), "iss": "nagardrishti", "sv": security.session_version if security else 0,
                        "exp": utcnow() + timedelta(hours=12)}, SECRET, algorithm="HS256")
    response.set_cookie(COOKIE, token, httponly=True, secure=True, samesite="lax", max_age=43200, path="/")
    response.headers["Cache-Control"] = "no-store"
    return {"user": user_json(user), "access_token": token}
