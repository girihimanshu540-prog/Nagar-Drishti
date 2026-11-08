"""Reuse isolated API fixtures; never submit synthetic photos to the live API."""
from tests.test_api import isolated, login, report
import api.main as routes


def test_result_and_saved_report_include_separate_model_confidence(isolated, monkeypatch):
    client, db, photo = isolated
    login(client, "citizen")
    original = routes.detect
    diagnostics = {"status": "ran", "detected": False, "confidence": .27,
                   "confidence_threshold": .65, "reason": "Below threshold."}
    monkeypatch.setattr(routes, "detect", lambda *args: {**original(*args), "onnx": diagnostics})
    result = report(client, photo).json()
    assert result["accepted"] and result["ticket"]
    assert result["onnx"] == diagnostics
    stored = client.get("/api/reports/mine").json()
    assert next(row for row in stored if row["ticket_id"] == result["ticket"]["id"])["onnx"] == diagnostics


def test_rejected_and_invalid_captures_show_correct_model_run_state(isolated, monkeypatch):
    client, db, photo = isolated
    login(client, "citizen")
    invalid = report(client, photo, capture_source="gallery").json()
    assert invalid["onnx"]["status"] == "not_run"
    assert invalid["onnx"]["detected"] is None and invalid["onnx"]["confidence"] is None
    original = routes.detect
    diagnostics = {"status": "ran", "detected": False, "confidence": .12,
                   "confidence_threshold": .65, "reason": "Below threshold."}
    monkeypatch.setattr(routes, "detect", lambda *args: {**original(*args), "defect_present": False, "onnx": diagnostics})
    rejected = report(client, photo).json()
    assert not rejected["accepted"] and "ticket" not in rejected
    assert rejected["onnx"] == diagnostics
