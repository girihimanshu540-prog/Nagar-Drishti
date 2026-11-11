"""Public-launch policy regressions, using rolled-back DB and storage fixtures.

These do not prove real-device camera/GPS behavior or a production deployment.
"""
from sqlalchemy import select, func
from api import config
from api.models import Ticket, Repair, Settings, utcnow
import api.main as routes
from test_api import isolated, login, report


def test_demo_logins_and_existing_sessions_disabled(isolated, monkeypatch):
    client, db, photo = isolated
    login(client, "commissioner")
    monkeypatch.setattr(config, "ALLOW_DEMO_ACCOUNTS", False)
    assert client.get("/api/me").status_code == 401
    blocked = client.post("/api/auth/login", json={
        "email": "commissioner@nagardrishti.demo", "password": "NagarDemo2026!"})
    assert blocked.status_code == 401
    assert client.post("/api/auth/register", json={
        "name": "Reserved User", "email": "new@nagardrishti.demo",
        "password": "TestPassword2026!"}).status_code == 422


def test_private_evidence_and_public_redaction(isolated, monkeypatch):
    client, db, photo = isolated
    login(client, "citizen")
    created = report(client, photo, lat=17.123456, lng=72.123456).json()
    id = created["ticket"]["id"]
    monkeypatch.setattr(routes, "load_image", lambda url: photo)
    owned = client.get("/api/evidence/test-fixture")
    assert owned.status_code == 200
    assert "no-store" in owned.headers["cache-control"]
    assert client.get(f"/api/tickets/{id}").json()["reports"]
    client.cookies.clear()
    assert client.get("/api/evidence/test-fixture").status_code == 401
    public = client.get(f"/api/public/tickets/{id}").json()
    assert public["is_demo"] is False
    assert public["lat"] == 17.123 and public["lng"] == 72.123
    assert public["location"] == "Approximate reported area"
    assert public["before_image_url"] == "" and public["contractor_name"] is None
    assert public["reports"] == public["repairs"] == public["events"] == []
    listed = next(t for t in client.get("/api/tickets").json() if t["id"] == id)
    assert listed["before_image_url"] == "" and listed["lat"] == 17.123
    stranger = client.post("/api/auth/register", json={
        "name": "Launch Test Citizen", "email": "launch-private-test@example.org",
        "password": "TestPassword2026!"})
    assert stranger.status_code == 200
    assert client.get("/api/evidence/test-fixture").status_code == 403
    assert client.get(f"/api/tickets/{id}").status_code == 403
    assert client.get("/api/contractors/scorecard").status_code == 403
    # Becoming a second reporter on the same ticket still must not expose the first photo.
    monkeypatch.setattr(routes, "save_image", lambda data: "/api/evidence/other-fixture")
    grouped = report(client, photo, lat=17.123456, lng=72.123456).json()
    assert grouped["ticket"]["id"] == id
    own_detail = client.get(f"/api/tickets/{id}").json()
    assert len(own_detail["reports"]) == 1
    assert own_detail["before_image_url"] == "/api/evidence/other-fixture"
    assert client.get("/api/evidence/test-fixture").status_code == 403
    assert client.get("/api/evidence/other-fixture").status_code == 200


def test_repairs_require_human_review_then_je_approval(isolated):
    client, db, photo = isolated
    approved_before = client.get("/api/stats").json()["verified_closures"]
    login(client, "citizen")
    created = report(client, photo).json()["ticket"]
    login(client, "je")
    assert client.post(f"/api/tickets/{created['id']}/assign", json={"contractor_id": 2}).status_code == 200
    login(client, "contractor")
    repaired = client.post(f"/api/tickets/{created['id']}/repair", data={
        "lat": created["lat"], "lng": created["lng"], "accuracy": 5,
        "captured_at": utcnow().isoformat(), "capture_source": "live_camera"
    }, files={"image": ("camera.jpg", photo, "image/jpeg")})
    assert repaired.status_code == 200, repaired.text
    result = repaired.json()
    assert result["accepted"] and result["decision"] == "NEEDS_JE_REVIEW"
    assert result["detector_engine"] == "manual" and result["ticket"]["closed_at"] is None
    row = db.scalar(select(Repair).where(Repair.ticket_id == created["id"]))
    assert row.vision_verdict == "not_run"
    assert row.ssim_global is row.ssim_defect_region is row.same_location_score is None
    # Contractor cannot approve their own submission.
    assert client.post(f"/api/tickets/{created['id']}/review",
                       json={"decision": "approve", "notes": "Contractor cannot approve this."}).status_code == 403
    login(client, "je")
    approved = client.post(f"/api/tickets/{created['id']}/review",
                           json={"decision": "approve", "notes": "Engineer inspected the before and after evidence."})
    assert approved.status_code == 200 and approved.json()["status"] == "VERIFIED_CLOSED"
    assert approved.json()["events"][-1]["event_type"] == "JE_APPROVED"
    assert client.get("/api/stats").json()["verified_closures"] == approved_before + 1


def test_stale_detector_setting_cannot_enable_analysis(isolated):
    client, db, photo = isolated
    row = db.get(Settings, 1)
    row.values = {**row.values, "detector_mode": "onnx"}
    db.flush()
    assert routes.settings(db)["detector_mode"] == "disabled"
    login(client, "commissioner")
    values = client.get("/api/config").json()
    assert values["detector_mode"] == "disabled"
    values["detector_mode"] = "vision"
    assert client.put("/api/config", json=values).status_code == 422


def test_demo_records_excluded_from_live_metrics(isolated):
    client, db, photo = isolated
    actual = db.scalar(select(func.count()).select_from(Ticket).where(Ticket.is_demo == False))
    assert client.get("/api/stats").json()["total"] == actual
    sample = client.get("/api/public/tickets/ND-1043").json()
    assert sample["is_demo"] is True
    assert sample["reports"] == [] and sample["before_image_url"] == ""
    assert client.get("/api/contractors/scorecard").status_code == 401


def test_cross_site_cookie_mutation_rejected(isolated):
    client, db, photo = isolated
    response = client.post("/api/auth/logout", headers={"Origin": "https://untrusted.example"})
    assert response.status_code == 403
    assert client.post("/api/auth/logout", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
