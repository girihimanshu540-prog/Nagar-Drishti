"""Durable, bounded, privacy-safe dispatch for approved account email."""
import asyncio
import hashlib
import hmac
import logging
import os
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select

from . import account_email
from .models import AccountEmailOutbox, AccountToken, Session, User, utcnow

log = logging.getLogger("nagardrishti.email.outbox")
MAX_ATTEMPTS = 5
LEASE_SECONDS = 90
POLL_SECONDS = 15
BATCH_SIZE = 10


def enqueue(db, user: User, token: str, digest: str):
    """Persist only an encrypted token and account ID; address is resolved at send time."""
    db.add(AccountEmailOutbox(
        user_id=user.id,
        purpose="reset",
        token_digest=digest,
        encrypted_token=account_email.encrypt_token(token),
    ))


def _claim_batch():
    now = utcnow()
    with Session.begin() as db:
        expired_leases = db.scalars(select(AccountEmailOutbox).where(
            AccountEmailOutbox.status == "sending",
            AccountEmailOutbox.lease_until <= now,
            AccountEmailOutbox.attempts >= MAX_ATTEMPTS,
        ).with_for_update(skip_locked=True)).all()
        for row in expired_leases:
            row.status = "failed"
            row.last_failure_code = "attempts_exhausted"
            row.lease_until = None
            row.encrypted_token = None
            row.token_digest = None

        rows = db.scalars(select(AccountEmailOutbox).where(
            AccountEmailOutbox.attempts < MAX_ATTEMPTS,
            or_(
                and_(AccountEmailOutbox.status == "pending", AccountEmailOutbox.next_attempt_at <= now),
                and_(AccountEmailOutbox.status == "sending", AccountEmailOutbox.lease_until <= now),
            ),
        ).order_by(AccountEmailOutbox.id).limit(BATCH_SIZE).with_for_update(skip_locked=True)).all()
        jobs = []
        for row in rows:
            row.status = "sending"
            row.attempts += 1
            row.lease_until = now + timedelta(seconds=LEASE_SECONDS)
            jobs.append((row.id, row.user_id, row.purpose, row.token_digest, row.encrypted_token, row.attempts))
    return jobs


def _finish_cancelled(job_id: int, code: str):
    with Session.begin() as db:
        row = db.get(AccountEmailOutbox, job_id)
        if row and row.status == "sending":
            row.status = "cancelled"
            row.last_failure_code = code
            row.lease_until = None
            row.encrypted_token = None
            row.token_digest = None


def _finish_sent(job_id: int):
    with Session.begin() as db:
        row = db.get(AccountEmailOutbox, job_id)
        if row and row.status == "sending":
            row.status = "sent"
            row.sent_at = utcnow()
            row.lease_until = None
            row.encrypted_token = None
            row.token_digest = None
            row.last_failure_code = None


def _finish_failed(job_id: int, attempts: int):
    now = utcnow()
    with Session.begin() as db:
        row = db.get(AccountEmailOutbox, job_id)
        if not row or row.status != "sending":
            return
        row.lease_until = None
        row.last_failure_code = "provider_error"
        if attempts >= MAX_ATTEMPTS:
            row.status = "failed"
            row.encrypted_token = None
            row.token_digest = None
        else:
            row.status = "pending"
            row.next_attempt_at = now + timedelta(seconds=min(30 * (2 ** (attempts - 1)), 3600))


def process_outbox_batch():
    """Process due work only when a provider is explicitly approved and configured."""
    try:
        settings = account_email.delivery_config()
    except HTTPException:
        return 0

    jobs = _claim_batch()
    for job_id, user_id, purpose, digest, encrypted_token, attempts in jobs:
        if purpose != "reset" or not digest or not encrypted_token:
            _finish_cancelled(job_id, "invalid_job")
            continue
        with Session() as db:
            user = db.get(User, user_id)
            token_row = db.get(AccountToken, digest)
            valid = bool(
                user and token_row and token_row.purpose == "reset"
                and token_row.expires_at > utcnow()
            )
            recipient = user.email if valid else None
        if not valid or not recipient:
            _finish_cancelled(job_id, "expired_or_superseded")
            continue
        try:
            token = account_email.decrypt_token(encrypted_token)
            if not hmac.compare_digest(hashlib.sha256(token.encode()).hexdigest(), digest):
                _finish_cancelled(job_id, "invalid_job")
                continue
            account_email.deliver(settings, recipient, purpose, token)
        except Exception:
            _finish_failed(job_id, attempts)
            log.error("Account email delivery attempt failed; attempt %d of %d.", attempts, MAX_ATTEMPTS)
        else:
            _finish_sent(job_id)
    return len(jobs)


async def worker_loop():
    """A per-process poller; row leases and SKIP LOCKED coordinate multiple replicas."""
    while True:
        if os.getenv("ACCOUNT_EMAIL_APPROVED") == "true":
            try:
                await asyncio.to_thread(process_outbox_batch)
            except Exception:
                log.error("Account email outbox worker could not process a batch.")
        await asyncio.sleep(POLL_SECONDS)


def status_summary(db):
    counts = dict(db.execute(
        select(AccountEmailOutbox.status, func.count()).group_by(AccountEmailOutbox.status)
    ).all())
    oldest = db.scalar(select(func.min(AccountEmailOutbox.created_at)).where(
        AccountEmailOutbox.status.in_(("pending", "sending"))
    ))
    return {
        "pending": counts.get("pending", 0),
        "sending": counts.get("sending", 0),
        "failed": counts.get("failed", 0),
        "sent": counts.get("sent", 0),
        "cancelled": counts.get("cancelled", 0),
        "oldest_pending_at": oldest.isoformat() if oldest else None,
        "max_attempts": MAX_ATTEMPTS,
    }
