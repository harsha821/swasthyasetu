from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.models import models  # noqa: F401 - ensures models are registered
from app.routers import (
    auth, patients, symptoms, appointments, referrals, facilities, reports,
    followups, dashboard,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SwasthyaSetu AI",
    description="Integrated Rural Public Healthcare Access & Continuity Platform (SIH26133)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the deployed frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(symptoms.router)
app.include_router(appointments.router)
app.include_router(referrals.router)
app.include_router(facilities.router)
app.include_router(reports.router)
app.include_router(followups.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "SwasthyaSetu AI backend"}


@app.get("/health")
def health():
    return {"status": "healthy"}
