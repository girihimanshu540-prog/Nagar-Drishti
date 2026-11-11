"""Explicit public-safe serialization; never expose user emails or raw audit payloads."""
from sqlalchemy import select
from .models import Ward, User, Report, Repair, Event

def iso(value):
    return value.isoformat() if value else None

def columns(obj, names):
    return {name: getattr(obj, name) for name in names.split()}

def ticket_json(db, t, public=False, viewer=None):
    ward = db.get(Ward, t.ward_id)
    contractor = db.get(User, t.assigned_contractor_id) if t.assigned_contractor_id else None
    result = {
        **columns(t, "id title location lat lng ward_id status severity traffic_density priority_score report_count assigned_contractor_id before_image_url detector_engine is_demo"),
        "ward_name": ward.name if ward else "Unknown ward",
        "contractor_name": contractor.company or contractor.name if contractor else None,
        "created_at": iso(t.created_at), "closed_at": iso(t.closed_at),
    }
    if public:
        result.update(lat=round(t.lat, 3), lng=round(t.lng, 3),
                      location="Approximate reported area", before_image_url="",
                      assigned_contractor_id=None, contractor_name=None,
                      detector_engine="demo" if t.is_demo else "manual")
    elif viewer and viewer.role == "citizen":
        # Grouping nearby reports does not grant access to another citizen's photo.
        result["before_image_url"] = db.scalar(select(Report.image_url).where(
            Report.ticket_id == t.id, Report.citizen_id == viewer.id).order_by(Report.id).limit(1)) or ""
    return result

def report_json(r):
    return {
        **columns(r, "id ticket_id image_url lat lng gps_accuracy_m capture_source detector_engine validation_status"),
        "captured_at": iso(r.captured_at),
        "reason": r.rejection_reason or r.detection_json.get("reason", ""),
        "onnx": None,
        "severity": r.detection_json.get("severity", 1),
        "bbox": [],
    }

def repair_json(r):
    return {**columns(r, "id ticket_id image_url ssim_global ssim_defect_region same_location_score vision_verdict vision_reason decision je_decision je_notes"),
            "captured_at": iso(r.captured_at)}

def event_json(db, e, public=False):
    actor = db.get(User, e.actor_id) if e.actor_id else None
    descriptions = {"REPORTED": "Citizen report submitted.", "REPORT_GROUPED": "Another report linked to this ticket.",
                    "ASSIGNED": "Repair work assigned.", "REPAIR_SUBMITTED": "Repair evidence submitted for engineer review.",
                    "JE_APPROVED": "Engineer approved the repair.", "JE_REJECTED": "Engineer reopened the report."}
    return {**columns(e, "id ticket_id event_type"), "description": descriptions.get(e.event_type, "Ticket status updated.") if public else e.payload_json.get("description", ""),
            "at": iso(e.at), "actor_name": (actor.role.replace("_", " ").title() if public else actor.name) if actor else "Tracking system"}

def detail_json(db, ticket, public=False, viewer=None):
    if public:
        return {**ticket_json(db, ticket, public=True), "reports": [], "repairs": [], "events": []}
    reports = db.scalars(select(Report).where(Report.ticket_id == ticket.id).order_by(Report.id)).all()
    repairs = db.scalars(select(Repair).where(Repair.ticket_id == ticket.id).order_by(Repair.id)).all()
    events = db.scalars(select(Event).where(Event.ticket_id == ticket.id).order_by(Event.at)).all()
    result = {**ticket_json(db, ticket, viewer=viewer), "reports": [report_json(r) for r in reports if not viewer or viewer.role != "citizen" or r.citizen_id == viewer.id],
              "repairs": [repair_json(r) for r in repairs], "events": [event_json(db, e, public) for e in events]}
    if public:
        # Personal location timestamps, actor identity and review notes remain private.
        for r in result["reports"]:
            r.pop("gps_accuracy_m", None)
        for r in result["repairs"]:
            r["je_notes"] = None
    return result
