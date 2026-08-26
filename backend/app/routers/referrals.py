from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import Referral, User, Patient, Facility, StatusEnum
from app.schemas.schemas import ReferralCreate, ReferralUpdate, ReferralOut, PatientOut
from app.services.ledger import record_event

router = APIRouter(prefix="/referrals", tags=["referrals"])


def enrich_referral(ref: Referral) -> ReferralOut:
    p_out = None
    if ref.patient:
        p_out = PatientOut(
            id=ref.patient.id,
            name=ref.patient.name,
            age=ref.patient.age,
            gender=ref.patient.gender,
            phone=ref.patient.phone,
            village=ref.patient.village,
            medical_history=ref.patient.medical_history,
            abha_id=ref.patient.abha_id,
            blood_group=ref.patient.blood_group or "B+",
            vitals_json=ref.patient.vitals_json or "{}",
            emergency_contact=ref.patient.emergency_contact,
            high_risk_category=ref.patient.high_risk_category or "General",
            facility_id=ref.patient.facility_id,
            created_at=ref.patient.created_at,
        )

    from_fac_name = ref.from_facility.name if ref.from_facility else None
    to_fac_name = ref.to_facility.name if ref.to_facility else None
    created_by_name = ref.created_by.name if ref.created_by else None

    return ReferralOut(
        id=ref.id,
        patient_id=ref.patient_id,
        from_facility_id=ref.from_facility_id,
        to_facility_id=ref.to_facility_id,
        department=ref.department or "General Medicine",
        reason=ref.reason,
        urgency=ref.urgency if isinstance(ref.urgency, str) else ref.urgency.value,
        status=ref.status if isinstance(ref.status, str) else ref.status.value,
        transport_status=ref.transport_status or "pending",
        ambulance_required=ref.ambulance_required or False,
        specialist_notes=ref.specialist_notes or "",
        counter_referral_notes=ref.counter_referral_notes or "",
        created_at=ref.created_at,
        completed_at=ref.completed_at,
        patient=p_out,
        from_facility_name=from_fac_name,
        to_facility_name=to_fac_name,
        created_by_name=created_by_name,
    )


@router.post("", response_model=ReferralOut)
def create_referral(
    payload: ReferralCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("doctor", "health_worker", "admin")),
):
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    ref = Referral(
        patient_id=payload.patient_id,
        from_facility_id=payload.from_facility_id,
        to_facility_id=payload.to_facility_id,
        department=payload.department or "General Medicine",
        reason=payload.reason,
        urgency=payload.urgency or "medium",
        transport_status=payload.transport_status or ("arranged" if payload.ambulance_required else "pending"),
        ambulance_required=payload.ambulance_required or False,
        status=StatusEnum.facility_assigned,
        created_by_id=current_user.id,
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    record_event(
        db,
        "referral",
        ref.id,
        "created",
        current_user.id,
        {
            "patient_id": ref.patient_id,
            "patient_name": patient.name,
            "from_facility_id": ref.from_facility_id,
            "to_facility_id": ref.to_facility_id,
            "department": ref.department,
            "status": "facility_assigned",
            "urgency": str(ref.urgency),
            "ambulance_required": ref.ambulance_required,
        },
    )
    return enrich_referral(ref)


@router.get("", response_model=List[ReferralOut])
def get_all_referrals(
    village: Optional[str] = None,
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    facility_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Referral).options(
        joinedload(Referral.patient),
        joinedload(Referral.from_facility),
        joinedload(Referral.to_facility),
        joinedload(Referral.created_by),
    )
    if facility_id:
        q = q.filter((Referral.from_facility_id == facility_id) | (Referral.to_facility_id == facility_id))
    if status:
        q = q.filter(Referral.status == status)
    if urgency:
        q = q.filter(Referral.urgency == urgency)
    if village:
        q = q.join(Patient).filter(Patient.village == village)

    refs = q.order_by(Referral.created_at.desc()).all()
    return [enrich_referral(r) for r in refs]


@router.get("/patient/{patient_id}", response_model=List[ReferralOut])
def patient_referrals(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if current_user.role == "patient" and patient.user_id != current_user.id and patient.phone != current_user.phone:
        raise HTTPException(403, "Not authorized to view this record")

    refs = (
        db.query(Referral)
        .options(
            joinedload(Referral.patient),
            joinedload(Referral.from_facility),
            joinedload(Referral.to_facility),
            joinedload(Referral.created_by),
        )
        .filter(Referral.patient_id == patient_id)
        .order_by(Referral.created_at.desc())
        .all()
    )
    return [enrich_referral(r) for r in refs]


@router.get("/facility/{facility_id}", response_model=List[ReferralOut])
def facility_referrals(
    facility_id: int,
    direction: Optional[str] = Query("all"),  # incoming, outgoing, all
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Referral tracking: incoming (to_facility), outgoing (from_facility), or all."""
    q = db.query(Referral).options(
        joinedload(Referral.patient),
        joinedload(Referral.from_facility),
        joinedload(Referral.to_facility),
        joinedload(Referral.created_by),
    )
    if direction == "incoming":
        q = q.filter(Referral.to_facility_id == facility_id)
    elif direction == "outgoing":
        q = q.filter(Referral.from_facility_id == facility_id)
    else:
        q = q.filter((Referral.from_facility_id == facility_id) | (Referral.to_facility_id == facility_id))

    refs = q.order_by(Referral.created_at.desc()).all()
    return [enrich_referral(r) for r in refs]


@router.patch("/{referral_id}", response_model=ReferralOut)
def update_referral(
    referral_id: int,
    payload: ReferralUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("doctor", "health_worker", "admin")),
):
    ref = (
        db.query(Referral)
        .options(
            joinedload(Referral.patient),
            joinedload(Referral.from_facility),
            joinedload(Referral.to_facility),
            joinedload(Referral.created_by),
        )
        .filter(Referral.id == referral_id)
        .first()
    )
    if not ref:
        raise HTTPException(404, "Referral not found")

    if payload.status:
        ref.status = payload.status
        if payload.status == "completed":
            ref.completed_at = datetime.utcnow()
    if payload.transport_status:
        ref.transport_status = payload.transport_status
    if payload.specialist_notes:
        ref.specialist_notes = payload.specialist_notes
    if payload.counter_referral_notes:
        ref.counter_referral_notes = payload.counter_referral_notes
    if payload.department:
        ref.department = payload.department
    if payload.to_facility_id:
        ref.to_facility_id = payload.to_facility_id

    db.commit()
    db.refresh(ref)
    record_event(
        db,
        "referral",
        ref.id,
        f"status:{ref.status}",
        current_user.id,
        {
            "transport_status": ref.transport_status,
            "status": str(ref.status),
            "specialist_notes": ref.specialist_notes,
            "counter_referral_notes": ref.counter_referral_notes,
        },
    )
    return enrich_referral(ref)

