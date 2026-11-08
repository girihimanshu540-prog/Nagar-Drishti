"""Shared REST API. All state changes and their audit events commit atomically."""
import io
import logging
import math
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime
from urllib.parse import urlparse
import bcrypt
from fastapi import FastAPI, Request, Response, Depends, UploadFile, File, Form, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from pydantic import BaseModel, Field
from sqlalchemy import select, text, func
from . import config
from .auth import authenticate, fail, hash_password, user_json, session_response, COOKIE
from .models import Session, Ward, User, Ticket, Report, Repair, Event, TrafficZone, Settings, utcnow
from .views import ticket_json, detail_json, report_json, event_json, columns
from .storage import save_image, load_image
from .ai.pipeline import validate_capture, detect, haversine, priority, image_metrics, vision_json, Comparison, decide_repair, AnalysisUnavailable

log = logging.getLogger("nagardrishti")
app = FastAPI(title="NagarDrishti API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
origins = ["https://" + d for d in os.getenv("REPLIT_DOMAINS", "").split(",") if d]
origins += [s for s in os.getenv("CORS_ORIGINS", "").split(",") if s]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])
hits = defaultdict(deque)

@app.get("/docs", include_in_schema=False)
def root_docs():
    return get_swagger_ui_html(openapi_url="/api/openapi.json", title="NagarDrishti API")

@app.middleware("http")
async def security(request, call_next):
    origin = request.headers.get("origin")
    # Native bearer clients do not use browser cookies. Cookie mutations require same origin.
    if request.method in ("POST", "PUT", "DELETE", "PATCH") and origin and not request.headers.get("authorization"):
        if urlparse(origin).netloc != request.headers.get("host") and origin not in origins:
            return JSONResponse({"error": {"code": "ORIGIN_FORBIDDEN", "message": "Cross-site requests are not allowed."}}, 403)
    ip = request.client.host if request.client else "unknown"
    key = (ip, "auth" if "/auth/" in request.url.path else "read" if request.method == "GET" else "write")
    now = time.monotonic()
    queue = hits[key]
    while queue and queue[0] < now-60:
        queue.popleft()
    limit = {"auth": 20, "read": 500, "write": 20}[key[1]]
    if len(queue) >= limit:
        return JSONResponse({"error": {"code": "RATE_LIMITED", "message": "Too many requests. Please wait one minute."}}, 429, headers={"Retry-After": "60"})
    queue.append(now)
    size = request.headers.get("content-length", "0")
    if size.isdigit() and int(size) > config.MAX_IMAGE_BYTES + 65536:
        return JSONResponse({"error": {"code": "IMAGE_TOO_LARGE", "message": "Images must not exceed 8 MB."}}, 413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    if not request.url.path.startswith("/api/evidence/"):
        response.headers["Cache-Control"] = "no-store"
    return response

@app.exception_handler(HTTPException)
async def http_error(request, exc):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "REQUEST_FAILED", "message": str(exc.detail)}
    return JSONResponse({"error": detail}, exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    problems = "; ".join(".".join(map(str, e["loc"])) + ": " + e["msg"] for e in exc.errors())
    return JSONResponse({"error": {"code": "INVALID_INPUT", "message": problems}}, 422)

@app.exception_handler(AnalysisUnavailable)
async def ai_error(request, exc):
    return JSONResponse({"error": {"code": "ANALYSIS_UNAVAILABLE", "message": str(exc)}}, 503)

@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    log.exception("Request failed: %s %s", request.method, request.url.path)
    return JSONResponse({"error": {"code": "SERVER_ERROR", "message": "The request could not be completed. No successful result was fabricated."}}, 500)

def database():
    with Session() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise

def settings(db):
    row = db.get(Settings, 1)
    return {**config.DEFAULTS, **(row.values if row else {})}

def event(db, ticket, actor, kind, description, **payload):
    db.add(Event(ticket_id=ticket.id, actor_id=actor.id if actor else None,
                 event_type=kind, payload_json={"description": description, **payload}))

def get_ticket(db, id, lock=False):
    query = select(Ticket).where(Ticket.id == id)
    if lock:
        query = query.with_for_update()
    t = db.scalar(query)
    if not t:
        fail(404, "TICKET_NOT_FOUND", "No ticket was found for that ID.")
    return t

def ticket_access(db, user, ticket):
    if user.role == "commissioner":
        return
    if user.role == "je" and user.ward_id == ticket.ward_id:
        return
    if user.role == "contractor" and user.id == ticket.assigned_contractor_id:
        return
    if user.role == "citizen" and db.scalar(select(Report.id).where(Report.ticket_id == ticket.id, Report.citizen_id == user.id).limit(1)):
        return
    fail(403, "TICKET_FORBIDDEN", "This ticket is outside your role or assigned work.")

@app.get("/api/healthz")
@app.get("/api/health")
@app.get("/health", include_in_schema=False)
def health(db=Depends(database)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}

class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=72)

class Registration(Credentials):
    name: str = Field(min_length=2, max_length=100)

@app.post("/api/auth/login")
def login(data: Credentials, response: Response, db=Depends(database)):
    user = db.scalar(select(User).where(User.email == data.email.lower().strip()))
    # Invalid email has the same expensive verification path as a bad password.
    hashed = user.password_hash if user else "$2b$12$C6UzMDM.H6dfI/f/IKcEe.1sH0gWKxX7UsaZYF/eFJdEnJrsVEg1y"
    try:
        valid = bcrypt.checkpw(data.password.encode(), hashed.encode())
    except ValueError:
        valid = False
    if not user or not valid:
        fail(401, "INVALID_CREDENTIALS", "The email or password is incorrect.")
    return session_response(user, response)

@app.post("/api/auth/register")
def register(data: Registration, response: Response, db=Depends(database)):
    email = data.email.lower().strip()
    if "@" not in email or "." not in email.rsplit("@", 1)[1]:
        fail(422, "INVALID_EMAIL", "Enter a valid email address.")
    if db.scalar(select(User).where(User.email == email)):
        fail(409, "EMAIL_EXISTS", "An account with that email already exists.")
    ward = db.scalar(select(Ward).order_by(Ward.id).limit(1))
    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password), role="citizen", ward_id=ward.id)
    db.add(user)
    db.commit()
    return session_response(user, response)

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="lax")
    return {"status": "ok"}

@app.get("/api/me")
def me(request: Request, db=Depends(database)):
    return user_json(authenticate(request, db))

@app.get("/api/wards")
def wards(db=Depends(database)):
    return [columns(w, "id name center_lat center_lng") for w in db.scalars(select(Ward).order_by(Ward.id))]

@app.get("/api/tickets")
def tickets(request: Request, status: str | None = None, ward: int | None = None,
            severity: int | None = None, search: str | None = None, sort: str = "priority",
            mine: bool = False, db=Depends(database)):
    query = select(Ticket)
    if status and status != "ALL":
        if status not in config.STATUSES:
            fail(422, "INVALID_STATUS", "Select a valid ticket status.")
        query = query.where(Ticket.status == status)
    if ward:
        query = query.where(Ticket.ward_id == ward)
    if severity:
        query = query.where(Ticket.severity == severity)
    if search:
        term = "%" + search[:100] + "%"
        query = query.where(Ticket.id.ilike(term) | Ticket.title.ilike(term) | Ticket.location.ilike(term))
    if mine:
        user = authenticate(request, db)
        if user.role == "contractor":
            query = query.where(Ticket.assigned_contractor_id == user.id)
        elif user.role == "citizen":
            query = query.where(Ticket.id.in_(select(Report.ticket_id).where(Report.citizen_id == user.id)))
        elif user.role == "je":
            query = query.where(Ticket.ward_id == user.ward_id)
    ordering = Ticket.created_at.desc() if sort in ("recent", "newest", "created_at") else Ticket.severity.desc() if sort == "severity" else Ticket.priority_score.desc()
    return [ticket_json(db, t) for t in db.scalars(query.order_by(ordering, Ticket.id).limit(500))]

@app.get("/api/tickets/{id}")
def ticket_detail(id: str, request: Request, db=Depends(database)):
    user = authenticate(request, db)
    ticket = get_ticket(db, id)
    ticket_access(db, user, ticket)
    return detail_json(db, ticket)

@app.get("/api/public/tickets/{id}")
def public_detail(id: str, db=Depends(database)):
    return detail_json(db, get_ticket(db, id), public=True)

class Assignment(BaseModel):
    contractor_id: int

@app.post("/api/tickets/{id}/assign")
def assign(id: str, data: Assignment, request: Request, db=Depends(database)):
    user = authenticate(request, db, ["je", "commissioner"])
    ticket = get_ticket(db, id, lock=True)
    ticket_access(db, user, ticket)
    if ticket.status not in ("OPEN", "REOPENED", "ASSIGNED"):
        fail(409, "INVALID_STATE", "Only open, reopened or assigned tickets can be assigned.")
    contractor = db.get(User, data.contractor_id)
    if not contractor or contractor.role != "contractor" or contractor.ward_id != ticket.ward_id:
        fail(422, "INVALID_CONTRACTOR", "Select a contractor in the ticket's ward.")
    ticket.status = "ASSIGNED"
    ticket.assigned_contractor_id = contractor.id
    event(db, ticket, user, "ASSIGNED", f"Repair assigned to {contractor.company or contractor.name}.")
    db.commit()
    return detail_json(db, ticket)

class Review(BaseModel):
    decision: str
    notes: str = Field(min_length=10, max_length=2000)

@app.post("/api/tickets/{id}/review")
def review(id: str, data: Review, request: Request, db=Depends(database)):
    user = authenticate(request, db, ["je", "commissioner"])
    ticket = get_ticket(db, id, lock=True)
    ticket_access(db, user, ticket)
    if data.decision not in ("approve", "reject"):
        fail(422, "INVALID_DECISION", "Choose approve or reject.")
    if ticket.status != "NEEDS_JE_REVIEW":
        fail(409, "INVALID_STATE", "Only tickets awaiting a Junior Engineer review can be reviewed.")
    repair = db.scalar(select(Repair).where(Repair.ticket_id == id).order_by(Repair.id.desc()).limit(1))
    if not repair:
        fail(409, "NO_EVIDENCE", "No repair evidence is available. Closure is not allowed.")
    repair.je_decision, repair.je_notes = data.decision, data.notes.strip()
    ticket.status = "VERIFIED_CLOSED" if data.decision == "approve" else "REOPENED"
    ticket.closed_at = utcnow() if data.decision == "approve" else None
    event(db, ticket, user, "JE_APPROVED" if data.decision == "approve" else "JE_REJECTED",
          "Junior Engineer approved the repair evidence." if data.decision == "approve" else "Junior Engineer rejected the repair evidence; ticket reopened.",
          notes=data.notes, repair_id=repair.id)
    db.commit()
    return detail_json(db, ticket)

def capture_bytes(image):
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        fail(422, "INVALID_IMAGE_TYPE", "Only JPEG, PNG or WebP images are accepted.")
    data = image.file.read(config.MAX_IMAGE_BYTES + 1)
    if len(data) > config.MAX_IMAGE_BYTES:
        fail(413, "IMAGE_TOO_LARGE", "Image must not exceed 8 MB.")
    return data

def traffic_at(db, ward_id, lat, lng):
    zones = db.scalars(select(TrafficZone).where(TrafficZone.ward_id == ward_id)).all()
    matching = [z.density for z in zones if haversine(lat, lng, z.center_lat, z.center_lng) <= z.radius_m]
    return max(matching, default=0)

@app.post("/api/reports")
def submit_report(request: Request, image: UploadFile = File(...), lat: float = Form(...), lng: float = Form(...),
                  accuracy: float = Form(...), captured_at: datetime = Form(...), capture_source: str = Form(...),
                  db=Depends(database)):
    user = authenticate(request, db, ["citizen"])
    cfg = settings(db)
    raw = capture_bytes(image)
    try:
        jpeg, rgb = validate_capture(raw, lat, lng, accuracy, captured_at, capture_source, cfg)
    except ValueError as exc:
        return {"accepted": False, "reason": str(exc), "decision": "REJECTED", "detector_engine": "validation",
                "onnx": {"status": "not_run", "detected": None, "confidence": None,
                         "confidence_threshold": config.MIN_DETECTION_CONFIDENCE,
                         "reason": "Capture validation rejected the photo before model analysis."}}
    detection = detect(jpeg, rgb, cfg["detector_mode"])
    reason = None
    if detection["is_screen"]:
        reason = "This appears to be a photograph of a screen. Photograph the road directly with the live camera."
    elif not detection["defect_present"]:
        reason = "No road defect could be identified. " + detection["reason"]
    elif detection["confidence"] < config.MIN_DETECTION_CONFIDENCE:
        reason = "Road-defect evidence is uncertain. Retake a clear photograph. " + detection["reason"]
    url = save_image(jpeg)
    if reason:
        db.add(Report(ticket_id=None, citizen_id=user.id, image_url=url, lat=lat, lng=lng, gps_accuracy_m=accuracy,
                      captured_at=captured_at, capture_source=capture_source, detector_engine=detection["engine"],
                      detection_json=detection, validation_status="REJECTED", rejection_reason=reason))
        db.commit()
        return {"accepted": False, "reason": reason, "decision": "REJECTED", "detector_engine": detection["engine"],
                "onnx": detection.get("onnx")}
    # Serialize dedup/creation across concurrent reports so two first reports cannot create duplicates.
    db.execute(text("SELECT pg_advisory_xact_lock(672319)"))
    candidates = db.scalars(select(Ticket).where(Ticket.status != "VERIFIED_CLOSED", Ticket.is_demo == False).with_for_update()).all()
    nearby = sorted([(haversine(lat, lng, t.lat, t.lng), t) for t in candidates], key=lambda p: p[0])
    ticket = nearby[0][1] if nearby and nearby[0][0] <= cfg["dedup_radius_m"] else None
    if ticket:
        ticket.report_count += 1
        ticket.severity = max(ticket.severity, detection["severity"])
        ticket.priority_score = priority(ticket.severity, ticket.traffic_density)
        kind = "REPORT_GROUPED"
    else:
        ward = min(db.scalars(select(Ward)).all(), key=lambda w: haversine(lat, lng, w.center_lat, w.center_lng))
        density = traffic_at(db, ward.id, lat, lng)
        ticket = Ticket(id="ND-" + uuid.uuid4().hex[:8].upper(), title=detection["defect_type"].replace("_", " ").title(),
                        location=f"Near {lat:.5f}, {lng:.5f}", lat=lat, lng=lng, ward_id=ward.id, severity=detection["severity"],
                        traffic_density=density, priority_score=priority(detection["severity"], density), report_count=1,
                        status="OPEN", before_image_url=url, detector_engine=detection["engine"], is_demo=False)
        db.add(ticket)
        db.flush()
        kind = "REPORTED"
    db.add(Report(ticket_id=ticket.id, citizen_id=user.id, image_url=url, lat=lat, lng=lng, gps_accuracy_m=accuracy,
                  captured_at=captured_at, capture_source=capture_source, detector_engine=detection["engine"],
                  detection_json=detection, validation_status="ACCEPTED"))
    event(db, ticket, user, kind, "Live-camera report accepted and grouped with existing ticket." if kind == "REPORT_GROUPED" else "Live-camera road defect accepted; ticket opened.",
          engine=detection["engine"], reason=detection["reason"])
    db.commit()
    return {"accepted": True, "reason": detection["reason"], "decision": "ACCEPTED", "severity": ticket.severity,
            "detector_engine": detection["engine"], "ticket": ticket_json(db, ticket), "onnx": detection.get("onnx")}

@app.get("/api/reports/mine")
def my_reports(request: Request, db=Depends(database)):
    user = authenticate(request, db, ["citizen"])
    return [report_json(r) for r in db.scalars(select(Report).where(Report.citizen_id == user.id).order_by(Report.id.desc()))]

@app.post("/api/tickets/{id}/repair")
def submit_repair(id: str, request: Request, image: UploadFile = File(...), lat: float = Form(...), lng: float = Form(...),
                  accuracy: float = Form(...), captured_at: datetime = Form(...), capture_source: str = Form(...),
                  db=Depends(database)):
    user = authenticate(request, db, ["contractor"])
    ticket = get_ticket(db, id)
    ticket_access(db, user, ticket)
    if ticket.is_demo:
        fail(409, "DEMO_EVIDENCE", "Synthetic demo images cannot verify real repairs. Submit a real citizen report first.")
    if ticket.status not in ("ASSIGNED", "REOPENED"):
        fail(409, "INVALID_STATE", "This ticket is not awaiting a repair submission.")
    cfg = settings(db)
    try:
        jpeg, rgb = validate_capture(capture_bytes(image), lat, lng, accuracy, captured_at, capture_source, cfg)
        if haversine(lat, lng, ticket.lat, ticket.lng) > cfg["repair_radius_m"]:
            raise ValueError(f"You must be within {cfg['repair_radius_m']} m of the ticket to submit repair evidence.")
    except ValueError as exc:
        event(db, ticket, user, "REPAIR_REJECTED", "Repair capture rejected: " + str(exc))
        db.commit()
        return {"accepted": False, "decision": "REJECTED", "reason": str(exc), "detector_engine": "validation", "ticket": ticket_json(db, ticket)}
    before = load_image(ticket.before_image_url)
    report = db.scalar(select(Report).where(Report.ticket_id == id, Report.validation_status == "ACCEPTED").order_by(Report.id).limit(1))
    metrics = image_metrics(before, jpeg, report.detection_json.get("bbox", []) if report else [])
    after = detect(jpeg, rgb, cfg["detector_mode"])
    if after["is_screen"]:
        decision, reason = "REJECTED", "Screen photography is not permitted. Capture the repaired road directly."
        comparison = None
    else:
        try:
            comparison = vision_json('Compare BEFORE then AFTER road inspection photos. Determine same physical spot from permanent surroundings, not just asphalt. Be conservative. Return JSON {same_place:boolean,same_place_confidence:0-1,verdict:"repaired"|"defect_remaining"|"uncertain",reason:string}. Only say repaired if the original defect has been removed and the road surface is repaired.', [before, jpeg], Comparison)
            decision, reason = decide_repair(metrics, after, comparison)
            reason += " " + comparison.reason
        except AnalysisUnavailable:
            comparison = None
            decision, reason = "NEEDS_JE_REVIEW", "Independent comparison was unavailable. Automatic closure is blocked; a Junior Engineer must inspect the evidence."
    url = save_image(jpeg)
    # Re-lock and check after slow image analysis: prevent stale verification from overriding a concurrent action.
    db.refresh(ticket, with_for_update=True)
    if ticket.status not in ("ASSIGNED", "REOPENED") or ticket.assigned_contractor_id != user.id:
        fail(409, "TICKET_CHANGED", "The ticket changed during analysis. Reload before submitting again.")
    repair = Repair(ticket_id=id, contractor_id=user.id, image_url=url, lat=lat, lng=lng, captured_at=captured_at,
                    **metrics, after_detections_json=after,
                    vision_verdict=comparison.verdict if comparison else "uncertain",
                    vision_reason=reason, decision=decision)
    db.add(repair)
    event(db, ticket, user, "REPAIR_SUBMITTED", "New live-camera repair evidence submitted.")
    if decision != "REJECTED":
        ticket.status = decision
        ticket.closed_at = utcnow() if decision == "VERIFIED_CLOSED" else None
    event(db, ticket, None, decision, reason, **metrics)
    db.commit()
    return {"accepted": decision != "REJECTED", "decision": decision, "reason": reason,
            "detector_engine": after["engine"], "ticket": ticket_json(db, ticket)}

@app.get("/api/evidence/{key}")
def evidence(key: str, request: Request, db=Depends(database)):
    url = f"/api/evidence/{key}"
    # Only committed evidence records may be served, never arbitrary storage objects.
    known = db.scalar(select(Report.id).where(Report.image_url == url).limit(1)) or db.scalar(select(Repair.id).where(Repair.image_url == url).limit(1))
    if not known:
        fail(404, "EVIDENCE_NOT_FOUND", "Evidence was not found.")
    return Response(load_image(url), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})

@app.get("/api/stats")
def stats(ward: int | None = None, db=Depends(database)):
    query = select(Ticket)
    if ward:
        query = query.where(Ticket.ward_id == ward)
    ts = db.scalars(query).all()
    counts = {s: sum(t.status == s for t in ts) for s in config.STATUSES}
    closed = [t for t in ts if t.closed_at]
    ids = [t.id for t in ts]
    prevented = db.scalar(select(func.count()).select_from(Repair).where(Repair.ticket_id.in_(ids), Repair.decision.in_(["REJECTED", "REOPENED", "NEEDS_JE_REVIEW"]))) or 0
    per_ward = [{"ward_id": w.id, "name": w.name, "total": sum(t.ward_id == w.id for t in ts),
                 "open": sum(t.ward_id == w.id and t.status != "VERIFIED_CLOSED" for t in ts),
                 "closed": sum(t.ward_id == w.id and t.status == "VERIFIED_CLOSED" for t in ts)}
                for w in db.scalars(select(Ward).order_by(Ward.id))]
    return {"total": len(ts), "open": len(ts)-counts["VERIFIED_CLOSED"], "verified_closures": counts["VERIFIED_CLOSED"],
            "je_queue": counts["NEEDS_JE_REVIEW"], "false_closures_prevented": prevented,
            "avg_time_to_close_hours": round(sum((t.closed_at-t.created_at).total_seconds()/3600 for t in closed)/len(closed), 1) if closed else 0,
            "reports_total": sum(t.report_count for t in ts), "per_ward": per_ward, "status_counts": counts}

@app.get("/api/activity")
def activity(db=Depends(database)):
    return [event_json(db, e, public=True) for e in db.scalars(select(Event).order_by(Event.at.desc()).limit(15))]

@app.get("/api/contractors/scorecard")
def contractors(db=Depends(database)):
    result = []
    for user in db.scalars(select(User).where(User.role == "contractor").order_by(User.id)):
        ts = db.scalars(select(Ticket).where(Ticket.assigned_contractor_id == user.id)).all()
        repairs = db.scalars(select(Repair).where(Repair.contractor_id == user.id)).all()
        closed = [t for t in ts if t.closed_at]
        verified = len(closed)
        rejected = sum(r.decision in ("REJECTED", "REOPENED") or r.je_decision == "reject" for r in repairs)
        result.append({"id": user.id, "name": user.company or user.name, "company": user.company,
                       "assigned": sum(t.status != "VERIFIED_CLOSED" for t in ts),
                       "verified": verified, "rejected": rejected,
                       "pending_review": sum(t.status == "NEEDS_JE_REVIEW" for t in ts),
                       "verification_rate": round(100*verified/max(len(repairs), 1), 1),
                       "avg_close_hours": round(sum((t.closed_at-t.created_at).total_seconds()/3600 for t in closed)/max(len(closed),1),1)})
    return result

def config_json(db):
    return {**settings(db), "traffic_zones": [columns(z, "id name ward_id center_lat center_lng radius_m density")
                                             for z in db.scalars(select(TrafficZone).order_by(TrafficZone.id))]}

@app.get("/api/config")
def get_config(request: Request, db=Depends(database)):
    authenticate(request, db, ["commissioner"])
    return config_json(db)

class ZoneInput(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=100)
    ward_id: int
    center_lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    center_lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    radius_m: float = Field(ge=10, le=20000, allow_inf_nan=False)
    density: float = Field(ge=0, le=1, allow_inf_nan=False)

class ConfigurationInput(BaseModel):
    capture_max_age_s: float = Field(ge=10, le=120)
    gps_max_accuracy_m: float = Field(ge=1, le=50)
    dedup_radius_m: float = Field(ge=1, le=10)
    repair_radius_m: float = Field(ge=1, le=15)
    detector_mode: str
    traffic_zones: list[ZoneInput] = Field(max_length=100)

@app.put("/api/config")
def update_config(data: ConfigurationInput, request: Request, db=Depends(database)):
    user = authenticate(request, db, ["commissioner"])
    if data.detector_mode not in ("auto", "onnx", "vision"):
        fail(422, "INVALID_MODE", "Choose auto, onnx or vision.")
    row = db.get(Settings, 1)
    values = data.model_dump(exclude={"traffic_zones"})
    if row:
        row.values = values
    else:
        db.add(Settings(id=1, values=values))
    zone_ids = set()
    for input_zone in data.traffic_zones:
        if not db.get(Ward, input_zone.ward_id) or input_zone.id in zone_ids:
            fail(422, "INVALID_ZONE", "Every traffic zone needs a valid ward and unique ID.")
        zone_ids.add(input_zone.id)
        zone = db.get(TrafficZone, input_zone.id)
        if not zone:
            zone = TrafficZone(**input_zone.model_dump())
            db.add(zone)
        else:
            for k,v in input_zone.model_dump().items():
                setattr(zone,k,v)
    # PUT is a full replacement of the submitted zone set.
    for zone in db.scalars(select(TrafficZone)):
        if zone.id not in zone_ids:
            db.delete(zone)
    db.flush()
    for ticket in db.scalars(select(Ticket).where(Ticket.status != "VERIFIED_CLOSED").with_for_update()):
        ticket.traffic_density = traffic_at(db, ticket.ward_id, ticket.lat, ticket.lng)
        ticket.priority_score = priority(ticket.severity, ticket.traffic_density)
        event(db, ticket, user, "PRIORITY_UPDATED", "Priority recomputed using the commissioner-configured traffic index.")
    db.commit()
    return config_json(db)
