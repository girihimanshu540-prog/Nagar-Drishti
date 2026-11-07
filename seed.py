"""Idempotent, explicitly invoked development schema setup and demonstration data.

Run: uv run python seed.py --init
Never invoked by application startup. Demo evidence is always labelled synthetic.
"""
import argparse
import os
from datetime import timedelta
from sqlalchemy import select
from api.models import Base, engine, Session, Ward, User, Ticket, Report, Repair, Event, TrafficZone, Settings, utcnow
from api.auth import hash_password
from api.config import DEFAULTS, STATUSES
from api.ai.pipeline import priority

def seed(initialize=False):
    if os.getenv("REPLIT_DEPLOYMENT") or os.getenv("NODE_ENV") == "production":
        raise RuntimeError("Demo seeding and schema initialization are development-only.")
    if initialize:
        Base.metadata.create_all(engine)
    with Session.begin() as db:
        lat = float(os.getenv("DEMO_CENTER_LAT", "18.5204"))
        lng = float(os.getenv("DEMO_CENTER_LNG", "73.8567"))
        if not db.get(Ward, 1):
            db.add(Ward(id=1, name="Shivajinagar · Ward 01", center_lat=lat, center_lng=lng))
            db.flush()
        people = [
            (1, "Aarav Deshmukh", "citizen", ""),
            (2, "Rohan Patil", "contractor", "Patil Infrastructure"),
            (3, "Ananya Joshi", "je", ""),
            (4, "Vikram Kulkarni", "commissioner", ""),
            (5, "Sameer Shah", "contractor", "Shah Roadworks"),
            (6, "Priya Mehta", "contractor", "CivicBuild Projects"),
        ]
        password_hash = hash_password("NagarDemo2026!")
        for id, name, role, company in people:
            email_role = role if id <= 4 else f"contractor{id}"
            if not db.get(User, id):
                db.add(User(id=id, name=name, email=f"{email_role}@nagardrishti.demo",
                            password_hash=password_hash, role=role, ward_id=1, company=company))
        db.flush()
        if not db.get(Settings, 1):
            db.add(Settings(id=1, values=DEFAULTS))
        for id, name, dy, dx, density in [
            (1, "University Road corridor", .010, -.012, .9),
            (2, "Shivajinagar transit hub", .003, .002, .8),
            (3, "Fergusson College Road", -.008, -.010, .65),
            (4, "Residential streets", .012, .012, .35),
        ]:
            if not db.get(TrafficZone, id):
                db.add(TrafficZone(id=id, name=name, ward_id=1, center_lat=lat+dy, center_lng=lng+dx, radius_m=1600, density=density))
        db.flush()
        streets = [
            ("Large pothole at junction", "University Road, near E-Square"),
            ("Road surface collapse", "Jangli Maharaj Road"),
            ("Deep pothole near bus stop", "Shivajinagar Bus Stand"),
            ("Multiple asphalt cracks", "Fergusson College Road"),
            ("Damaged road shoulder", "Ganeshkhind Road"),
            ("Waterlogged pothole", "Model Colony Main Road"),
            ("Broken surface at crossing", "Senapati Bapat Road"),
            ("Uneven road patch", "Apte Road"),
            ("Pothole on main carriageway", "Ghole Road"),
            ("Cracked asphalt near school", "Bhandarkar Road"),
        ]
        statuses = ["OPEN", "NEEDS_JE_REVIEW", "ASSIGNED", "VERIFIED_CLOSED", "REOPENED",
                    "OPEN", "ASSIGNED", "NEEDS_JE_REVIEW", "VERIFIED_CLOSED", "OPEN",
                    "REPAIR_SUBMITTED", "OPEN", "ASSIGNED", "VERIFIED_CLOSED", "NEEDS_JE_REVIEW",
                    "REOPENED", "OPEN", "ASSIGNED", "VERIFIED_CLOSED", "OPEN",
                    "NEEDS_JE_REVIEW", "ASSIGNED", "VERIFIED_CLOSED", "OPEN", "REPAIR_SUBMITTED"]
        now = utcnow()
        for i in range(25):
            id = f"ND-{1042+i}"
            if db.get(Ticket, id):
                continue
            title, street = streets[i % len(streets)]
            status = statuses[i]
            severity = [5, 4, 4, 2, 5, 3, 4, 3, 2, 3][i % 10]
            density = [.9, .8, .7, .5][i%4]
            y = lat + ((i*7)%19-9)*.0017
            x = lng + ((i*11)%23-11)*.0017
            created = now - timedelta(hours=20+i*4)
            contractor_id = [2,5,6][i%3] if status != "OPEN" else None
            ticket = Ticket(id=id, title=title, location=street, lat=y, lng=x, ward_id=1,
                            status=status, severity=severity, traffic_density=density, priority_score=priority(severity,density),
                            report_count=1+i%4, assigned_contractor_id=contractor_id,
                            before_image_url="/demo/road-before.jpg", detector_engine="seed-demo",
                            is_demo=True, created_at=created,
                            closed_at=created+timedelta(hours=12+i) if status=="VERIFIED_CLOSED" else None)
            db.add(ticket)
            db.flush()
            for r in range(ticket.report_count):
                db.add(Report(ticket_id=id, citizen_id=1, image_url="/demo/road-before.jpg",
                              lat=y, lng=x, gps_accuracy_m=8, captured_at=created+timedelta(minutes=r),
                              capture_source="seed_demo", detector_engine="seed-demo",
                              detection_json={"defect_present":True, "defect_type":"pothole", "severity":severity,
                                              "confidence":.94, "bbox":[.30,.40,.73,.85],
                                              "reason":"Synthetic demonstration report. No live AI assessment was performed."},
                              validation_status="DEMO"))
            def audit(kind, description, hours, actor=None):
                db.add(Event(ticket_id=id, actor_id=actor, event_type=kind,
                             payload_json={"description":description, "is_demo":True}, at=created+timedelta(hours=hours)))
            audit("REPORTED","Demo road defect reported. Synthetic evidence for product exploration.",0,1)
            if contractor_id:
                audit("ASSIGNED","Repair assigned to a demonstration contractor.",2,3)
            if status in ("VERIFIED_CLOSED","NEEDS_JE_REVIEW","REOPENED","REPAIR_SUBMITTED"):
                decision = "NEEDS_JE_REVIEW" if status=="REPAIR_SUBMITTED" else status
                db.add(Repair(ticket_id=id, contractor_id=contractor_id,
                              image_url="/demo/road-after.jpg", lat=y, lng=x, captured_at=created+timedelta(hours=8),
                              ssim_global=.84 if status=="VERIFIED_CLOSED" else .42,
                              ssim_defect_region=.28 if status=="VERIFIED_CLOSED" else .89,
                              same_location_score=.72 if status=="VERIFIED_CLOSED" else .12,
                              after_detections_json={"is_demo":True},
                              vision_verdict="repaired" if status=="VERIFIED_CLOSED" else "uncertain",
                              vision_reason="Synthetic demonstration result. These scores were seeded, not measured. " +
                              ("Example of verified evidence." if status=="VERIFIED_CLOSED" else "Example of weak same-location evidence requiring a Junior Engineer; automatic closure is blocked."),
                              decision=decision))
                audit("REPAIR_SUBMITTED","Demo contractor submitted synthetic repair evidence.",8,contractor_id)
                if status != "REPAIR_SUBMITTED":
                    audit(status, "Demonstration verification result: "+status.replace("_"," ").lower()+".",10)
        db.flush()
        # Explicit demo IDs must not collide with subsequent registered users.
        from sqlalchemy import text
        db.execute(text("SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT MAX(id) FROM users),1))"))
        db.execute(text("SELECT setval(pg_get_serial_sequence('wards','id'), GREATEST((SELECT MAX(id) FROM wards),1))"))
        db.execute(text("SELECT setval(pg_get_serial_sequence('traffic_zones','id'), GREATEST((SELECT MAX(id) FROM traffic_zones),1))"))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--init", action="store_true", help="Create missing development tables; never run against production.")
    args = parser.parse_args()
    seed(args.init)
    print("NagarDrishti demonstration data is ready (idempotent).")
