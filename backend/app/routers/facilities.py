from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import Facility, MedicineStock, DiagnosticService, User
from app.schemas.schemas import FacilityCreate, FacilityOut, MedicineStockOut, DiagnosticServiceOut

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.post("", response_model=FacilityOut)
def create_facility(
    payload: FacilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "doctor")),
):
    """Admin endpoint: Register new PHC, CHC, Sub-Centre, or Hospital."""
    facility = Facility(
        name=payload.name,
        type=payload.type,
        district=payload.district,
        village=payload.village,
        latitude=payload.latitude,
        longitude=payload.longitude,
        phone=payload.phone,
    )
    db.add(facility)
    db.commit()
    db.refresh(facility)
    return facility


@router.get("/search/medicine")
def search_medicine(
    name: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Facility service discovery: which nearby facilities stock a medicine."""
    rows = (
        db.query(MedicineStock, Facility)
        .join(Facility, Facility.id == MedicineStock.facility_id)
        .filter(MedicineStock.medicine_name.ilike(f"%{name}%"), MedicineStock.quantity > 0)
        .all()
    )
    return [
        {
            "facility": FacilityOut.model_validate(f).model_dump()
            if hasattr(FacilityOut, "model_validate")
            else FacilityOut.from_orm(f).dict(),
            "medicine_name": ms.medicine_name,
            "category": ms.category,
            "quantity": ms.quantity,
            "min_threshold": ms.min_threshold,
            "is_low_stock": ms.quantity <= ms.min_threshold,
        }
        for ms, f in rows
    ]


@router.get("/search/diagnostics")
def search_diagnostics(
    name: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Facility service discovery: diagnostic test availability across facilities."""
    rows = (
        db.query(DiagnosticService, Facility)
        .join(Facility, Facility.id == DiagnosticService.facility_id)
        .filter(DiagnosticService.test_name.ilike(f"%{name}%"))
        .all()
    )
    return [
        {
            "facility": FacilityOut.model_validate(f).model_dump()
            if hasattr(FacilityOut, "model_validate")
            else FacilityOut.from_orm(f).dict(),
            "test_name": ds.test_name,
            "category": ds.category,
            "available": ds.available,
            "turnaround_hours": ds.turnaround_hours,
            "requires_referral": ds.requires_referral,
        }
        for ds, f in rows
    ]


@router.get("", response_model=List[FacilityOut])
def list_facilities(
    district: Optional[str] = None,
    facility_type: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db),
):
    q = db.query(Facility)
    if district:
        q = q.filter(Facility.district == district)
    if facility_type:
        q = q.filter(Facility.type == facility_type)
    return q.all()


@router.get("/{facility_id}/medicines", response_model=List[MedicineStockOut])
def facility_medicines(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(MedicineStock).filter(MedicineStock.facility_id == facility_id).all()


@router.get("/{facility_id}/diagnostics", response_model=List[DiagnosticServiceOut])
def facility_diagnostics(
    facility_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(DiagnosticService).filter(DiagnosticService.facility_id == facility_id).all()

