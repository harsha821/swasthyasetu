from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, get_current_user, require_roles
from app.models.models import User, RoleEnum
from app.schemas.schemas import UserCreate, UserOut, Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if payload.role not in [r.value for r in RoleEnum]:
        raise HTTPException(400, f"Invalid role. Must be one of {[r.value for r in RoleEnum]}")
    if db.query(User).filter(User.phone == payload.phone).first():
        raise HTTPException(400, "Phone number already registered")
    user = User(
        name=payload.name, phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=payload.role, facility_id=payload.facility_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # form_data.username carries the phone number
    user = db.query(User).filter(User.phone == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=List[UserOut])
def list_users(
    role: Optional[str] = Query(None),
    facility_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "doctor")),
):
    """Admin endpoint: List registered healthcare personnel, doctors, and staff."""
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if facility_id:
        q = q.filter(User.facility_id == facility_id)
    return q.all()
