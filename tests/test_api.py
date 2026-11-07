"""Isolated application policy tests with explicit AI/storage fixtures.

The transaction is rolled back; fixtures never enter live request handlers.
These are NOT real-camera or real-AI acceptance tests.
"""
import io
from datetime import timedelta
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session as SQLSession
from api.main import app, database
from api.models import engine, Ticket, Event, utcnow
import api.main as routes

@pytest.fixture
def isolated(monkeypatch):
    connection = engine.connect()
    transaction = connection.begin()
    db = SQLSession(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    def override():
        yield db
    app.dependency_overrides[database] = override
    # Deliberately explicit test doubles. Never activated in the running service.
    monkeypatch.setattr(routes, "detect", lambda *args: {
        "defect_present":True,"defect_type":"pothole","severity":4,"confidence":.95,
        "reason":"TEST FIXTURE: deterministic pothole detection", "is_screen":False,"bbox":[.2,.2,.7,.7],"engine":"test-fixture"})
    monkeypatch.setattr(routes, "save_image", lambda data: "/api/evidence/test-fixture")
    rgb = np.random.default_rng(42).integers(30,230,(512,512,3),dtype=np.uint8)
    stream = io.BytesIO()
    Image.fromarray(rgb).save(stream,format="JPEG")
    with TestClient(app, base_url="https://testserver") as client:
        yield client, db, stream.getvalue()
    app.dependency_overrides.clear()
    db.close()
    transaction.rollback()
    connection.close()

def login(client, role):
    res = client.post("/api/auth/login", json={"email":role+"@nagardrishti.demo","password":"NagarDemo2026!"})
    assert res.status_code == 200, res.text

def report(client, photo, delta=0, **changes):
    payload = dict(lat=17.123+delta/111195,lng=72.123,accuracy=5,captured_at=utcnow().isoformat(),capture_source="live_camera")
    payload.update(changes)
    return client.post("/api/reports",data=payload,files={"image":("camera.jpg",photo,"image/jpeg")})

def test_valid_report_and_6m_dedup_40m_separation(isolated):
    client, db, photo = isolated
    login(client,"citizen")
    first = report(client,photo).json()
    assert first["accepted"] and first["severity"] == 4
    second = report(client,photo,6).json()
    third = report(client,photo,40).json()
    assert second["ticket"]["id"] == first["ticket"]["id"]
    assert second["ticket"]["report_count"] == 2
    assert third["ticket"]["id"] != first["ticket"]["id"]
    assert db.scalar(select(Event).where(Event.ticket_id==first["ticket"]["id"], Event.event_type=="REPORT_GROUPED"))

def test_old_and_gallery_rejected_before_ai(isolated):
    client, db, photo = isolated
    login(client,"citizen")
    old = report(client,photo,captured_at=(utcnow()-timedelta(minutes=10)).isoformat()).json()
    gallery = report(client,photo,capture_source="gallery").json()
    assert not old["accepted"] and "old" in old["reason"]
    assert not gallery["accepted"] and "live-camera" in gallery["reason"]

@pytest.mark.parametrize("decision,status,event_type",[
    ("approve","VERIFIED_CLOSED","JE_APPROVED"),("reject","REOPENED","JE_REJECTED")
])
def test_je_review_state_and_audit(isolated,decision,status,event_type):
    client, db, photo = isolated
    login(client,"je")
    response = client.post("/api/tickets/ND-1043/review",json={"decision":decision,"notes":"Evidence inspected in isolated policy test."})
    assert response.status_code == 200, response.text
    assert response.json()["status"] == status
    assert response.json()["events"][-1]["event_type"] == event_type
    assert any(r["je_decision"]==decision for r in response.json()["repairs"])

def test_role_checks_and_no_closure_without_evidence(isolated):
    client, db, photo = isolated
    response = client.post("/api/tickets/ND-1042/assign",json={"contractor_id":2})
    assert response.status_code == 401
    login(client,"citizen")
    assert client.put("/api/config",json={}).status_code in (403,422)
    assert client.post("/api/tickets/ND-1042/assign",json={"contractor_id":2}).status_code == 403
    login(client,"je")
    assert client.post("/api/tickets/ND-1042/review",json={"decision":"approve","notes":"No repair evidence provided."}).status_code == 409

def test_public_detail_contains_no_user_email(isolated):
    client, db, photo = isolated
    response = client.get("/api/public/tickets/ND-1043")
    assert response.status_code == 200
    assert "@nagardrishti.demo" not in response.text
    assert "citizen_id" not in response.text
    assert "password" not in response.text
