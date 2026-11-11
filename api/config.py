"""One source of truth for evidence thresholds. Commissioner values persist in DB."""
import os

# Launch mode is intentionally not an environment-controlled AI switch.
# Retained weights and historical scores must never activate inference.
PRODUCTION = os.getenv("APP_ENV") == "production" or os.getenv("NODE_ENV") == "production" or bool(os.getenv("REPLIT_DEPLOYMENT"))
ALLOW_DEMO_ACCOUNTS = not PRODUCTION and os.getenv("ALLOW_DEMO_ACCOUNTS", "").lower() == "true"
DEFAULTS = {
    "capture_max_age_s": 120,
    "gps_max_accuracy_m": 50,
    "dedup_radius_m": 10,
    "repair_radius_m": 15,
    "detector_mode": "disabled",
}
MIN_BRIGHTNESS = 25
MIN_LAPLACIAN_VARIANCE = 35
MIN_DETECTION_CONFIDENCE = 0.65
MIN_SAME_LOCATION = 0.20
MIN_GLOBAL_SSIM = 0.35
MAX_DEFECT_SSIM = 0.80
MIN_VISION_SAME_PLACE = 0.85
MAX_IMAGE_BYTES = 8 * 1024 * 1024
STATUSES = ["OPEN", "ASSIGNED", "REPAIR_SUBMITTED", "NEEDS_JE_REVIEW", "VERIFIED_CLOSED", "REOPENED"]
