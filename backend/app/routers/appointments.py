from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import Appointment, User, SymptomRecord, Patient, StatusEnum
from app.schemas.schemas import AppointmentCreate, AppointmentUpdate, AppointmentOut
from app.services.ledger import record_event

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post("", response_model=AppointmentOut)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("health_worker", "doctor", "admin", "patient")),
):
    if current_user.role == "patient":
        patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
        if not patient or (patient.user_id != current_user.id and patient.phone != current_user.phone):
            raise HTTPException(403, "Not authorized to book an appointment for another patient")

    today_count = (
        db.query(func.count(Appointment.id))
        .filter(
            Appointment.facility_id == payload.facility_id,
            func.date(Appointment.scheduled_time) == func.date(datetime.utcnow()),
        )
        .scalar()
    )
    token = (today_count or 0) + 1

    room_id = f"tele-{payload.facility_id}-{token}" if payload.is_teleconsultation else None

    appt = Appointment(
        patient_id=payload.patient_id,
        facility_id=payload.facility_id,
        doctor_id=payload.doctor_id,
        symptom_record_id=payload.symptom_record_id,
        queue_token=token,
        is_teleconsultation=payload.is_teleconsultation,
        teleconsult_room=room_id,
        vitals_snapshot=payload.vitals_snapshot or "{}",
        status=StatusEnum.pending,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    record_event(
        db,
        "appointment",
        appt.id,
        "created",
        current_user.id,
        {"patient_id": appt.patient_id, "queue_token": token, "teleconsult": payload.is_teleconsultation},
    )
    return appt


@router.get("/facility/{facility_id}", response_model=List[AppointmentOut])
def facility_queue(
    facility_id: int,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Appointment).filter(Appointment.facility_id == facility_id)
    if status:
        q = q.filter(Appointment.status == status)
    else:
        q = q.filter(Appointment.status != "cancelled")
    return q.order_by(Appointment.queue_token.asc()).all()


@router.get("/patient/{patient_id}", response_model=List[AppointmentOut])
def patient_appointments(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if current_user.role == "patient" and patient.user_id != current_user.id and patient.phone != current_user.phone:
        raise HTTPException(403, "Not authorized to view this record")
    return (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id)
        .order_by(Appointment.scheduled_time.desc())
        .all()
    )


@router.patch("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("doctor", "health_worker", "admin")),
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    update_data = (
        payload.model_dump(exclude_unset=True)
        if hasattr(payload, "model_dump")
        else payload.dict(exclude_unset=True)
    )
    for field, value in update_data.items():
        setattr(appt, field, value)
    db.commit()
    db.refresh(appt)
    record_event(
        db,
        "appointment",
        appt.id,
        f"updated:{payload.status or 'notes'}",
        current_user.id,
        {"patient_id": appt.patient_id, "status": str(appt.status)},
    )
    return appt

