from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel


# ---------- Auth ----------
class UserCreate(BaseModel):
    name: str
    phone: str
    password: str
    role: str
    facility_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    role: str
    facility_id: Optional[int] = None
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Patient ----------
class PatientCreate(BaseModel):
    name: str
    age: int
    gender: str
    phone: Optional[str] = None
    village: Optional[str] = None
    medical_history: Optional[str] = ""
    abha_id: Optional[str] = None
    blood_group: Optional[str] = "B+"
    vitals_json: Optional[str] = "{}"
    emergency_contact: Optional[str] = None
    high_risk_category: Optional[str] = "General"
    facility_id: Optional[int] = None


class PatientUpdateVitals(BaseModel):
    vitals_json: str
    blood_group: Optional[str] = None
    high_risk_category: Optional[str] = None
    medical_history: Optional[str] = None


class PatientOut(BaseModel):
    id: int
    name: str
    age: int
    gender: str
    phone: Optional[str] = None
    village: Optional[str] = None
    medical_history: Optional[str] = None
    abha_id: Optional[str] = None
    blood_group: Optional[str] = "B+"
    vitals_json: Optional[str] = "{}"
    emergency_contact: Optional[str] = None
    high_risk_category: Optional[str] = "General"
    facility_id: Optional[int] = None
    created_at: datetime
    class Config:
        from_attributes = True


# ---------- Symptom / Triage ----------
class SymptomIntake(BaseModel):
    patient_id: int
    raw_input: str
    input_language: Optional[str] = "en"
    vitals_summary: Optional[str] = None


class SymptomRecordOut(BaseModel):
    id: int
    patient_id: int
    raw_input: str
    input_language: str
    translated_text: Optional[str]
    structured_symptoms: Optional[str]
    duration: Optional[str] = "acute"
    severity: Optional[str] = "moderate"
    warning_signs: Optional[str] = "[]"
    confidence: Optional[float] = 0.95
    urgency: str
    care_level: Optional[str] = "PHC consultation"
    recommended_action: Optional[str] = "Primary Health Centre consultation"
    ai_notes: Optional[str]
    engine_used: Optional[str] = "Local LLM / Edge Guardrail"
    spoken_guidance: Optional[str] = None
    vitals_summary: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


# ---------- Appointment ----------
class AppointmentCreate(BaseModel):
    patient_id: int
    facility_id: int
    doctor_id: Optional[int] = None
    symptom_record_id: Optional[int] = None
    is_teleconsultation: bool = False
    teleconsult_room: Optional[str] = None
    vitals_snapshot: Optional[str] = "{}"


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    clinical_notes: Optional[str] = None
    prescription: Optional[str] = None
    diagnosis: Optional[str] = None
    doctor_id: Optional[int] = None


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    facility_id: int
    doctor_id: Optional[int]
    queue_token: int
    scheduled_time: datetime
    status: str
    is_teleconsultation: bool
    teleconsult_room: Optional[str] = None
    vitals_snapshot: Optional[str] = "{}"
    clinical_notes: Optional[str]
    prescription: Optional[str]
    diagnosis: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


# ---------- Referral ----------
class ReferralCreate(BaseModel):
    patient_id: int
    from_facility_id: int
    to_facility_id: int
    reason: str
    urgency: Optional[str] = "medium"
    department: Optional[str] = "General Medicine"
    transport_status: Optional[str] = "pending"
    ambulance_required: Optional[bool] = False


class ReferralUpdate(BaseModel):
    status: Optional[str] = None
    transport_status: Optional[str] = None
    specialist_notes: Optional[str] = None
    counter_referral_notes: Optional[str] = None
    department: Optional[str] = None
    to_facility_id: Optional[int] = None


class ReferralOut(BaseModel):
    id: int
    patient_id: int
    from_facility_id: int
    to_facility_id: int
    department: Optional[str] = "General Medicine"
    reason: str
    urgency: str
    status: str
    transport_status: Optional[str] = "pending"
    ambulance_required: Optional[bool] = False
    specialist_notes: Optional[str] = ""
    counter_referral_notes: Optional[str] = ""
    created_at: datetime
    completed_at: Optional[datetime] = None
    patient: Optional[PatientOut] = None
    from_facility_name: Optional[str] = None
    to_facility_name: Optional[str] = None
    created_by_name: Optional[str] = None
    class Config:
        from_attributes = True


# ---------- Facility / Medicine / Diagnostics ----------
class FacilityCreate(BaseModel):
    name: str
    type: str  # "PHC", "CHC", "District Hospital", "Sub-Centre", "Diagnostic Lab"
    district: str
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None


class FacilityOut(BaseModel):
    id: int
    name: str
    type: str
    district: str
    village: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    phone: Optional[str] = None
    class Config:
        from_attributes = True


class MedicineStockOut(BaseModel):
    id: int
    facility_id: int
    medicine_name: str
    category: Optional[str] = "Essential"
    quantity: int
    min_threshold: Optional[int] = 20
    class Config:
        from_attributes = True


class DiagnosticServiceOut(BaseModel):
    id: int
    facility_id: int
    test_name: str
    category: Optional[str] = "Pathology"
    available: bool
    turnaround_hours: int
    requires_referral: Optional[bool] = False
    class Config:
        from_attributes = True


# ---------- Reports ----------
class MedicalReportOut(BaseModel):
    id: int
    patient_id: int
    referral_id: Optional[int] = None
    title: str
    report_type: Optional[str] = "Lab Report"
    file_path: str
    content_hash: str
    uploaded_by_id: Optional[int] = None
    source: Optional[str] = "patient"
    is_verified: Optional[bool] = False
    verified_by_id: Optional[int] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = ""
    ai_extracted_summary: Optional[str] = "{}"
    created_at: datetime
    class Config:
        from_attributes = True


class MedicalReportVerify(BaseModel):
    verification_notes: Optional[str] = "Verified and added to longitudinal EHR record."


# ---------- Follow-up ----------
class FollowUpCreate(BaseModel):
    patient_id: int
    reason: str
    category: Optional[str] = "General"
    due_date: datetime
    is_high_risk: bool = False
    health_worker_notes: Optional[str] = ""


class FollowUpUpdate(BaseModel):
    completed: Optional[bool] = None
    health_worker_notes: Optional[str] = None


class FollowUpOut(BaseModel):
    id: int
    patient_id: int
    reason: str
    category: Optional[str] = "General"
    due_date: datetime
    is_high_risk: bool
    completed: bool
    health_worker_notes: Optional[str] = ""
    created_at: datetime
    class Config:
        from_attributes = True


# ---------- Dashboard ----------
class PHCDashboard(BaseModel):
    facility_id: int
    total_patients: int
    pending_appointments: int
    active_referrals: int
    completed_referrals: int
    overdue_follow_ups: int
    high_risk_count: int
    avg_wait_minutes: Optional[float] = 28.5


class DistrictDashboard(BaseModel):
    district: str
    total_facilities: int
    total_patients: int
    active_referrals: int
    completed_referrals: int
    referral_completion_rate: float
    facilities_with_low_medicine_stock: int
    high_risk_breakdown: Dict[str, int]
    avg_waiting_time_minutes: float
    today_patient_count: int
    missed_followups: int

