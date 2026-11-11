"""Launch mode returns no model diagnostics, even for historical report records."""
from test_api import isolated, login, report
from sqlalchemy import select
from api.models import Report


def test_live_and_saved_report_have_no_model_result(isolated):
    client, db, photo = isolated
    login(client, "citizen")
    result = report(client, photo).json()
    assert result["accepted"] and result["ticket"]
    assert result["onnx"] is None and result["detector_engine"] == "manual"
    stored = client.get("/api/reports/mine").json()
    assert next(row for row in stored if row["ticket_id"] == result["ticket"]["id"])["onnx"] is None
    historical = db.scalar(select(Report).where(Report.ticket_id == result["ticket"]["id"]))
    historical.detection_json = {**historical.detection_json, "onnx": {
        "status": "ran", "detected": True, "confidence": .99,
        "confidence_threshold": .65, "reason": "Historical fixture, not a launch result."}}
    db.flush()
    assert client.get("/api/reports/mine").json()[0]["onnx"] is None


def test_invalid_capture_has_no_inference_or_ticket(isolated):
    client, db, photo = isolated
    login(client, "citizen")
    invalid = report(client, photo, capture_source="gallery").json()
    assert invalid["onnx"] is None
    assert not invalid["accepted"] and "ticket" not in invalid
