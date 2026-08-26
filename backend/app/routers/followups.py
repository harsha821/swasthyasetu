from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import FollowUp, User, Patient
from app.schemas.schemas import FollowUpCreate, FollowUpUpdate, FollowUpOut
from app.services.ledger import record_event

router = APIRouter(prefix="/followups", tags=["followups"])


@router.post("", response_model=FollowUpOut)
def create_followup(
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("doctor", "health_worker", "admin")),
):
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    fu = FollowUp(**data)
    db.add(fu)
    db.commit()
    db.refresh(fu)
    record_event(
        db,
        "follow_up",
        fu.id,
        "created",
        current_user.id,
        {"patient_id": fu.patient_id, "due_date": fu.due_date.isoformat(), "is_high_risk": fu.is_high_risk},
    )
    return fu


@router.get("/overdue", response_model=List[FollowUpOut])
def overdue_followups(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("health_worker", "doctor", "admin")),
):
    """High-risk follow-up alerts (ANC, NCD, TB, Elderly)."""
    q = db.query(FollowUp).filter(FollowUp.completed.is_(False), FollowUp.due_date < datetime.utcnow())
    if category:
        q = q.filter(FollowUp.category == category)
    return q.order_by(FollowUp.is_high_risk.desc(), FollowUp.due_date.asc()).all()


@router.get("/patient/{patient_id}", response_model=List[FollowUpOut])
def patient_followups(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if current_user.role == "patient" and patient.user_id != current_user.id and patient.phone != current_user.phone:
        raise HTTPException(403, "Not authorized to view this record")
    return db.query(FollowUp).filter(FollowUp.patient_id == patient_id).order_by(FollowUp.due_date.asc()).all()


@router.patch("/{followup_id}", response_model=FollowUpOut)
def update_followup(
    followup_id: int,
    payload: FollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("health_worker", "doctor", "admin")),
):
    fu = db.query(FollowUp).filter(FollowUp.id == followup_id).first()
    if not fu:
        raise HTTPException(404, "Follow-up not found")
    if payload.completed is not None:
        fu.completed = payload.completed
    if payload.health_worker_notes is not None:
        fu.health_worker_notes = payload.health_worker_notes
    db.commit()
    db.refresh(fu)
    record_event(db, "follow_up", fu.id, "updated", current_user.id, {"patient_id": fu.patient_id, "completed": fu.completed})
    return fu


@router.patch("/{followup_id}/complete", response_model=FollowUpOut)
def complete_followup(
    followup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("health_worker", "doctor", "admin")),
):
    fu = db.query(FollowUp).filter(FollowUp.id == followup_id).first()
    if not fu:
        raise HTTPException(404, "Follow-up not found")
    fu.completed = True
    db.commit()
    db.refresh(fu)
    record_event(db, "follow_up", fu.id, "completed", current_user.id, {"patient_id": fu.patient_id})
    return fu

