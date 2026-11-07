"""PostgreSQL entities. Schema creation is an explicit development seed step."""
import os
from datetime import datetime, timezone
from sqlalchemy import create_engine, String, Float, Integer, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

def utcnow():
    return datetime.now(timezone.utc)

url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
url = url.replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(url, pool_pre_ping=True, pool_size=8)
Session = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class Ward(Base):
    __tablename__ = "wards"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    center_lat: Mapped[float] = mapped_column(Float)
    center_lng: Mapped[float] = mapped_column(Float)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(30))
    ward_id: Mapped[int] = mapped_column(ForeignKey("wards.id"))
    company: Mapped[str] = mapped_column(String(150), default="")

class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    ward_id: Mapped[int] = mapped_column(ForeignKey("wards.id"))
    status: Mapped[str] = mapped_column(String(30), default="OPEN", index=True)
    severity: Mapped[int] = mapped_column(Integer)
    traffic_density: Mapped[float] = mapped_column(Float)
    priority_score: Mapped[float] = mapped_column(Float, index=True)
    report_count: Mapped[int] = mapped_column(Integer, default=1)
    assigned_contractor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    before_image_url: Mapped[str] = mapped_column(String(500))
    detector_engine: Mapped[str] = mapped_column(String(60))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"), nullable=True)
    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    image_url: Mapped[str] = mapped_column(String(500))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    gps_accuracy_m: Mapped[float] = mapped_column(Float)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capture_source: Mapped[str] = mapped_column(String(30))
    detector_engine: Mapped[str] = mapped_column(String(60))
    detection_json: Mapped[dict] = mapped_column(JSON, default=dict)
    validation_status: Mapped[str] = mapped_column(String(30))
    rejection_reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)

class Repair(Base):
    __tablename__ = "repair_submissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"))
    contractor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    image_url: Mapped[str] = mapped_column(String(500))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ssim_global: Mapped[float | None] = mapped_column(Float, nullable=True)
    ssim_defect_region: Mapped[float | None] = mapped_column(Float, nullable=True)
    same_location_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    after_detections_json: Mapped[dict] = mapped_column(JSON, default=dict)
    vision_verdict: Mapped[str] = mapped_column(String(50))
    vision_reason: Mapped[str] = mapped_column(String(2000))
    decision: Mapped[str] = mapped_column(String(40))
    je_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    je_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

class Event(Base):
    __tablename__ = "ticket_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(60))
    payload_json: Mapped[dict] = mapped_column(JSON)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class TrafficZone(Base):
    __tablename__ = "traffic_zones"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    ward_id: Mapped[int] = mapped_column(ForeignKey("wards.id"))
    center_lat: Mapped[float] = mapped_column(Float)
    center_lng: Mapped[float] = mapped_column(Float)
    radius_m: Mapped[float] = mapped_column(Float)
    density: Mapped[float] = mapped_column(Float)

class Settings(Base):
    __tablename__ = "verification_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    values: Mapped[dict] = mapped_column(JSON)
