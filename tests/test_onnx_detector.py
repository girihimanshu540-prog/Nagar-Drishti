"""ONNX integration/decoding tests, not field-image accuracy acceptance."""
import numpy as np
import pytest
from api.ai import onnx_detector, pipeline


def vision_result():
    return pipeline.Detection(defect_present=True, defect_type="crack", severity=2,
                              confidence=.9, reason="Visible crack.", is_screen=False,
                              bbox=[.2, .2, .4, .4])


def test_model_loads_and_runs_on_cpu():
    session, class_id = onnx_detector.load_session()
    assert class_id == 2
    assert session.get_providers() == ["CPUExecutionProvider"]
    boxes = onnx_detector.detect_potholes(np.zeros((480, 640, 3), np.uint8), .65)
    assert isinstance(boxes, list)


def test_only_pothole_class_counts_and_overlaps_are_suppressed():
    output = np.zeros((1, 9, 8400), np.float32)
    output[0, :4, 0] = [320, 320, 100, 100]
    output[0, 4, 0] = .99  # attribution label, not a defect
    output[0, :4, 1] = [320, 320, 100, 100]
    output[0, 6, 1] = .9  # pothole class 2
    output[0, :4, 2] = [321, 321, 100, 100]
    output[0, 6, 2] = .85  # duplicate region
    boxes = onnx_detector.decode_detections(output, 2, .65)
    assert len(boxes) == 1
    assert boxes[0]["confidence"] == pytest.approx(.9)
    assert boxes[0]["bbox"] == pytest.approx([270/640, 270/640, 370/640, 370/640])


def test_invalid_output_is_rejected():
    with pytest.raises(ValueError, match="invalid"):
        onnx_detector.decode_detections(np.zeros((1, 5, 8400)), 2, .65)


def test_auto_falls_back_when_onnx_fails(monkeypatch):
    monkeypatch.setattr(pipeline, "vision_json", lambda *args: vision_result())
    def broken(*args):
        raise RuntimeError("unreadable model")
    monkeypatch.setattr(onnx_detector, "detect_potholes", broken)
    result = pipeline.detect(b"test", np.zeros((128, 128, 3), np.uint8), "auto")
    assert result["engine"] == "vision"
    assert result["defect_present"]
    assert "fallback" in result["reason"]
    with pytest.raises(pipeline.AnalysisUnavailable, match="ONNX"):
        pipeline.detect(b"test", np.zeros((128, 128, 3), np.uint8), "onnx")


def test_no_potholes_cannot_erase_other_hazards(monkeypatch):
    monkeypatch.setattr(pipeline, "vision_json", lambda *args: vision_result())
    monkeypatch.setattr(onnx_detector, "detect_potholes", lambda *args: [])
    result = pipeline.detect(b"test", np.zeros((128, 128, 3), np.uint8), "auto")
    assert result["engine"] == "onnx+vision"
    assert result["defect_present"] and result["defect_type"] == "crack"
    assert result["confidence"] == .9


def test_vision_mode_does_not_load_onnx(monkeypatch):
    monkeypatch.setattr(pipeline, "vision_json", lambda *args: vision_result())
    def should_not_run(*args):
        pytest.fail("vision mode must bypass ONNX")
    monkeypatch.setattr(onnx_detector, "detect_potholes", should_not_run)
    assert pipeline.detect(b"test", np.zeros((128, 128, 3), np.uint8), "vision")["engine"] == "vision"


def test_pothole_detection_keeps_vision_screen_rejection(monkeypatch):
    screen = vision_result()
    screen.is_screen = True
    monkeypatch.setattr(pipeline, "vision_json", lambda *args: screen)
    monkeypatch.setattr(onnx_detector, "detect_potholes", lambda *args: [
        {"bbox": [.2, .2, .4, .4], "confidence": .95}])
    result = pipeline.detect(b"test", np.zeros((128, 128, 3), np.uint8), "auto")
    assert result["defect_type"] == "pothole"
    assert result["is_screen"] is True
