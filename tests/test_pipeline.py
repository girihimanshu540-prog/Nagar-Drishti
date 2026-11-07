"""Deterministic policy tests; these do not certify real-world image accuracy."""
from datetime import timedelta
import io
import numpy as np
import pytest
from PIL import Image
from api.config import DEFAULTS
from api.models import utcnow
from api.ai.pipeline import validate_capture, haversine, priority, image_metrics, Comparison, decide_repair

@pytest.fixture
def photo():
    data = np.random.default_rng(42).integers(30, 235, (512,512,3), dtype=np.uint8)
    out = io.BytesIO()
    Image.fromarray(data).save(out, format="JPEG", quality=95)
    return out.getvalue()

def capture(photo, **changes):
    values = dict(data=photo, lat=18.5204, lng=73.8567, accuracy=8, captured_at=utcnow(), capture_source="live_camera", settings=DEFAULTS)
    values.update(changes)
    return validate_capture(**values)

def test_valid_capture(photo):
    encoded, pixels = capture(photo)
    assert encoded and pixels.shape == (512,512,3)

def test_ten_minute_old_rejected(photo):
    with pytest.raises(ValueError, match="too old"):
        capture(photo, captured_at=utcnow()-timedelta(minutes=10))

@pytest.mark.parametrize("source", ["gallery","file","", "seed_demo"])
def test_non_camera_rejected(photo, source):
    with pytest.raises(ValueError, match="live-camera"):
        capture(photo, capture_source=source)

def test_poor_gps_rejected(photo):
    with pytest.raises(ValueError, match="GPS accuracy"):
        capture(photo, accuracy=51)

def test_future_rejected(photo):
    with pytest.raises(ValueError, match="future"):
        capture(photo, captured_at=utcnow()+timedelta(minutes=5))

def test_dark_rejected():
    out = io.BytesIO()
    Image.new("RGB", (512,512), (2,2,2)).save(out, format="JPEG")
    with pytest.raises(ValueError, match="too dark"):
        capture(out.getvalue())

def test_blank_rejected():
    out = io.BytesIO()
    Image.new("RGB", (512,512), (130,130,130)).save(out, format="JPEG")
    with pytest.raises(ValueError, match="blurry"):
        capture(out.getvalue())

def test_dedup_boundaries():
    assert 5.9 < haversine(18.52,73.85,18.52+6/111195,73.85) < 6.1
    assert haversine(18.52,73.85,18.52+40/111195,73.85) > DEFAULTS["dedup_radius_m"]

def test_priority_formula():
    assert priority(5,.8) == 3.32

def test_identical_image_metrics(photo):
    metrics = image_metrics(photo,photo,[.3,.3,.7,.7])
    assert metrics["ssim_global"] == pytest.approx(1)
    assert metrics["ssim_defect_region"] == pytest.approx(1)
    assert metrics["same_location_score"] > .2

def test_unrelated_photo_never_closes():
    decision, reason = decide_repair(
        {"ssim_global":.05, "ssim_defect_region":.1,"same_location_score":.01},
        {"defect_present":False,"confidence":.99},
        Comparison(same_place=False,same_place_confidence=.98,verdict="uncertain",reason="Different street"))
    assert decision == "NEEDS_JE_REVIEW" and "not been closed" in reason

def test_all_independent_repair_gates_required():
    metrics = {"ssim_global":.85,"ssim_defect_region":.3,"same_location_score":.6}
    comparison = Comparison(same_place=True,same_place_confidence=.96,verdict="repaired",reason="Same surroundings")
    assert decide_repair(metrics,{"defect_present":False,"confidence":.95},comparison)[0] == "VERIFIED_CLOSED"
    assert decide_repair({**metrics,"ssim_defect_region":None},{"defect_present":False,"confidence":.95},comparison)[0] == "NEEDS_JE_REVIEW"
    assert decide_repair({**metrics,"ssim_defect_region":.98},{"defect_present":False,"confidence":.95},comparison)[0] == "NEEDS_JE_REVIEW"
    assert decide_repair(metrics,{"defect_present":False,"confidence":.3},comparison)[0] == "NEEDS_JE_REVIEW"

def test_defect_remaining_reopens():
    decision, _ = decide_repair(
        {"ssim_global":.9,"ssim_defect_region":.9,"same_location_score":.6},
        {"defect_present":True,"confidence":.95},
        Comparison(same_place=True,same_place_confidence=.98,verdict="defect_remaining",reason="Still a pothole"))
    assert decision == "REOPENED"
