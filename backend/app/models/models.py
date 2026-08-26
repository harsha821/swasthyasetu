import enum
import hashlib
import json
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, Float
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class RoleEnum(str, enum.Enum):
    patient = "patient"
    health_worker = "health_worker"
    doctor = "doctor"
    admin = "admin"


class UrgencyEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    emergency = "emergency"


class StatusEnum(str, enum.Enum):
    pending = "pending"
    facility_assigned = "facility_assigned"
    patient_notified = "patient_notified"
    patient_arrived = "patient_arrived"
    consult_completed = "consult_completed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    facility = relationship("Facility", back_populates="staff")
    patient_profile = relationship(
        "Patient", back_populates="user", uselist=False, foreign_keys="Patient.user_id"
    )


class Facility(Base):
    __tablename__ = "facilities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # PHC, CHC, District Hospital, Diagnostic Lab
    district = Column(String, nullable=False)
    village = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    phone = Column(String, nullable=True)

    staff = relationship("User", back_populates="facility")
    medicines = relationship("MedicineStock", back_populates="facility")
    diagnostics = relationship("DiagnosticService", back_populates="facility")


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    age = Column(Integer)
    gender = Column(String)
    phone = Column(String, index=True)
    village = Column(String)
    medical_history = Column(Text, default="")
    abha_id = Column(String, nullable=True, index=True)  # ABDM / ABHA 14-digit standard ID
    blood_group = Column(String, default="B+")
    vitals_json = Column(Text, default="{}")             # BP, SpO2, Pulse, Temp, Weight, Blood Sugar
    emergency_contact = Column(String, nullable=True)
    high_risk_category = Column(String, default="General") # Maternal/ANC, Diabetes, Hypertension, TB, Elderly, Child Health, General
    registered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="patient_profile", foreign_keys=[user_id])
    symptom_records = relationship("SymptomRecord", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")
    referrals = relationship("Referral", back_populates="patient")
    reports = relationship("MedicalReport", back_populates="patient")
    follow_ups = relationship("FollowUp", back_populates="patient")


class SymptomRecord(Base):
    """Voice/text symptom intake + AI digital triage output."""
    __tablename__ = "symptom_records"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    raw_input = Column(Text)              # original voice/text transcript
    input_language = Column(String, default="en")
    translated_text = Column(Text)        # normalized English text
    structured_symptoms = Column(Text)    # JSON list of symptom tags
    duration = Column(String, default="acute") # e.g. "2 days", "acute", "1 week"
    severity = Column(String, default="moderate") # "mild", "moderate", "severe"
    warning_signs = Column(Text, default="[]") # JSON list of detected clinical red-flags
    confidence = Column(Float, default=0.95)
    urgency = Column(Enum(UrgencyEnum), default=UrgencyEnum.low)
    care_level = Column(String, default="PHC consultation") # PHC, Teleconsultation, Urgent Referral, Emergency Escalation
    recommended_action = Column(String, default="Primary Health Centre consultation")
    ai_notes = Column(Text)               # human-readable triage rationale (assistive only)
    engine_used = Column(String, default="Local LLM / Edge Guardrail")
    spoken_guidance = Column(Text, nullable=True)
    vitals_summary = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="symptom_records")


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    facility_id = Column(Integer, ForeignKey("facilities.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    symptom_record_id = Column(Integer, ForeignKey("symptom_records.id"), nullable=True)
    queue_token = Column(Integer)
    scheduled_time = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(StatusEnum), default=StatusEnum.pending)
    is_teleconsultation = Column(Boolean, default=False)
    teleconsult_room = Column(String, nullable=True)
    vitals_snapshot = Column(Text, default="{}")
    clinical_notes = Column(Text, default="")
    prescription = Column(Text, default="")
    diagnosis = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="appointments")


class Referral(Base):
    __tablename__ = "referrals"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    from_facility_id = Column(Integer, ForeignKey("facilities.id"))
    to_facility_id = Column(Integer, ForeignKey("facilities.id"))
    department = Column(String, default="General Medicine")
    reason = Column(Text)
    urgency = Column(Enum(UrgencyEnum), default=UrgencyEnum.medium)
    status = Column(Enum(StatusEnum), default=StatusEnum.pending)
    transport_status = Column(String, default="pending")  # pending, arranged, in_transit, arrived, completed
    ambulance_required = Column(Boolean, default=False)
    specialist_notes = Column(Text, default="")
    counter_referral_notes = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="referrals")
    from_facility = relationship("Facility", foreign_keys=[from_facility_id])
    to_facility = relationship("Facility", foreign_keys=[to_facility_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class MedicineStock(Base):
    __tablename__ = "medicine_stock"
    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"))
    medicine_name = Column(String)
    category = Column(String, default="Essential")  # Antibiotic, Analgesic, Cardiovascular, Antidiabetic, Maternal
    quantity = Column(Integer, default=0)
    min_threshold = Column(Integer, default=20)
    updated_at = Column(DateTime, default=datetime.utcnow)

    facility = relationship("Facility", back_populates="medicines")


class DiagnosticService(Base):
    __tablename__ = "diagnostic_services"
    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, ForeignKey("facilities.id"))
    test_name = Column(String)
    category = Column(String, default="Pathology") # Pathology, Radiology, Point-of-Care, Screening
    available = Column(Boolean, default=True)
    turnaround_hours = Column(Integer, default=24)
    requires_referral = Column(Boolean, default=False)

    facility = relationship("Facility", back_populates="diagnostics")


class MedicalReport(Base):
    __tablename__ = "medical_reports"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    referral_id = Column(Integer, ForeignKey("referrals.id"), nullable=True)
    title = Column(String)
    report_type = Column(String, default="Lab Report") # Lab Report, Prescription, Scan/Imaging, Discharge Summary, Diagnostic Test
    file_path = Column(String)
    content_hash = Column(String)   # SHA-256 of file, mirrored on the audit ledger
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    source = Column(String, default="patient") # "patient" or "provider"
    is_verified = Column(Boolean, default=False) # False for patient uploads until verified by doctor/health worker
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, default="")
    ai_extracted_summary = Column(Text, default="{}") # JSON containing extracted metrics (HbA1c, FBS, Hemoglobin, etc.)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="reports")


class FollowUp(Base):
    __tablename__ = "follow_ups"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    reason = Column(String)
    category = Column(String, default="General") # Maternal/ANC, Diabetes, Hypertension, TB, Child Health, General
    due_date = Column(DateTime)
    is_high_risk = Column(Boolean, default=False)
    completed = Column(Boolean, default=False)
    health_worker_notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="follow_ups")


class AuditLedger(Base):
    """Append-only hash+timestamp ledger — the verifiable tamper-evidence
    layer for ABDM longitudinal EHR security. Each row is chained to the previous row's hash."""
    __tablename__ = "audit_ledger"
    id = Column(Integer, primary_key=True, index=True)
    record_type = Column(String)     # e.g. "medical_report", "referral", "triage", "consent"
    record_id = Column(Integer)
    action = Column(String)          # created / updated / accessed / consent / teleconsult
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    data_hash = Column(String)       # sha256 of the record payload
    prev_block_hash = Column(String, default="")
    block_hash = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    @staticmethod
    def compute_block_hash(record_type, record_id, action, actor_id, data_hash, prev_hash, timestamp):
        payload = json.dumps({
            "record_type": record_type, "record_id": record_id, "action": action,
            "actor_id": actor_id, "data_hash": data_hash, "prev_hash": prev_hash,
            "timestamp": timestamp.isoformat(),
        }, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()

