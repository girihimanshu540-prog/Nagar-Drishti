"""Explicit public-safe serialization; never expose user emails or raw audit payloads."""
from sqlalchemy import select
from .models import Ward, User, Report, Repair, Event

def iso(value):
    return value.isoformat() if value else None

def columns(obj, names):
    return {name: getattr(obj, name) for name in names.split()}

def ticket_json(db, t):
    ward = db.get(Ward, t.ward_id)
    contractor = db.get(User, t.assigned_contractor_id) if t.assigned_contractor_id else None
    return {
        **columns(t, "id title location lat lng ward_id status severity traffic_density priority_score report_count assigned_contractor_id before_image_url detector_engine is_demo"),
        "ward_name": ward.name if ward else "Unknown ward",
        "contractor_name": contractor.company or contractor.name if contractor else None,
        "created_at": iso(t.created_at), "closed_at": iso(t.closed_at),
    }

def report_json(r):
    return {
        **columns(r, "id ticket_id image_url lat lng gps_accuracy_m capture_source detector_engine validation_status"),
        "captured_at": iso(r.captured_at),
        "reason": r.rejection_reason or r.detection_json.get("reason", ""),
        "onnx": r.detection_json.get("onnx"),
        "severity": r.detection_json.get("severity", 1),
        "bbox": r.detection_json.get("bbox", []),
    }

def repair_json(r):
    return {**columns(r, "id ticket_id image_url ssim_global ssim_defect_region same_location_score vision_verdict vision_reason decision je_decision je_notes"),
            "captured_at": iso(r.captured_at)}

def event_json(db, e, public=False):
    actor = db.get(User, e.actor_id) if e.actor_id else None
    return {**columns(e, "id ticket_id event_type"), "description": e.payload_json.get("description", ""),
            "at": iso(e.at), "actor_name": (actor.role.replace("_", " ").title() if public else actor.name) if actor else "Verification system"}

def detail_json(db, ticket, public=False):
    reports = db.scalars(select(Report).where(Report.ticket_id == ticket.id).order_by(Report.id)).all()
    repairs = db.scalars(select(Repair).where(Repair.ticket_id == ticket.id).order_by(Repair.id)).all()
    events = db.scalars(select(Event).where(Event.ticket_id == ticket.id).order_by(Event.at)).all()
    result = {**ticket_json(db, ticket), "reports": [report_json(r) for r in reports],
              "repairs": [repair_json(r) for r in repairs], "events": [event_json(db, e, public) for e in events]}
    if public:
        # Personal location timestamps, actor identity and review notes remain private.
        for r in result["reports"]:
            r.pop("gps_accuracy_m", None)
        for r in result["repairs"]:
            r["je_notes"] = None
    return result
