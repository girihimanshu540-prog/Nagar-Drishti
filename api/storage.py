"""Durable evidence files in App Storage, never in the application database."""
import os
import uuid
from google.auth import load_credentials_from_dict
from google.cloud import storage

def client():
    credentials, _ = load_credentials_from_dict({
        "type": "external_account",
        "audience": "replit",
        "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
        "token_url": "http://127.0.0.1:1106/token",
        "credential_source": {
            "url": "http://127.0.0.1:1106/credential",
            "format": {"type": "json", "subject_token_field_name": "access_token"},
        },
    }, scopes=["https://www.googleapis.com/auth/devstorage.read_write"])
    return storage.Client(project="replit", credentials=credentials)

def evidence_blob(key):
    # UUID-only route eliminates path traversal and arbitrary bucket access.
    uuid.UUID(key)
    directory = os.environ["PRIVATE_OBJECT_DIR"].strip("/")
    bucket, prefix = directory.split("/", 1)
    return client().bucket(bucket).blob(f"{prefix}/evidence/{key}.jpg")

def save_image(jpeg_bytes):
    key = str(uuid.uuid4())
    evidence_blob(key).upload_from_string(jpeg_bytes, content_type="image/jpeg", timeout=30)
    return f"/api/evidence/{key}"

def load_image(url):
    if url.startswith("/demo/"):
        from pathlib import Path
        path = Path(__file__).resolve().parent.parent / "artifacts/nagardrishti/public" / url.lstrip("/")
        return path.read_bytes()
    if not url.startswith("/api/evidence/"):
        raise ValueError("Unsupported evidence path")
    return evidence_blob(url.rsplit("/", 1)[1]).download_as_bytes(timeout=30)
