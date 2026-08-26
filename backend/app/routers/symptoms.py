from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import SymptomRecord, Patient, User, UrgencyEnum
from app.schemas.schemas import SymptomIntake, SymptomRecordOut
from app.services.triage import run_triage, symptoms_to_json
from app.services.ledger import record_event

router = APIRouter(prefix="/symptoms", tags=["triage"])


@router.post("", response_model=SymptomRecordOut)
def submit_symptoms(
    payload: SymptomIntake,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Voice/text symptom intake -> AI-assisted triage (structuring + urgency
    hint only). Always ends with a human PHC worker/doctor decision."""
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if current_user.role == "patient" and patient.user_id != current_user.id and patient.phone != current_user.phone:
        raise HTTPException(403, "Not authorized to submit symptoms for another patient")

    triage_res = run_triage(payload.raw_input, payload.input_language or "en")
    urgency_str = triage_res["urgency"]

    try:
        urgency_val = UrgencyEnum(urgency_str)
    except ValueError:
        urgency_val = UrgencyEnum.low

    record = SymptomRecord(
        patient_id=patient.id,
        raw_input=payload.raw_input,
        input_language=payload.input_language or "en",
        translated_text=triage_res["translated_text"],
        structured_symptoms=symptoms_to_json(triage_res["structured_symptoms"]),
        duration=triage_res.get("duration", "acute"),
        severity=triage_res.get("severity", "moderate"),
        warning_signs=symptoms_to_json(triage_res.get("warning_signs", [])),
        confidence=triage_res.get("confidence", 0.95),
        urgency=urgency_val,
        care_level=triage_res["care_level"],
        recommended_action=triage_res.get("recommended_action", "Primary Health Centre consultation"),
        ai_notes=triage_res["ai_notes"],
        engine_used=triage_res["engine_used"],
        spoken_guidance=triage_res["spoken_guidance"],
        vitals_summary=payload.vitals_summary,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    record_event(
        db,
        "symptom_record",
        record.id,
        "created",
        current_user.id,
        {
            "patient_id": patient.id,
            "urgency": str(urgency_val.value),
            "care_level": triage_res["care_level"],
            "engine_used": triage_res["engine_used"],
            "recommended_action": triage_res["recommended_action"],
        },
    )
    return record


@router.get("/patient/{patient_id}", response_model=List[SymptomRecordOut])
def get_patient_symptoms(
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
        db.query(SymptomRecord)
        .filter(SymptomRecord.patient_id == patient_id)
        .order_by(SymptomRecord.created_at.desc())
        .all()
    )

