# 🏥 SwasthyaSetu AI — Working MVP

Full-stack implementation of the platform described in the project README:
FastAPI backend + React/TypeScript frontend, covering the end-to-end core
patient journey across all four portals (Patient, Health Worker, Doctor,
Admin).

## What's implemented

- **JWT auth + RBAC** for all four roles
- **Patient registration** by health workers
- **Voice/text symptom intake** (browser Web Speech API) → **AI-assisted
  triage** (transparent rule-based urgency flagging — assistive only, never
  diagnostic; see `backend/app/services/triage.py`)
- **Appointment booking + queue tokens**
- **Doctor consultation** — clinical notes, prescriptions, referrals,
  follow-up scheduling
- **Digital referrals** with tracking across facilities
- **Facility/medicine/diagnostic discovery**
- **Medical report upload** with SHA-256 hashing
- **Tamper-evident audit ledger** — a hash-chained event log (the
  "blockchain-backed" layer from the spec, implemented as a verifiable hash
  chain rather than a standalone blockchain node) plus a live verify
  endpoint that recomputes a report's hash against the ledger
- **PHC + district dashboards** with charts
- **Follow-up / high-risk alerts**
- Demo seed data matching the README's Lakshmi walkthrough

Not wired up (flagged, not faked): WebRTC teleconsultation UI, real
IndicTrans2/Whisper integration (translation is stubbed and clearly marked
in code so it's a one-function swap), PWA/offline IndexedDB support, and
actual Supabase hosting (the backend runs on SQLite locally but reads
`DATABASE_URL`, so pointing it at a Supabase Postgres connection string is
a config change, not a rewrite).

## Run it

### Backend
```bash
cd backend
pip install -r requirements.txt --break-system-packages   # or use a venv
python seed.py          # creates demo data — safe to re-run
uvicorn app.main:app --reload --port 8000
```
Backend runs at `http://localhost:8000` (interactive docs at `/docs`).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173` and proxies `/api/*` to the
backend automatically (see `vite.config.ts`).

### Demo logins (password: `password123`)
| Role | Phone |
|---|---|
| Health Worker (Priya) | 9000000001 |
| PHC Doctor (Dr. Ramesh) | 9000000002 |
| Specialist (Dr. Anita) | 9000000003 |
| District Admin | 9000000004 |
| Patient (Lakshmi) | 9000000005 |

### Suggested demo flow (matches README §29)
1. Log in as **health worker** → register a patient → speak/type symptoms
   in Tamil/Telugu/English → see AI triage flag urgency → book appointment
   (queue token issued).
2. Log in as **doctor** → see the patient in the queue → add clinical notes
   → create a referral to the district hospital → schedule a follow-up.
3. Log in as **patient** (Lakshmi) → see appointment status, referral,
   follow-up reminders.
4. Log in as **admin** → view the PHC dashboard chart and district
   service-gap stats → paste a report ID into "Verify tamper-evidence" to
   show the hash-chain check live.

## Project structure
```
backend/
  app/
    core/        # db session, JWT auth, RBAC
    models/      # SQLAlchemy models (patients, appointments, referrals, ledger, ...)
    schemas/      # Pydantic request/response schemas
    services/     # triage.py (AI-assisted triage), ledger.py (audit chain)
    routers/      # one router per resource
    main.py
  seed.py
frontend/
  src/
    api/          # axios client + auth calls
    context/      # auth context
    components/   # shared layout, protected routes
    pages/         # one page per portal + login
```

## Notes for extending this into the full SIH submission
- Swap `translate_stub` / `run_triage` in `triage.py` for real
  Whisper + IndicTrans2 + an LLM call — the input/output contract is
  already the integration point.
- Add a WebRTC room for teleconsultation appointments
  (`is_teleconsultation` is already tracked on `Appointment`).
- Add a service worker + IndexedDB queue for offline symptom
  intake/appointment sync.
- Point `DATABASE_URL` at Supabase Postgres and turn on RLS policies
  matching the RBAC roles already enforced at the API layer.
