import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import Patient, User
from app.schemas.schemas import PatientCreate, PatientOut, PatientUpdateVitals
from app.services.ledger import record_event

router = APIRouter(prefix="/patients", tags=["patients"])


def generate_mock_abha_id() -> str:
    """Generates standard 14-digit formatted Indian ABHA ID (e.g. 91-4829-1049-8392)."""
    p1 = random.randint(10, 99)
    p2 = random.randint(1000, 9999)
    p3 = random.randint(1000, 9999)
    p4 = random.randint(1000, 9999)
    return f"{p1}-{p2}-{p3}-{p4}"


@router.post("", response_model=PatientOut)
def register_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("health_worker", "doctor", "admin")),
):
    """ASHA / ANM / PHC registration with ABHA ID and high-risk categorization."""
    abha = payload.abha_id or generate_mock_abha_id()
    patient = Patient(
        name=payload.name,
        age=payload.age,
        gender=payload.gender,
        phone=payload.phone,
        village=payload.village,
        medical_history=payload.medical_history or "",
        abha_id=abha,
        blood_group=payload.blood_group or "B+",
        vitals_json=payload.vitals_json or "{}",
        emergency_contact=payload.emergency_contact,
        high_risk_category=payload.high_risk_category or "General",
        registered_by_id=current_user.id,
        facility_id=payload.facility_id,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    record_event(
        db,
        "patient",
        patient.id,
        "created",
        current_user.id,
        {"name": patient.name, "village": patient.village, "abha_id": patient.abha_id},
    )
    return patient


@router.get("", response_model=List[PatientOut])
def list_patients(
    facility_id: Optional[int] = None,
    high_risk: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("health_worker", "doctor", "admin")),
):
    q = db.query(Patient)
    if facility_id:
        q = q.filter(Patient.facility_id == facility_id)
    if high_risk:
        q = q.filter(Patient.high_risk_category == high_risk)
    return q.order_by(Patient.created_at.desc()).all()


@router.get("/me", response_model=PatientOut)
def get_my_patient_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the patient profile associated with the authenticated user."""
    patient = (
        db.query(Patient)
        .filter((Patient.user_id == current_user.id) | (Patient.phone == current_user.phone))
        .first()
    )
    if not patient:
        raise HTTPException(404, "Patient profile not found for this user")
    record_event(db, "patient", patient.id, "accessed", current_user.id, {})
    return patient


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if current_user.role == "patient" and patient.user_id != current_user.id and patient.phone != current_user.phone:
        raise HTTPException(403, "Not authorized to view this record")
    record_event(db, "patient", patient.id, "accessed", current_user.id, {})
    return patient


@router.patch("/{patient_id}/vitals", response_model=PatientOut)
def update_patient_vitals(
    patient_id: int,
    payload: PatientUpdateVitals,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("health_worker", "doctor", "admin")),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    patient.vitals_json = payload.vitals_json
    if payload.blood_group:
        patient.blood_group = payload.blood_group
    if payload.high_risk_category:
        patient.high_risk_category = payload.high_risk_category
    if payload.medical_history:
        patient.medical_history = payload.medical_history
    db.commit()
    db.refresh(patient)
    record_event(db, "patient", patient.id, "vitals_updated", current_user.id, {})
    return patient

