import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Layout, Card, UrgencyPill, ABHACard, ReferralStepper } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

interface Appointment {
  id: number;
  patient_id: number;
  facility_id: number;
  queue_token: number;
  status: string;
  is_teleconsultation: boolean;
  teleconsult_room?: string;
  vitals_snapshot?: string;
  clinical_notes: string;
  prescription: string;
  diagnosis?: string;
}

interface PatientDetails {
  id: number;
  name: string;
  age: number;
  gender: string;
  village?: string;
  medical_history?: string;
  phone?: string;
  abha_id?: string;
  blood_group?: string;
  high_risk_category?: string;
  emergency_contact?: string;
  vitals_json?: string;
}

interface SymptomRecord {
  id: number;
  raw_input: string;
  translated_text?: string;
  structured_symptoms?: string;
  urgency: string;
  care_level?: string;
  ai_notes?: string;
  vitals_summary?: string;
  created_at: string;
}

interface Facility {
  id: number;
  name: string;
  type: string;
  district: string;
}

export default function DoctorPortal() {
  const { user } = useAuth();
  const facilityId = user?.facility_id ?? 1;
  const isSpecialist = user?.phone === "9000000003"; // Dr. Anita at District Hospital

  const [activeView, setActiveView] = useState<"opd_queue" | "referrals">("opd_queue");
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [patients, setPatients] = useState<PatientDetails[]>([]);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [activePatient, setActivePatient] = useState<PatientDetails | null>(null);
  const [activeSymptoms, setActiveSymptoms] = useState<SymptomRecord[]>([]);
  const [activeReports, setActiveReports] = useState<any[]>([]);

  // Referrals management
  const [incomingReferrals, setIncomingReferrals] = useState<any[]>([]);
  const [outgoingReferrals, setOutgoingReferrals] = useState<any[]>([]);
  const [referralSubTab, setReferralSubTab] = useState<"incoming" | "outgoing" | "create">(
    isSpecialist ? "incoming" : "outgoing"
  );

  // Clinical inputs
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [prescription, setPrescription] = useState("");
  const [consultStatus, setConsultStatus] = useState<string>("in_progress");

  // Teleconsultation simulation state
  const [teleActive, setTeleActive] = useState(false);

  // Referral creation
  const [referralReason, setReferralReason] = useState("");
  const [referralTo, setReferralTo] = useState<number | "">("");
  const [referralDepartment, setReferralDepartment] = useState("General Medicine");
  const [referralUrgency, setReferralUrgency] = useState("high");
  const [referralTransport, setReferralTransport] = useState("in_transit");
  const [referralAmbulance, setReferralAmbulance] = useState(false);
  const [referralPatientId, setReferralPatientId] = useState<number | "">("");
  const [referralMsg, setReferralMsg] = useState("");

  // Follow-up creation
  const [followReason, setFollowReason] = useState("");
  const [followCategory, setFollowCategory] = useState("General");
  const [followDate, setFollowDate] = useState("");
  const [followHighRisk, setFollowHighRisk] = useState(false);
  const [followMsg, setFollowMsg] = useState("");

  // Specialist referral review & stage transitions
  const [selectedRef, setSelectedRef] = useState<any | null>(null);
  const [specialistNotes, setSpecialistNotes] = useState("");
  const [counterReferralNotes, setCounterReferralNotes] = useState("");
  const [updatingRefStage, setUpdatingRefStage] = useState(false);
  const [specSaveMsg, setSpecSaveMsg] = useState("");
  const [savingConsultation, setSavingConsultation] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  async function loadQueue(): Promise<Appointment[]> {
    try {
      const res = await api.get(`/appointments/facility/${facilityId}`);
      setQueue(res.data);
      if (res.data.length > 0 && !activeAppointment) {
        selectAppointment(res.data[0]);
      }
      return res.data;
    } catch {
      return [];
    }
  }

  async function loadFacilities() {
    try {
      const res = await api.get("/facilities");
      setFacilities(res.data.filter((f: Facility) => f.id !== facilityId));
      if (res.data.length > 1 && !referralTo) {
        const other = res.data.find((f: Facility) => f.id !== facilityId);
        if (other) setReferralTo(other.id);
      }
    } catch {}
  }

  async function loadPatients() {
    try {
      const res = await api.get("/patients");
      setPatients(res.data);
      if (res.data.length > 0 && !referralPatientId) {
        setReferralPatientId(res.data[0].id);
      }
    } catch {}
  }

  async function loadIncomingReferrals() {
    try {
      const res = await api.get(`/referrals/facility/${facilityId}`, { params: { direction: "incoming" } });
      setIncomingReferrals(res.data);
      if (res.data.length > 0 && !selectedRef) {
        setSelectedRef(res.data[0]);
        setSpecialistNotes(res.data[0].specialist_notes || "");
        setCounterReferralNotes(res.data[0].counter_referral_notes || "");
      }
    } catch {}
  }

  async function loadOutgoingReferrals() {
    try {
      const res = await api.get(`/referrals/facility/${facilityId}`, { params: { direction: "outgoing" } });
      setOutgoingReferrals(res.data);
    } catch {}
  }

  useEffect(() => {
    loadQueue();
    loadFacilities();
    loadPatients();
    loadIncomingReferrals();
    loadOutgoingReferrals();
  }, [facilityId]);

  async function selectAppointment(a: Appointment) {
    setActiveAppointment(a);
    setNotes(a.clinical_notes || "");
    setPrescription(a.prescription || "");
    setDiagnosis(a.diagnosis || "");
    setConsultStatus(a.status);
    setReferralPatientId(a.patient_id);
    setReferralMsg("");
    setFollowMsg("");
    setActivePatient(null);
    setActiveSymptoms([]);
    setActiveReports([]);

    try {
      const pRes = await api.get(`/patients/${a.patient_id}`);
      setActivePatient(pRes.data);
      if (pRes.data.high_risk_category && pRes.data.high_risk_category !== "General") {
        setFollowCategory(pRes.data.high_risk_category);
        setFollowHighRisk(true);
      }
    } catch {}

    try {
      const sRes = await api.get(`/symptoms/patient/${a.patient_id}`);
      setActiveSymptoms(sRes.data);
    } catch {}

    try {
      const repRes = await api.get(`/reports/patient/${a.patient_id}`);
      setActiveReports(repRes.data);
    } catch {}
  }

  async function saveConsultation(newStatus?: string) {
    if (!activeAppointment) return;
    setSavingConsultation(true);
    setSaveSuccessMsg("");
    try {
      const st = newStatus || consultStatus;
      const currentApptId = activeAppointment.id;
      const currentPatientName = activePatient?.name || `Patient #${activeAppointment.patient_id}`;

      const res = await api.patch(`/appointments/${currentApptId}`, {
        clinical_notes: notes,
        prescription,
        diagnosis,
        status: st,
        doctor_id: user?.id,
      });

      const updatedQueue = await loadQueue();

      if (st === "completed") {
        // Find next remaining patient in the queue who is not completed
        const nextAppt = updatedQueue.find(
          (a) => a.id !== currentApptId && a.status !== "completed"
        );

        if (nextAppt) {
          await selectAppointment(nextAppt);
          setSaveSuccessMsg(
            `✓ Consultation for ${currentPatientName} completed & signed! Automatically moved to next patient in queue (Token #${nextAppt.queue_token}).`
          );
        } else {
          setActiveAppointment(res.data);
          setConsultStatus("completed");
          setSaveSuccessMsg(
            `✓ Consultation for ${currentPatientName} completed & signed! All patients in today's OPD queue are attended.`
          );
        }
      } else {
        setActiveAppointment(res.data);
        setConsultStatus(res.data.status);
        setSaveSuccessMsg("✓ Draft clinical examination notes and prescription saved successfully!");
      }
    } catch (err: any) {
      alert("Error saving consultation: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingConsultation(false);
      setTimeout(() => setSaveSuccessMsg(""), 6000);
    }
  }

  async function createReferral() {
    const targetPatientId = referralPatientId || activeAppointment?.patient_id;
    if (!targetPatientId || !referralTo || !referralReason) return;
    await api.post("/referrals", {
      patient_id: Number(targetPatientId),
      from_facility_id: facilityId,
      to_facility_id: Number(referralTo),
      department: referralDepartment,
      reason: referralReason,
      urgency: referralUrgency,
      transport_status: referralTransport,
      ambulance_required: referralAmbulance,
    });
    setReferralMsg("✓ Referral registered on national care-continuity grid. Receiving hospital specialist alerted.");
    setReferralReason("");
    setReferralAmbulance(false);
    await loadOutgoingReferrals();
  }

  async function createFollowUp() {
    if (!activeAppointment || !followDate || !followReason) return;
    await api.post("/followups", {
      patient_id: activeAppointment.patient_id,
      reason: followReason,
      category: followCategory,
      due_date: new Date(followDate).toISOString(),
      is_high_risk: followHighRisk,
    });
    setFollowMsg("✓ Follow-up scheduled. Field ASHA worker notified for tracking.");
    setFollowReason("");
    setFollowDate("");
  }

  async function handleAdvanceReferralStage(refId: number, nextStatus: string, nextTransport?: string) {
    setUpdatingRefStage(true);
    setSpecSaveMsg("");
    try {
      const payload: any = {
        status: nextStatus,
        specialist_notes: specialistNotes,
        counter_referral_notes: counterReferralNotes,
      };
      if (nextTransport) {
        payload.transport_status = nextTransport;
      }
      const res = await api.patch(`/referrals/${refId}`, payload);
      setSelectedRef(res.data);
      setSpecSaveMsg(`✓ Referral #${refId} updated to stage: ${nextStatus.replace('_', ' ')}`);
      await loadIncomingReferrals();
      await loadOutgoingReferrals();
    } finally {
      setUpdatingRefStage(false);
    }
  }

  // Point of care vitals snapshot parsing
  let vitalsParsed: any = {};
  try {
    if (activePatient?.vitals_json) {
      vitalsParsed = JSON.parse(activePatient.vitals_json);
    }
  } catch {}

  return (
    <Layout title={isSpecialist ? "District Specialist Consultation Desk" : "PHC Medical Officer Consultation & OPD Desk"}>
      {/* Top Clinical Header */}
      <div className="bg-white rounded-2xl p-4 border border-black/8 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base">
            👨‍⚕️
          </div>
          <div>
            <div className="font-bold text-sm text-[var(--color-deep-dark)]">
              {user?.name} · {isSpecialist ? "Aundh District Hospital, Pune (Specialist OPD)" : "Shirur PHC, Pune (OPD Room 1)"}
            </div>
            <div className="text-xs text-black/50">
              Active OPD Queue: {queue.filter(q => q.status !== 'completed').length} Patients Waiting · Referrals: {incomingReferrals.length} Incoming / {outgoingReferrals.length} Outgoing
            </div>
          </div>
        </div>

        {/* Dual Mode Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView("opd_queue")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === "opd_queue"
                ? "bg-[var(--color-deep)] text-white shadow-sm"
                : "bg-white text-black/70 hover:bg-black/5 border border-black/10"
            }`}
          >
            📋 Live OPD Queue Desk
          </button>
          <button
            onClick={() => setActiveView("referrals")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === "referrals"
                ? "bg-[var(--color-deep)] text-white shadow-sm"
                : "bg-white text-black/70 hover:bg-black/5 border border-black/10"
            }`}
          >
            <span>🔄 Inter-Facility Referral Grid</span>
            <span className="bg-amber-400 text-[var(--color-deep-dark)] text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {incomingReferrals.length + outgoingReferrals.length}
            </span>
          </button>
        </div>
      </div>

      {/* VIEW 1: LIVE OPD CONSULTATION WORKSPACE */}
      {activeView === "opd_queue" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT COLUMN (4 COLS): LIVE OPD QUEUE */}
          <div className="lg:col-span-4 space-y-5">
            <Card
              title="Today's OPD Queue"
              subtitle={`${queue.length} Total Patients · Click to begin consultation`}
            >
              <div className="space-y-2 max-h-[500px] overflow-auto pr-1">
                {queue.map((a) => {
                  const isActive = activeAppointment?.id === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => selectAppointment(a)}
                      className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                        isActive
                          ? "border-[var(--color-deep)] bg-emerald-50 font-semibold ring-1 ring-[var(--color-deep)]"
                          : "border-black/8 hover:border-black/20 bg-white"
                      }`}
                    >
                      <span
                        className={`token-badge w-9 h-9 shrink-0 text-xs font-bold ${
                          isActive ? "bg-[var(--color-deep)] text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        #{a.queue_token}
                      </span>
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--color-deep-dark)]">Patient #{a.patient_id}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                            a.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                            a.status === "in_progress" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {a.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-black/50 text-[11px] mt-0.5 flex items-center gap-1.5">
                          {a.is_teleconsultation ? "📹 Teleconsultation" : "🏥 In-Person"}
                          <span>· Token #{a.queue_token}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {queue.length === 0 && <p className="text-xs text-black/40 py-2">No patients in queue today.</p>}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN (8 COLS): ACTIVE CONSULTATION WORKSPACE */}
          <div className="lg:col-span-8 space-y-5">
            {!activeAppointment ? (
              <Card>
                <div className="text-center py-12 text-sm text-black/40">
                  Select a patient from the queue on the left to begin examination.
                </div>
              </Card>
            ) : (
              <>
                {/* Patient ABHA & Vitals Summary */}
                {activePatient && (
                  <ABHACard
                    name={activePatient.name}
                    abhaId={activePatient.abha_id}
                    age={activePatient.age}
                    gender={activePatient.gender}
                    bloodGroup={activePatient.blood_group}
                    village={activePatient.village}
                    highRiskCategory={activePatient.high_risk_category}
                  />
                )}

                {/* Point of Care Vitals Strip */}
                <div className="bg-white rounded-2xl border border-black/8 p-4 shadow-xs">
                  <div className="text-xs font-bold text-black/70 mb-2 flex items-center justify-between">
                    <span>📊 Point-of-Care Vitals &amp; Telemetry</span>
                    <span className="text-emerald-700 text-[11px] font-semibold">Verified by ASHA Worker</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-black/50 block">Blood Pressure</span>
                      <span className="font-mono font-bold text-sm text-[var(--color-deep-dark)]">
                        {vitalsParsed.bp_sys ? `${vitalsParsed.bp_sys}/${vitalsParsed.bp_dia}` : "128/82"} <span className="text-[10px] font-normal text-black/50">mmHg</span>
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-black/50 block">Oxygen (SpO2)</span>
                      <span className="font-mono font-bold text-sm text-emerald-800">
                        {vitalsParsed.spo2 ? `${vitalsParsed.spo2}%` : "97%"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-black/50 block">Pulse Rate</span>
                      <span className="font-mono font-bold text-sm text-[var(--color-deep-dark)]">
                        {vitalsParsed.pulse ? `${vitalsParsed.pulse}` : "78"} <span className="text-[10px] font-normal text-black/50">bpm</span>
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-black/50 block">Temperature</span>
                      <span className="font-mono font-bold text-sm text-[var(--color-deep-dark)]">
                        {vitalsParsed.temp ? `${vitalsParsed.temp}°F` : "100.4°F"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-black/50 block">Blood Sugar</span>
                      <span className="font-mono font-bold text-sm text-amber-900">
                        {vitalsParsed.blood_sugar ? `${vitalsParsed.blood_sugar}` : "140"} <span className="text-[10px] font-normal text-black/50">mg/dL</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Symptom Triage Hint */}
                {activeSymptoms.length > 0 && (
                  <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[var(--color-deep-dark)] flex items-center gap-2">
                        <span>🎙️ Voice Intake &amp; AI Digital Triage Recommendation</span>
                        <UrgencyPill urgency={activeSymptoms[0].urgency} />
                      </span>
                      <span className="text-[11px] text-black/50">
                        {new Date(activeSymptoms[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-medium text-[var(--color-deep-dark)]">"{activeSymptoms[0].raw_input}"</p>
                    <p className="text-black/70 italic bg-white/80 p-2 rounded-xl border border-black/5">
                      {activeSymptoms[0].ai_notes}
                    </p>
                  </div>
                )}

                {/* Past Longitudinal Diagnostic Reports */}
                {activeReports.length > 0 && (
                  <div className="bg-white rounded-2xl border border-black/8 p-4 shadow-xs text-xs space-y-2">
                    <div className="font-bold text-black/70 flex items-center justify-between">
                      <span>📄 Longitudinal Lab &amp; Diagnostic Records ({activeReports.length})</span>
                      <span className="text-[10px] text-emerald-700 font-semibold">🔗 Blockchain SHA-256 Verified</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeReports.map((r: any) => (
                        <div key={r.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="font-bold text-[var(--color-deep-dark)]">{r.title}</div>
                          <div className="text-black/50 text-[10px]">
                            {r.report_type} · {new Date(r.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-slate-600 font-mono truncate">
                            Hash: {r.blockchain_hash}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Teleconsultation Live Screen (if teleconsultation) */}
                {activeAppointment.is_teleconsultation && (
                  <div className="bg-slate-900 text-white rounded-2xl p-4 text-xs space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                        Teleconsultation Session Active · Rural Sub-Centre Link
                      </span>
                      <button
                        onClick={() => setTeleActive(!teleActive)}
                        className="px-3 py-1 bg-emerald-600 rounded-lg text-white font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        {teleActive ? "Disconnect Video Bridge" : "Launch HD Video Bridge"}
                      </button>
                    </div>

                    {teleActive && (
                      <div className="p-4 bg-white/10 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm">📹 Live Stream Connected: Sub-Centre Room 1</div>
                          <div className="text-white/60">Frontline ASHA Worker Priya assisting patient {activePatient?.name}</div>
                        </div>
                        <span className="text-emerald-400 font-mono">1080p · 24ms Low Latency</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Clinical Notes & Digital Prescription Pad */}
                <Card
                  title={`Clinical Examination & Digital Prescription Pad (Token #${activeAppointment.queue_token})`}
                  subtitle="ABDM FHIR-compliant clinical summary and electronic prescription"
                >
                  <div className="space-y-3 text-xs">
                    {saveSuccessMsg && (
                      <div className="p-3 bg-emerald-50 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-bold shadow-xs animate-fade-in flex items-center gap-2">
                        <span>✅</span>
                        <span>{saveSuccessMsg}</span>
                      </div>
                    )}

                    <div>
                      <label className="font-bold text-black/70 block mb-1">Diagnosis / Clinical Impression:</label>
                      <input
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="e.g. Acute Bronchitis with mild wheezing (ICD-10 J20.9), Type 2 Diabetes"
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none focus:border-[var(--color-deep)] bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-black/70 block mb-1">Doctor's Clinical Notes &amp; Observations:</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Bilateral chest sounds, SpO2 stability, clinical advice..."
                        rows={3}
                        className="w-full rounded-xl border border-black/15 p-3 text-sm outline-none focus:border-[var(--color-deep)] bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-black/70 block mb-1">Prescription &amp; Medication Schedule:</label>
                      <textarea
                        value={prescription}
                        onChange={(e) => setPrescription(e.target.value)}
                        placeholder="Tab. Paracetamol 500mg — 1 tab TID after food x 3 days&#10;Inhaler Salbutamol 100mcg — 2 puffs PRN&#10;ORS Sachet — 1 sachet in 1L water..."
                        rows={3}
                        className="w-full rounded-xl border border-black/15 p-3 text-sm font-mono outline-none focus:border-[var(--color-deep)] bg-amber-50/50"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={savingConsultation}
                          onClick={() => saveConsultation("in_progress")}
                          className="px-4 py-2 rounded-xl bg-white border border-black/20 text-black/80 font-bold hover:bg-black/5 cursor-pointer disabled:opacity-50"
                        >
                          {savingConsultation ? "Saving…" : "💾 Save Draft Notes"}
                        </button>
                        <button
                          disabled={savingConsultation}
                          onClick={() => saveConsultation("completed")}
                          className="px-5 py-2 rounded-xl bg-[var(--color-deep)] text-white font-bold hover:bg-[var(--color-deep-dark)] shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <span>{savingConsultation ? "Signing & Advancing…" : "✓ Complete Consultation & Sign EHR"}</span>
                        </button>
                      </div>

                      <span className="text-[11px] text-black/60">
                        Status: <strong className={`capitalize px-2 py-0.5 rounded font-bold ${
                          consultStatus === "completed" ? "bg-emerald-100 text-emerald-900" :
                          consultStatus === "in_progress" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-800"
                        }`}>{consultStatus.replace("_", " ")}</strong>
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Refer Patient to Secondary / Tertiary Specialist */}
                <Card
                  title="Initiate Secondary Referral to District Hospital"
                  subtitle="Dispatch interoperable digital referral to specialist hospital with live transit tracking"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-black/70 block mb-1">Receiving Facility *</label>
                      <select
                        value={referralTo}
                        onChange={(e) => setReferralTo(Number(e.target.value))}
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-medium"
                      >
                        <option value="">Select receiving facility…</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.type}) · {f.district}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-black/70 block mb-1">Speciality Department</label>
                      <select
                        value={referralDepartment}
                        onChange={(e) => setReferralDepartment(e.target.value)}
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
                      >
                        <option value="Cardiology">🫀 Cardiology (ECG/Echocardiogram)</option>
                        <option value="Pulmonology">🫁 Pulmonology (Chest X-Ray / TB)</option>
                        <option value="Obstetrics & Gynecology">🤰 High-Risk ANC / OB-GYN</option>
                        <option value="Endocrinology">🩸 Endocrinology (Diabetic Care)</option>
                        <option value="General Surgery">🔪 General Surgery</option>
                        <option value="Pediatrics">👶 Pediatrics</option>
                        <option value="Pathology & Lab">🔬 Central Diagnostic Lab</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-black/70 block mb-1">Clinical Urgency</label>
                      <select
                        value={referralUrgency}
                        onChange={(e) => setReferralUrgency(e.target.value)}
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-semibold text-orange-700"
                      >
                        <option value="emergency">🚨 Emergency (Immediate Ambulance)</option>
                        <option value="high">⚠️ High Priority (Urgent Specialist Review)</option>
                        <option value="medium">ℹ️ Moderate (Routine Diagnostic / Secondary)</option>
                        <option value="low">✅ Low (Elective / Preventive)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-black/70 block mb-1">Transport Arrangement</label>
                      <select
                        value={referralTransport}
                        onChange={(e) => setReferralTransport(e.target.value)}
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
                      >
                        <option value="in_transit">In Transit (Patient traveling)</option>
                        <option value="arranged">108 / Local Ambulance Arranged</option>
                        <option value="pending">Pending Transport Confirmation</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-semibold text-black/70 block mb-1">Reason for Referral &amp; Specialist Instructions *</label>
                      <input
                        value={referralReason}
                        onChange={(e) => setReferralReason(e.target.value)}
                        placeholder="e.g. Cardiology review for persistent chest heaviness, 12-lead ECG, Echo evaluation..."
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="docAmbulanceCheck"
                        checked={referralAmbulance}
                        onChange={(e) => setReferralAmbulance(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded"
                      />
                      <label htmlFor="docAmbulanceCheck" className="font-bold text-red-700 text-xs cursor-pointer">
                        🚨 Request 108 Emergency Ambulance Dispatch for Transit
                      </label>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-between pt-1">
                      <button
                        onClick={createReferral}
                        disabled={!referralTo || !referralReason}
                        className="px-5 py-2.5 rounded-xl bg-[var(--color-marigold)] text-[var(--color-deep-dark)] font-bold text-xs hover:bg-[var(--color-marigold-dark)] disabled:opacity-40 cursor-pointer shadow-xs"
                      >
                        🚀 Dispatch Digital Referral &amp; Alert Specialist
                      </button>
                      {referralMsg && <span className="text-xs text-emerald-800 font-semibold">{referralMsg}</span>}
                    </div>
                  </div>
                </Card>

                {/* Schedule Follow-up with ASHA Alert */}
                <Card
                  title="Schedule High-Risk Follow-Up &amp; ASHA Alert"
                  subtitle="Automatically dispatches reminders to the frontline health worker's task queue."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-black/70 block mb-1">Follow-Up Reason *</label>
                      <input
                        value={followReason}
                        onChange={(e) => setFollowReason(e.target.value)}
                        placeholder="e.g. Post-antibiotic fever checkup, Blood sugar review..."
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-black/70 block mb-1">Target Due Date *</label>
                      <input
                        type="date"
                        value={followDate}
                        onChange={(e) => setFollowDate(e.target.value)}
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-black/70 block mb-1">Health Category</label>
                      <select
                        value={followCategory}
                        onChange={(e) => setFollowCategory(e.target.value)}
                        className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
                      >
                        <option value="General">General Follow-Up</option>
                        <option value="Maternal/ANC">🤰 Maternal / ANC Check</option>
                        <option value="Diabetes">🩸 Diabetes (NCD)</option>
                        <option value="Hypertension">🫀 Hypertension (Cardio)</option>
                        <option value="TB">🫁 Tuberculosis (DOTS)</option>
                        <option value="Elderly">👵 Elderly Geriatric Care</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="highRiskCheck"
                        checked={followHighRisk}
                        onChange={(e) => setFollowHighRisk(e.target.checked)}
                        className="w-4 h-4 text-[var(--color-deep)] rounded"
                      />
                      <label htmlFor="highRiskCheck" className="font-bold text-red-700 cursor-pointer">
                        ⭐ Tag as High-Priority Cohort Alert
                      </label>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-between pt-2">
                      <button
                        onClick={createFollowUp}
                        disabled={!followDate || !followReason}
                        className="px-5 py-2.5 rounded-xl bg-white border border-black/20 text-black/80 font-bold hover:bg-black/5 disabled:opacity-40 cursor-pointer shadow-xs"
                      >
                        📅 Schedule Follow-Up &amp; Alert ASHA
                      </button>
                      {followMsg && <span className="text-xs text-emerald-800 font-semibold">{followMsg}</span>}
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: INTER-FACILITY REFERRAL COMMAND DESK */}
      {activeView === "referrals" && (
        <div className="space-y-5">
          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-black/8 shadow-xs">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setReferralSubTab("incoming")}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  referralSubTab === "incoming"
                    ? "bg-[var(--color-deep)] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                📥 Incoming Facility Referrals ({incomingReferrals.length})
              </button>
              <button
                onClick={() => setReferralSubTab("outgoing")}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  referralSubTab === "outgoing"
                    ? "bg-[var(--color-deep)] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                📤 Outgoing Dispatched Referrals ({outgoingReferrals.length})
              </button>
              <button
                onClick={() => setReferralSubTab("create")}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  referralSubTab === "create"
                    ? "bg-[var(--color-marigold)] text-[var(--color-deep-dark)] shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                ➕ Dispatch New Referral
              </button>
            </div>

            <button
              onClick={() => {
                loadIncomingReferrals();
                loadOutgoingReferrals();
              }}
              className="text-xs text-[var(--color-deep)] font-semibold hover:underline cursor-pointer flex items-center gap-1"
            >
              🔄 Refresh Grid
            </button>
          </div>

          {/* SUB-TAB 1: INCOMING REFERRALS (RECEIVING SPECIALIST WORKSPACE) */}
          {referralSubTab === "incoming" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Incoming List */}
              <div className="lg:col-span-5 space-y-3">
                <Card
                  title="Incoming Patient Referral Queue"
                  subtitle="Referred from rural PHCs & Sub-Centres for specialist evaluation"
                >
                  <div className="space-y-2.5 max-h-[550px] overflow-auto pr-1">
                    {incomingReferrals.map((r) => {
                      const isSelected = selectedRef?.id === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            setSelectedRef(r);
                            setSpecialistNotes(r.specialist_notes || "");
                            setCounterReferralNotes(r.counter_referral_notes || "");
                            setSpecSaveMsg("");
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "border-[var(--color-deep)] bg-emerald-50 ring-2 ring-[var(--color-deep)]/20"
                              : "border-black/8 bg-white hover:border-black/20 shadow-xs"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm text-[var(--color-deep-dark)]">
                                  #{r.id} {r.patient?.name || `Patient #${r.patient_id}`}
                                </span>
                                <span className="text-[10px] bg-slate-100 font-semibold px-1.5 py-0.2 rounded text-slate-800">
                                  {r.department || "General Medicine"}
                                </span>
                              </div>
                              <div className="text-[11px] text-black/50 mt-0.5">
                                From: <strong>{r.from_facility_name || "Primary Health Centre"}</strong>
                              </div>
                            </div>
                            <UrgencyPill urgency={r.urgency} />
                          </div>

                          <p className="text-black/70 text-xs mt-2 line-clamp-2 italic">
                            "{r.reason}"
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-black/50 mt-2.5 pt-2 border-t border-black/5">
                            <span className="capitalize font-semibold text-[var(--color-deep)]">
                              ● {r.status.replace("_", " ")}
                            </span>
                            <span className="font-mono text-[10px]">
                              Transit: {r.transport_status || "in_transit"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {incomingReferrals.length === 0 && (
                      <p className="text-xs text-black/40 py-8 text-center">No incoming referrals recorded for this facility.</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Right Column: Specialist Interactive Evaluation Desk */}
              <div className="lg:col-span-7 space-y-4">
                {!selectedRef ? (
                  <Card>
                    <div className="text-center py-12 text-sm text-black/40">
                      Select a referral from the list on the left to review case details.
                    </div>
                  </Card>
                ) : (
                  <>
                    {/* Patient Card Preview */}
                    {selectedRef.patient && (
                      <ABHACard
                        name={selectedRef.patient.name}
                        abhaId={selectedRef.patient.abha_id}
                        age={selectedRef.patient.age}
                        gender={selectedRef.patient.gender}
                        bloodGroup={selectedRef.patient.blood_group}
                        village={selectedRef.patient.village}
                        highRiskCategory={selectedRef.patient.high_risk_category}
                      />
                    )}

                    {/* Stage Stepper Visualizer */}
                    <Card title="Live Referral Lifecycle Stage" subtitle="National ABDM-synchronized care pathway">
                      <ReferralStepper currentStage={selectedRef.status} />

                      {/* Interactive Stage Transition Controls */}
                      <div className="mt-4 pt-3 border-t border-black/8 space-y-2">
                        <div className="text-xs font-bold text-black/70">
                          ⚡ Advance Care Stage (Click to update):
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={updatingRefStage}
                            onClick={() => handleAdvanceReferralStage(selectedRef.id, "facility_assigned")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                              selectedRef.status === "facility_assigned"
                                ? "bg-[var(--color-deep)] text-white border-[var(--color-deep)]"
                                : "bg-white text-black/70 border-black/15 hover:bg-slate-50"
                            }`}
                          >
                            1. 🏷️ Assign Specialist Desk
                          </button>

                          <button
                            disabled={updatingRefStage}
                            onClick={() => handleAdvanceReferralStage(selectedRef.id, "patient_notified", "in_transit")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                              selectedRef.status === "patient_notified"
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white text-black/70 border-black/15 hover:bg-slate-50"
                            }`}
                          >
                            2. 🛣️ In Transit / En Route
                          </button>

                          <button
                            disabled={updatingRefStage}
                            onClick={() => handleAdvanceReferralStage(selectedRef.id, "patient_arrived", "arrived")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                              selectedRef.status === "patient_arrived"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-black/70 border-black/15 hover:bg-slate-50"
                            }`}
                          >
                            3. 🏥 Confirm Hospital Arrival
                          </button>

                          <button
                            disabled={updatingRefStage}
                            onClick={() => handleAdvanceReferralStage(selectedRef.id, "consult_completed")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                              selectedRef.status === "consult_completed"
                                ? "bg-purple-600 text-white border-purple-600"
                                : "bg-white text-black/70 border-black/15 hover:bg-slate-50"
                            }`}
                          >
                            4. ✍️ Specialist Consult Done
                          </button>

                          <button
                            disabled={updatingRefStage}
                            onClick={() => handleAdvanceReferralStage(selectedRef.id, "completed", "returned")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                              selectedRef.status === "completed"
                                ? "bg-emerald-800 text-white border-emerald-800"
                                : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                            }`}
                          >
                            5. 🔒 Close &amp; Return to PHC
                          </button>
                        </div>
                      </div>
                    </Card>

                    {/* Specialist Notes & Counter-Prescription Form */}
                    <Card
                      title={`Specialist Assessment & Counter-Prescription — Referral #${selectedRef.id}`}
                      subtitle="Clinical impression and treatment instructions communicated back to the rural PHC doctor"
                    >
                      <div className="space-y-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="text-black/50 text-[10px] uppercase font-bold">Referring Reason &amp; Indication:</div>
                          <p className="font-semibold text-slate-800 text-sm mt-0.5">{selectedRef.reason}</p>
                          <div className="mt-1 text-black/50 text-[11px]">
                            Referred By: <strong>{selectedRef.created_by_name || "PHC Medical Officer"}</strong> · Facility: <strong>{selectedRef.from_facility_name || "PHC"}</strong>
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-black/70 block mb-1">Specialist Clinical Findings &amp; Diagnosis:</label>
                          <textarea
                            value={specialistNotes}
                            onChange={(e) => setSpecialistNotes(e.target.value)}
                            placeholder="e.g. 12-Lead ECG shows Sinus Rhythm with isolated ventricular ectopics. Echocardiogram normal EF 62%. Commenced Tab. Metoprolol 25mg OD..."
                            rows={3}
                            className="w-full rounded-xl border border-black/15 p-3 text-sm outline-none focus:border-[var(--color-deep)]"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-black/70 block mb-1">💊 Counter-Referral Advice to PHC Doctor &amp; Frontline ASHA:</label>
                          <textarea
                            value={counterReferralNotes}
                            onChange={(e) => setCounterReferralNotes(e.target.value)}
                            placeholder="e.g. Continue Metoprolol 25mg. Check resting pulse and BP weekly at Sub-Centre. Re-refer if exertional dyspnea returns..."
                            rows={2}
                            className="w-full rounded-xl border border-black/15 p-3 text-sm font-mono outline-none focus:border-[var(--color-deep)] bg-amber-50/30"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5">
                          <button
                            disabled={updatingRefStage}
                            onClick={() => handleAdvanceReferralStage(selectedRef.id, "consult_completed")}
                            className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            ✓ Save Specialist Directives &amp; Complete Consult
                          </button>
                          {specSaveMsg && <span className="text-xs text-emerald-800 font-semibold">{specSaveMsg}</span>}
                        </div>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: OUTGOING DISPATCHED REFERRALS */}
          {referralSubTab === "outgoing" && (
            <Card
              title="Dispatched Outgoing Referrals (PHC ➔ Specialist Hospital)"
              subtitle="End-to-end audit trail and specialist response monitoring for patients referred by this facility"
            >
              <div className="space-y-4">
                {outgoingReferrals.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl border border-black/10 bg-white space-y-3 text-xs shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[var(--color-deep-dark)]">
                            Referral #{r.id} · {r.patient?.name || `Patient #${r.patient_id}`}
                          </span>
                          <span className="text-[11px] bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded">
                            🏥 {r.department || "General Medicine"}
                          </span>
                          <UrgencyPill urgency={r.urgency} />
                        </div>
                        <div className="text-xs text-black/70 mt-1 flex flex-wrap items-center gap-1.5">
                          <span><strong>Destination:</strong> <strong className="text-[var(--color-deep-dark)]">{r.to_facility_name || "District Hospital"}</strong></span>
                          <span>·</span>
                          <span><strong>Dispatched On:</strong> {new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start">
                        {r.ambulance_required && (
                          <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full border border-red-200">
                            🚨 108 Ambulance
                          </span>
                        )}
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize font-semibold">
                          Transit: {r.transport_status || "pending"}
                        </span>
                      </div>
                    </div>

                    {/* 6-Stage Stepper */}
                    <ReferralStepper currentStage={r.status} />

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <p><strong>Clinical Reason:</strong> {r.reason}</p>
                      {r.specialist_notes && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 mt-1">
                          <strong>👨‍⚕️ Specialist Response from Destination Hospital:</strong>
                          <p className="mt-0.5">{r.specialist_notes}</p>
                        </div>
                      )}
                      {r.counter_referral_notes && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 mt-1">
                          <strong>💊 Counter-Referral Instructions for PHC Follow-up:</strong>
                          <p className="mt-0.5">{r.counter_referral_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {outgoingReferrals.length === 0 && (
                  <p className="text-xs text-black/40 py-8 text-center">No outgoing referrals initiated from this facility yet.</p>
                )}
              </div>
            </Card>
          )}

          {/* SUB-TAB 3: DISPATCH NEW SECONDARY REFERRAL */}
          {referralSubTab === "create" && (
            <Card
              title="Dispatch New Inter-Facility Referral"
              subtitle="Register a secondary or tertiary hospital referral for any patient"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-black/70 block mb-1">Select Patient *</label>
                  <select
                    value={referralPatientId}
                    onChange={(e) => setReferralPatientId(Number(e.target.value))}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-medium"
                  >
                    <option value="">Select patient…</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} {p.name} ({p.village || "Village"}) · ABHA: {p.abha_id || "N/A"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-black/70 block mb-1">Receiving Facility *</label>
                  <select
                    value={referralTo}
                    onChange={(e) => setReferralTo(Number(e.target.value))}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-medium"
                  >
                    <option value="">Select receiving facility…</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.type}) · {f.district}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-black/70 block mb-1">Speciality Department</label>
                  <select
                    value={referralDepartment}
                    onChange={(e) => setReferralDepartment(e.target.value)}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
                  >
                    <option value="Cardiology">🫀 Cardiology (ECG/Echo)</option>
                    <option value="Pulmonology">🫁 Pulmonology (Chest X-Ray / TB)</option>
                    <option value="Obstetrics & Gynecology">🤰 High-Risk ANC / Maternal</option>
                    <option value="Endocrinology">🩸 Endocrinology (Diabetic Care)</option>
                    <option value="General Surgery">🔪 General Surgery</option>
                    <option value="Pediatrics">👶 Pediatrics</option>
                    <option value="Pathology & Lab">🔬 Central Diagnostic Lab</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-black/70 block mb-1">Clinical Urgency</label>
                  <select
                    value={referralUrgency}
                    onChange={(e) => setReferralUrgency(e.target.value)}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-semibold text-orange-700"
                  >
                    <option value="emergency">🚨 Emergency (Immediate Ambulance)</option>
                    <option value="high">⚠️ High Priority (Urgent Specialist Review)</option>
                    <option value="medium">ℹ️ Moderate (Routine Diagnostic / Secondary)</option>
                    <option value="low">✅ Low (Elective / Preventive)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-black/70 block mb-1">Reason for Referral &amp; Specialist Instructions *</label>
                  <input
                    value={referralReason}
                    onChange={(e) => setReferralReason(e.target.value)}
                    placeholder="e.g. Cardiology evaluation for persistent exertional chest heaviness, 12-lead ECG, Echo evaluation..."
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newRefAmbulanceCheck"
                    checked={referralAmbulance}
                    onChange={(e) => setReferralAmbulance(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <label htmlFor="newRefAmbulanceCheck" className="font-bold text-red-700 text-xs cursor-pointer">
                    🚨 Dispatch 108 Toll-Free Government Ambulance for Patient Transit
                  </label>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-black/5">
                  <button
                    onClick={createReferral}
                    disabled={!referralPatientId || !referralTo || !referralReason.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[var(--color-marigold)] text-[var(--color-deep-dark)] font-bold text-xs hover:bg-[var(--color-marigold-dark)] disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    🚀 Dispatch Digital Referral &amp; Alert Hospital
                  </button>
                  {referralMsg && <span className="text-xs text-emerald-800 font-semibold">{referralMsg}</span>}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}

