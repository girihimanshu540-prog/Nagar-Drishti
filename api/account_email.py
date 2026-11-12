"""Provider-neutral SMTP delivery, disabled until an operator approves/configures it.

No development mail sink, token logs, or automatic test messages. All tests replace
this transport explicitly. An integration was declined; no provider is connected.
"""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlsplit
from .auth import fail

log = logging.getLogger("nagardrishti.email")


def delivery_config():
    origin = os.getenv("ACCOUNT_PUBLIC_ORIGIN", "").rstrip("/")
    parsed = urlsplit(origin)
    required = ("ACCOUNT_SMTP_HOST", "ACCOUNT_SMTP_USERNAME", "ACCOUNT_SMTP_PASSWORD", "ACCOUNT_EMAIL_FROM")
    if (os.getenv("ACCOUNT_EMAIL_APPROVED") != "true"
            or not all(os.getenv(k) for k in required)
            or parsed.scheme != "https" or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ("", "/")):
        fail(503, "EMAIL_UNAVAILABLE", "Account email is not configured. Contact the service operator; no email was sent.")
    return {
        "origin": origin, "host": os.environ["ACCOUNT_SMTP_HOST"],
        "username": os.environ["ACCOUNT_SMTP_USERNAME"], "password": os.environ["ACCOUNT_SMTP_PASSWORD"],
        "sender": os.environ["ACCOUNT_EMAIL_FROM"],
    }


def deliver(settings, recipient, purpose, token):
    """Run after the HTTP response to avoid SMTP-dependent account enumeration.

    Never log exception text: a provider could echo the recipient or credentials.
    Tokens expire even when delivery fails, and a subsequent request replaces them.
    """
    label = "Verify your email" if purpose == "verify" else "Reset your password"
    link = f'{settings["origin"]}/login#{purpose}={token}'
    msg = EmailMessage()
    msg["Subject"] = f"NagarDrishti — {label}"
    msg["From"] = settings["sender"]
    msg["To"] = recipient
    msg.set_content(
        f"{label}\n\nOpen {link}\n\n"
        f"Or open the mobile app's sign-in screen, choose "
        f"'{label}', then enter this code:\n{token}\n\n"
        "This single-use code expires in 30 minutes. Choose a new password to "
        "finish. This also signs out existing sessions. Never share this code.\n"
        "If you did not request this, ignore this message. No changes have been made."
    )
    try:
        with smtplib.SMTP(settings["host"], 587, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(settings["username"], settings["password"])
            smtp.send_message(msg)
    except Exception:
        log.error("Account email delivery failed; operator attention required.")
