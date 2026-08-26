"""
Seeds rich demo data for SwasthyaSetu - Government of Maharashtra (सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन):
- Facilities: Shirur PHC, Aundh District Hospital Pune, Junnar CHC, Pune Central Diagnostic Lab
- Users: ASHA Tai Priya Patil, PHC Doctor Ramesh Kulkarni, Specialist Dr. Anita Deshmukh, District Health Officer DHO Pune, Patients Rahul Jadhav, Lakshmi Gaikwad & Sunita Shinde
- Longitudinal Records, ABHA IDs, AI Symptom Triage in Marathi/Hindi, Live Appointments, 6-stage Referrals, Overdue High-Risk Followups
Run: python seed.py
"""
import json
from datetime import datetime, timedelta
from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.models import (
    User, Facility, MedicineStock, DiagnosticService, Patient,
    SymptomRecord, Appointment, Referral, MedicalReport, FollowUp, AuditLedger,
    RoleEnum, UrgencyEnum, StatusEnum
)

from sqlalchemy import text

# Instant clean schema recreation for Postgres / SQLite
with engine.begin() as conn:
    if "postgresql" in str(engine.url):
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"))
    else:
        Base.metadata.drop_all(bind=conn)

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# 1. Facilities (Government of Maharashtra - Pune District)
phc = Facility(
    name="Shirur Primary Health Centre (शिरूर प्राथमिक आरोग्य केंद्र)", type="PHC", district="Pune",
    village="Shirur", latitude=18.825, longitude=74.377, phone="+91 2138 222100"
)
district_hospital = Facility(
    name="Aundh District Headquarters Hospital, Pune (औंध जिल्हा रुग्णालय)", type="District Hospital",
    district="Pune", village="Aundh, Pune", latitude=18.558, longitude=73.807, phone="+91 20 2588 6666"
)
chc = Facility(
    name="Junnar Community Health Centre (जुन्नर ग्रामीण रुग्णालय / CHC)", type="CHC", district="Pune",
    village="Junnar", latitude=19.206, longitude=73.876, phone="+91 2132 222204"
)
lab = Facility(
    name="Pune District Central Diagnostic & Pathology Hub", type="Diagnostic Lab",
    district="Pune", village="Shivajinagar, Pune", latitude=18.531, longitude=73.844, phone="+91 20 2553 9900"
)
db.add_all([phc, district_hospital, chc, lab])
db.commit()
db.refresh(phc); db.refresh(district_hospital); db.refresh(chc); db.refresh(lab)

# 2. Users
users = [
    User(name="Priya Patil (ASHA Worker)", phone="9000000001", role=RoleEnum.health_worker,
         hashed_password=hash_password("password123"), facility_id=phc.id),
    User(name="Dr. Ramesh Kulkarni (PHC Medical Officer)", phone="9000000002", role=RoleEnum.doctor,
         hashed_password=hash_password("password123"), facility_id=phc.id),
    User(name="Dr. Anita Deshmukh (Cardiology Specialist)", phone="9000000003", role=RoleEnum.doctor,
         hashed_password=hash_password("password123"), facility_id=district_hospital.id),
    User(name="District Health Officer (DHO Pune)", phone="9000000004", role=RoleEnum.admin,
         hashed_password=hash_password("password123")),
    User(name="Rahul Jadhav", phone="9000000005", role=RoleEnum.patient,
         hashed_password=hash_password("password123")),
    User(name="Lakshmi Gaikwad", phone="9000000006", role=RoleEnum.patient,
         hashed_password=hash_password("password123")),
    User(name="Sunita Shinde", phone="9000000007", role=RoleEnum.patient,
         hashed_password=hash_password("password123")),
]
db.add_all(users)
db.commit()

priya = db.query(User).filter(User.phone == "9000000001").first()
dr_ramesh = db.query(User).filter(User.phone == "9000000002").first()
dr_anita = db.query(User).filter(User.phone == "9000000003").first()
rahul_u = db.query(User).filter(User.phone == "9000000005").first()
lakshmi_u = db.query(User).filter(User.phone == "9000000006").first()
sunita_u = db.query(User).filter(User.phone == "9000000007").first()

# 3. Patients with Longitudinal profiles & ABHA IDs
rahul_p = Patient(
    user_id=rahul_u.id, name="Rahul Jadhav", age=42, gender="Male",
    phone="9000000005", village="Shirur Rural",
    medical_history="Mild seasonal asthma, non-smoker",
    abha_id="91-4829-1049-8392", blood_group="O+",
    vitals_json=json.dumps({"bp_sys": 128, "bp_dia": 82, "spo2": 97, "pulse": 78, "temp": 100.4, "weight": 66}),
    emergency_contact="+91 98401 23456", high_risk_category="General",
    registered_by_id=priya.id, facility_id=phc.id
)

lakshmi_p = Patient(
    user_id=lakshmi_u.id, name="Lakshmi Gaikwad", age=65, gender="Female",
    phone="9000000006", village="Khed Village",
    medical_history="Type 2 Diabetes (12 yrs), Hypertension on Amlodipine",
    abha_id="91-7712-4439-0192", blood_group="B+",
    vitals_json=json.dumps({"bp_sys": 146, "bp_dia": 92, "spo2": 96, "pulse": 84, "temp": 98.4, "blood_sugar": 182}),
    emergency_contact="+91 94441 55667", high_risk_category="Diabetes",
    registered_by_id=priya.id, facility_id=phc.id
)

sunita_p = Patient(
    user_id=sunita_u.id, name="Sunita Shinde", age=24, gender="Female",
    phone="9000000007", village="Manchar",
    medical_history="ANC 2nd Trimester (Week 26), mild anemia Hb 9.8",
    abha_id="91-3382-9012-7741", blood_group="A+",
    vitals_json=json.dumps({"bp_sys": 118, "bp_dia": 76, "spo2": 99, "pulse": 74, "temp": 98.6, "weight": 54}),
    emergency_contact="+91 98840 99887", high_risk_category="Maternal/ANC",
    registered_by_id=priya.id, facility_id=phc.id
)

db.add_all([rahul_p, lakshmi_p, sunita_p])
db.commit()
db.refresh(rahul_p); db.refresh(lakshmi_p); db.refresh(sunita_p)

# 4. Medicine Stock (Government of Maharashtra Essential Drug List)
db.add_all([
    MedicineStock(facility_id=phc.id, medicine_name="Paracetamol 500mg", category="Analgesic", quantity=350, min_threshold=50),
    MedicineStock(facility_id=phc.id, medicine_name="Amoxicillin 500mg", category="Antibiotic", quantity=120, min_threshold=40),
    MedicineStock(facility_id=phc.id, medicine_name="ORS Sachet", category="Essential", quantity=200, min_threshold=50),
    MedicineStock(facility_id=phc.id, medicine_name="Amlodipine 5mg", category="Cardiovascular", quantity=8, min_threshold=30),  # Low Stock!
    MedicineStock(facility_id=phc.id, medicine_name="Iron & Folic Acid", category="Maternal", quantity=180, min_threshold=50),
    MedicineStock(facility_id=district_hospital.id, medicine_name="Insulin Glargine", category="Antidiabetic", quantity=85, min_threshold=20),
    MedicineStock(facility_id=district_hospital.id, medicine_name="Metoprolol 50mg", category="Cardiovascular", quantity=140, min_threshold=30),
    MedicineStock(facility_id=district_hospital.id, medicine_name="Amlodipine 5mg", category="Cardiovascular", quantity=450, min_threshold=50),
    MedicineStock(facility_id=chc.id, medicine_name="Paracetamol 500mg", category="Analgesic", quantity=180, min_threshold=40),
    MedicineStock(facility_id=chc.id, medicine_name="Azithromycin 250mg", category="Antibiotic", quantity=6, min_threshold=25), # Low Stock!
])

# 5. Diagnostic Services
db.add_all([
    DiagnosticService(facility_id=phc.id, test_name="Blood Glucose (RBS / Fasting)", category="Point-of-Care", available=True, turnaround_hours=1),
    DiagnosticService(facility_id=phc.id, test_name="Hemoglobin (Hb)", category="Point-of-Care", available=True, turnaround_hours=1),
    DiagnosticService(facility_id=phc.id, test_name="Urine Albumin/Sugar", category="Point-of-Care", available=True, turnaround_hours=1),
    DiagnosticService(facility_id=district_hospital.id, test_name="12-Lead ECG", category="Cardiology", available=True, turnaround_hours=2),
    DiagnosticService(facility_id=district_hospital.id, test_name="Chest X-Ray Digital", category="Radiology", available=True, turnaround_hours=6),
    DiagnosticService(facility_id=district_hospital.id, test_name="Ultrasound Abdomen & ANC", category="Radiology", available=True, turnaround_hours=12, requires_referral=True),
    DiagnosticService(facility_id=lab.id, test_name="HbA1c Glycated Hemoglobin", category="Pathology", available=True, turnaround_hours=4),
    DiagnosticService(facility_id=lab.id, test_name="Lipid Profile", category="Pathology", available=True, turnaround_hours=6),
    DiagnosticService(facility_id=lab.id, test_name="Sputum CBNAAT (TB)", category="Microbiology", available=True, turnaround_hours=8),
])
db.commit()

# 6. Symptom Triage & OPD Queue Tokens
symp_rahul = SymptomRecord(
    patient_id=rahul_p.id,
    raw_input="मला दोन दिवसांपासून तीव्र ताप आणि खोकला आहे, छातीत त्रास जाणवतोय (Fever and cough for 2 days with chest discomfort)",
    input_language="mr",
    translated_text="[Marathi Input Translated]: Fever and severe cough for 2 days with chest discomfort",
    structured_symptoms=json.dumps(["fever", "cough", "chest pain"]),
    duration="2 days",
    severity="severe",
    warning_signs=json.dumps(["chest pain", "breathing difficulty"]),
    confidence=0.94,
    urgency=UrgencyEnum.high,
    care_level="Urgent Doctor Consultation / District Hospital Referral",
    recommended_action="Prioritize immediate Primary Health Centre medical officer assessment",
    ai_notes="⚠️ High-priority symptom pattern: persistent fever with chest discomfort. Prioritized in Shirur PHC queue for medical officer review.",
    engine_used="Local LLM (Ollama Llama-3 + Guardrail)",
    spoken_guidance="नोंदवलेली लक्षणे: ताप, खोकला, छातीत दुखणे. AI जोखीम पातळी: उच्च प्राधान्य 🟠. शिफारस केलेली कृती: प्राथमिक आरोग्य केंद्र (PHC) डॉक्टरांकडून तातडीने तपासणी करून घ्या.",
    vitals_summary="BP: 128/82 | SpO2: 97% | Temp: 100.4°F",
    created_at=datetime.utcnow() - timedelta(hours=2)
)
db.add(symp_rahul)
db.commit()

appt_rahul = Appointment(
    patient_id=rahul_p.id, facility_id=phc.id, doctor_id=dr_ramesh.id,
    symptom_record_id=symp_rahul.id, queue_token=101,
    scheduled_time=datetime.utcnow(), status=StatusEnum.in_progress,
    is_teleconsultation=False,
    clinical_notes="Patient presents with acute productive cough and low SpO2 upon exertion. Bilateral wheezing on auscultation. Needs specialist opinion at Aundh District Hospital.",
    prescription="Tab. Paracetamol 500mg TID x 3 days\nInhaler Salbutamol 100mcg as needed"
)

appt_lakshmi = Appointment(
    patient_id=lakshmi_p.id, facility_id=phc.id, doctor_id=dr_ramesh.id,
    queue_token=102, scheduled_time=datetime.utcnow() + timedelta(minutes=30),
    status=StatusEnum.pending, is_teleconsultation=True,
    teleconsult_room="tele-1-102",
    clinical_notes="Teleconsultation review for diabetes sugar fluctuations and hypertension medication refill."
)
db.add_all([appt_rahul, appt_lakshmi])
db.commit()

# 7. 6-Stage Referral Lifecycle Pipeline
ref_rahul = Referral(
    patient_id=rahul_p.id, from_facility_id=phc.id, to_facility_id=district_hospital.id,
    department="Cardiology & Pulmonology",
    reason="Secondary evaluation for persistent bronchospasm and ruling out cardiac involvement (12-Lead ECG + Echo needed).",
    urgency=UrgencyEnum.high, status=StatusEnum.patient_arrived,
    transport_status="arrived",
    ambulance_required=True,
    specialist_notes="Specialist Dr. Anita Deshmukh reviewed patient at Aundh District Hospital. ECG normal sinus rhythm. Chest sounds clear with mild bilateral expiratory wheeze. Initiated inhaled bronchodilator therapy.",
    counter_referral_notes="Patient stabilized. Advised to continue Tab. Montelukast 10mg OD and Salbutamol inhaler. Weekly follow-up at Shirur PHC Sub-Centre.",
    created_by_id=dr_ramesh.id, created_at=datetime.utcnow() - timedelta(hours=1)
)

ref_lakshmi = Referral(
    patient_id=lakshmi_p.id, from_facility_id=phc.id, to_facility_id=lab.id,
    department="Pathology & Lab",
    reason="Routine 3-month HbA1c and Serum Creatinine checkup.",
    urgency=UrgencyEnum.medium, status=StatusEnum.completed,
    transport_status="completed",
    specialist_notes="Lab sample collected at Pune Central Diagnostic Hub. HbA1c reported at 7.8% (Borderline controlled). Serum Creatinine 0.9 mg/dL normal.",
    counter_referral_notes="Continue Tab. Metformin 500mg BD. Recheck in 3 months.",
    created_by_id=dr_ramesh.id, created_at=datetime.utcnow() - timedelta(days=5),
    completed_at=datetime.utcnow() - timedelta(days=4)
)
db.add_all([ref_rahul, ref_lakshmi])
db.commit()

# 8. Verifiable Medical Reports (with SHA-256 Hashes)
rep1 = MedicalReport(
    patient_id=rahul_p.id, uploaded_by_id=dr_anita.id, referral_id=ref_rahul.id,
    title="12-Lead Digital ECG & Pulmonary Report", report_type="Scan/Imaging",
    file_path="/reports/ecg_rahul_101.pdf",
    ai_extracted_summary=json.dumps({
        "heart_rate": 78, "rhythm": "Sinus Rhythm", "st_elevation": False,
        "fev1_fvc_ratio": "78%", "conclusion": "Mild reactive airway disease, no acute coronary syndrome."
    }),
    content_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    source="provider", is_verified=True, verified_by_id=dr_anita.id, verified_at=datetime.utcnow()
)
rep2 = MedicalReport(
    patient_id=lakshmi_p.id, uploaded_by_id=dr_ramesh.id, referral_id=ref_lakshmi.id,
    title="Comprehensive Diabetes & Lipid Panel (HbA1c)", report_type="Lab Report",
    file_path="/reports/lipid_lakshmi_102.pdf",
    ai_extracted_summary=json.dumps({
        "hba1c": "7.8%", "fasting_sugar": "142 mg/dL", "cholesterol": "195 mg/dL", "creatinine": "0.9 mg/dL"
    }),
    content_hash="8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
    source="provider", is_verified=True, verified_by_id=dr_ramesh.id, verified_at=datetime.utcnow()
)
db.add_all([rep1, rep2])
db.commit()

# 9. Follow-Up Tasks for ASHA Worker
fu1 = FollowUp(
    patient_id=rahul_p.id, reason="Check post-bronchodilator inhaler compliance and pulse oximetry at home.",
    category="Respiratory", due_date=datetime.utcnow() + timedelta(days=2),
    is_high_risk=True, completed=False
)
fu2 = FollowUp(
    patient_id=lakshmi_p.id, reason="Overdue Amlodipine refill verification and blood pressure check (BP > 140/90).",
    category="Diabetes", due_date=datetime.utcnow() - timedelta(days=3),  # OVERDUE
    is_high_risk=True, completed=False
)
fu3 = FollowUp(
    patient_id=sunita_p.id, reason="Maternal ANC 3rd Trimester Tetanus Toxoid vaccination & Ultrasound scan reminder.",
    category="Maternal/ANC", due_date=datetime.utcnow() - timedelta(days=1),  # OVERDUE
    is_high_risk=True, completed=False
)
db.add_all([fu1, fu2, fu3])
db.commit()

# 10. Audit Ledger Events
db.add_all([
    AuditLedger(record_type="patient", record_id=rahul_p.id, action="registered", actor_id=priya.id,
                data_hash="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01", prev_block_hash="0000000000000000000000000000000000000000000000000000000000000000"),
    AuditLedger(record_type="referral", record_id=ref_rahul.id, action="created", actor_id=dr_ramesh.id,
                data_hash="b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef02", prev_block_hash="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01"),
    AuditLedger(record_type="medical_report", record_id=rep1.id, action="signed", actor_id=dr_anita.id,
                data_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                prev_block_hash="b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef02"),
])
db.commit()
db.close()
print("[SUCCESS] Government of Maharashtra (Pune District) Seed complete! All facilities, users, Marathi triage, and clinical records initialized.")
