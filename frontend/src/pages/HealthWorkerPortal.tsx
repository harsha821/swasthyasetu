import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Layout, Card, UrgencyPill, ABHACard, ReferralStepper } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  village: string | null;
  phone?: string;
  abha_id?: string;
  blood_group?: string;
  high_risk_category?: string;
  medical_history?: string;
  vitals_json?: string;
}

interface SymptomRecord {
  id: number;
  patient_id: number;
  translated_text: string;
  urgency: string;
  care_level?: string;
  ai_notes: string;
  structured_symptoms: string;
  duration?: string;
  severity?: string;
  warning_signs?: string;
  confidence?: number;
  recommended_action?: string;
  engine_used?: string;
  spoken_guidance?: string;
}

interface Facility {
  id: number;
  name: string;
  type: string;
  district: string;
}

const SpeechRecognitionCtor =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function HealthWorkerPortal() {
  const { user } = useAuth();
  const facilityId = user?.facility_id ?? 1;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [tab, setTab] = useState<"register" | "triage" | "teleconsult" | "followup" | "referrals" | "inventory">("triage");

  // Registration form
  const [regForm, setRegForm] = useState({
    name: "",
    age: "",
    gender: "Female",
    phone: "",
    village: "Shirur",
    blood_group: "B+",
    medical_history: "",
    high_risk_category: "General",
    emergency_contact: "",
  });
  const [regMsg, setRegMsg] = useState("");

  // Assisted Voice Triage + Vitals Intake
  const [language, setLanguage] = useState("mr");
  const [rawInput, setRawInput] = useState("");
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [vitals, setVitals] = useState({
    bp_sys: "120",
    bp_dia: "80",
    spo2: "98",
    pulse: "76",
    temp: "98.6",
    blood_sugar: "110",
  });
  const [lastTriage, setLastTriage] = useState<SymptomRecord | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookedToken, setBookedToken] = useState<number | null>(null);

  // High-Risk Follow-Up engine
  const [overdueFollowUps, setOverdueFollowUps] = useState<any[]>([]);
  const [visitNotes, setVisitNotes] = useState<Record<number, string>>({});
  const [completingFuId, setCompletingFuId] = useState<number | null>(null);

  // Referral Transit tracking & Creation
  const [facilityReferrals, setFacilityReferrals] = useState<any[]>([]);
  const [updatingRefId, setUpdatingRefId] = useState<number | null>(null);
  const [refPatientId, setRefPatientId] = useState<number | "">("");
  const [refToFacilityId, setRefToFacilityId] = useState<number | "">("");
  const [refDepartment, setRefDepartment] = useState("General Medicine");
  const [refUrgency, setRefUrgency] = useState("high");
  const [refReason, setRefReason] = useState("");
  const [refAmbulance, setRefAmbulance] = useState(false);
  const [refMsg, setRefMsg] = useState("");
  const [creatingRef, setCreatingRef] = useState(false);

  // Teleconsultation Bridge state
  const [teleCallActive, setTeleCallActive] = useState(false);
  const [teleMuted, setTeleMuted] = useState(false);

  // Inventory search
  const [medQuery, setMedQuery] = useState("");
  const [medResults, setMedResults] = useState<any[]>([]);

  // Offline cache status simulation
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  async function loadPatients() {
    try {
      const res = await api.get("/patients", { params: { facility_id: facilityId } });
      setPatients(res.data);
      if (res.data.length > 0 && !selectedPatientId) {
        setSelectedPatientId(res.data[0].id);
        setRefPatientId(res.data[0].id);
      }
    } catch {}
  }

  async function loadFacilities() {
    try {
      const res = await api.get("/facilities");
      setFacilities(res.data);
      const other = res.data.find((f: Facility) => f.id !== facilityId);
      if (other) setRefToFacilityId(other.id);
    } catch {}
  }

  async function loadFollowUps() {
    try {
      const res = await api.get("/followups/overdue");
      setOverdueFollowUps(res.data);
    } catch {}
  }

  async function loadReferrals() {
    try {
      const res = await api.get("/referrals");
      setFacilityReferrals(res.data);
    } catch {}
  }

  useEffect(() => {
    loadPatients();
    loadFacilities();
    loadFollowUps();
    loadReferrals();
  }, [facilityId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegMsg("");
    try {
      const vitalsJson = JSON.stringify({
        bp_sys: Number(vitals.bp_sys),
        bp_dia: Number(vitals.bp_dia),
        spo2: Number(vitals.spo2),
        pulse: Number(vitals.pulse),
        temp: Number(vitals.temp),
      });

      const res = await api.post("/patients", {
        name: regForm.name,
        age: Number(regForm.age),
        gender: regForm.gender,
        phone: regForm.phone,
        village: regForm.village,
        blood_group: regForm.blood_group,
        medical_history: regForm.medical_history,
        high_risk_category: regForm.high_risk_category,
        emergency_contact: regForm.emergency_contact,
        vitals_json: vitalsJson,
        facility_id: facilityId,
      });

      setRegMsg(`✓ Patient #${res.data.id} (${res.data.name}) registered with ABHA ID: ${res.data.abha_id}`);
      setRegForm({
        name: "",
        age: "",
        gender: "Female",
        phone: "",
        village: "Thirukazhukundram",
        blood_group: "B+",
        medical_history: "",
        high_risk_category: "General",
        emergency_contact: "",
      });
      await loadPatients();
      setSelectedPatientId(res.data.id);
      setTab("triage");
    } catch {
      setRegMsg("Could not register patient. Check fields.");
    }
  }

  function startVoice() {
    if (!SpeechRecognitionCtor) {
      alert("Voice input is not supported in this browser. Please type symptoms instead.");
      return;
    }
    try {
      const recog = new SpeechRecognitionCtor();
      recog.lang = language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : language === "ta" ? "ta-IN" : language === "te" ? "te-IN" : "en-IN";
      recog.onstart = () => setListening(true);
      recog.onend = () => setListening(false);
      recog.onerror = () => setListening(false);
      recog.onresult = (e: any) => {
        setRawInput(e.results[0][0].transcript);
      };
      recog.start();
    } catch {
      setListening(false);
    }
  }

  function speakTriage(customText?: string) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const textToSpeak = customText || lastTriage?.spoken_guidance || lastTriage?.ai_notes || "Triage complete.";
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const targetLangCode = language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : language === "ta" ? "ta-IN" : language === "te" ? "te-IN" : "en-IN";
      utterance.lang = targetLangCode;
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find((v) =>
        v.lang.toLowerCase().replace("_", "-").startsWith(targetLangCode.toLowerCase().slice(0, 2))
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  async function submitAssistedTriage() {
    if (!selectedPatientId || !rawInput.trim()) return;
    setTriaging(true);
    try {
      const vitalsSummary = `BP: ${vitals.bp_sys}/${vitals.bp_dia} | SpO2: ${vitals.spo2}% | Pulse: ${vitals.pulse} bpm | Temp: ${vitals.temp}°F | Sugar: ${vitals.blood_sugar} mg/dL`;
      const res = await api.post("/symptoms", {
        patient_id: selectedPatientId,
        raw_input: rawInput,
        input_language: language,
        vitals_summary: vitalsSummary,
      });
      setLastTriage(res.data);
      setBookedToken(null);

      // Auto-speak triage advice if enabled
      if (autoSpeak && res.data.spoken_guidance) {
        speakTriage(res.data.spoken_guidance);
      }
    } finally {
      setTriaging(false);
    }
  }

  async function bookQueueAppointment(isTeleconsult: boolean = false) {
    if (!selectedPatientId) return;
    setBooking(true);
    try {
      const vitalsSnapshot = JSON.stringify(vitals);
      const res = await api.post("/appointments", {
        patient_id: selectedPatientId,
        facility_id: facilityId,
        symptom_record_id: lastTriage?.id,
        is_teleconsultation: isTeleconsult,
        vitals_snapshot: vitalsSnapshot,
      });
      setBookedToken(res.data.queue_token);
    } finally {
      setBooking(false);
    }
  }

  async function handleMarkHomeVisitCompleted(fuId: number) {
    setCompletingFuId(fuId);
    try {
      const notes = visitNotes[fuId] || "Home visit completed by ASHA worker. Patient stable and counseled.";
      await api.patch(`/followups/${fuId}`, {
        completed: true,
        health_worker_notes: notes,
      });
      await loadFollowUps();
    } finally {
      setCompletingFuId(null);
    }
  }

  async function handleCreateCommunityReferral(e: React.FormEvent) {
    e.preventDefault();
    if (!refPatientId || !refToFacilityId || !refReason.trim()) return;
    setCreatingRef(true);
    setRefMsg("");
    try {
      await api.post("/referrals", {
        patient_id: Number(refPatientId),
        from_facility_id: facilityId,
        to_facility_id: Number(refToFacilityId),
        department: refDepartment,
        urgency: refUrgency,
        reason: refReason,
        ambulance_required: refAmbulance,
        transport_status: refAmbulance ? "arranged" : "pending",
      });
      setRefMsg("✓ Referral successfully registered on care-continuity grid! Receiving facility alerted.");
      setRefReason("");
      setRefAmbulance(false);
      await loadReferrals();
    } catch {
      setRefMsg("Could not initiate referral. Please verify fields.");
    } finally {
      setCreatingRef(false);
    }
  }

  async function handleUpdateReferralTransit(refId: number, nextStatus: string, nextTransit: string) {
    setUpdatingRefId(refId);
    try {
      await api.patch(`/referrals/${refId}`, {
        status: nextStatus,
        transport_status: nextTransit,
      });
      await loadReferrals();
    } finally {
      setUpdatingRefId(null);
    }
  }

  async function searchMedicine() {
    if (!medQuery.trim()) return;
    const res = await api.get("/facilities/search/medicine", { params: { name: medQuery } });
    setMedResults(res.data);
  }

  return (
    <Layout title="Frontline Health Worker Toolkit (ASHA / ANM)">
      {/* Top Frontline Status Bar */}
      <div className="bg-white rounded-2xl p-4 border border-black/8 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base">
            🩺
          </div>
          <div>
            <div className="font-bold text-sm text-[var(--color-deep-dark)]">
              Frontline Worker: Priya (ASHA Worker) · Thirukazhukundram PHC Sub-Centre
            </div>
            <div className="text-xs text-black/50">
              Assigned Population: 1,420 · Active High-Risk Cohort: 8 Patients
            </div>
          </div>
        </div>

        {/* Offline Cache & Sync status indicator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOfflineQueueCount((c) => (c > 0 ? 0 : 2))}
            className="text-xs bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-slate-700 font-medium hover:bg-slate-100 cursor-pointer"
            title="Simulate storing and syncing data locally"
          >
            {offlineQueueCount > 0
              ? `💾 ${offlineQueueCount} Field Records in Local Cache (Syncing…)`
              : "✓ All Field Records Synced with Cloud"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-black/10 pb-3">
        {[
          { id: "triage", label: "🎙️ Assisted Voice Triage & Vitals" },
          { id: "teleconsult", label: "📹 Assisted Teleconsultation Bridge" },
          { id: "followup", label: `🔔 High-Risk Cohort Engine (${overdueFollowUps.length} Overdue)` },
          { id: "referrals", label: "🔄 Referral Transit Tracking" },
          { id: "register", label: "➕ Register Patient & Generate ABHA" },
          { id: "inventory", label: "💊 Check Medicine Stock" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === t.id
                ? "bg-[var(--color-deep)] text-white shadow-sm"
                : "bg-white text-black/70 hover:bg-black/5 border border-black/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT 2 COLS: ACTIVE WORKSPACE */}
        <div className="lg:col-span-2 space-y-5">
          {/* TAB 1: ASSISTED DIGITAL TRIAGE & VITALS INTAKE */}
          {tab === "triage" && (
            <Card
              title="Assisted Voice Symptom Intake + Vital Signs Triage"
              subtitle="Record patient symptoms in local language and input basic point-of-care vitals for AI risk classification."
            >
              <div className="space-y-4">
                {/* Select Patient */}
                <div>
                  <label className="text-xs font-semibold text-black/70">Selected Patient:</label>
                  <select
                    value={selectedPatientId ?? ""}
                    onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-medium outline-none"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} {p.name} ({p.age}y, {p.gender}) · Village: {p.village || "—"} · ABHA: {p.abha_id || "None"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Point-of-Care Vitals Grid */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>📊 Point-of-Care Vitals Entry</span>
                    <span className="text-[11px] font-normal text-slate-500">Sub-Centre Diagnostic Kit</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div>
                      <label className="text-[10px] text-black/60 font-semibold block">BP Systolic</label>
                      <input
                        value={vitals.bp_sys}
                        onChange={(e) => setVitals({ ...vitals, bp_sys: e.target.value })}
                        className="w-full bg-white border border-black/15 rounded-lg px-2 py-1 text-xs font-mono text-center"
                        placeholder="120"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-black/60 font-semibold block">BP Diastolic</label>
                      <input
                        value={vitals.bp_dia}
                        onChange={(e) => setVitals({ ...vitals, bp_dia: e.target.value })}
                        className="w-full bg-white border border-black/15 rounded-lg px-2 py-1 text-xs font-mono text-center"
                        placeholder="80"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-black/60 font-semibold block">SpO2 (%)</label>
                      <input
                        value={vitals.spo2}
                        onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                        className="w-full bg-white border border-black/15 rounded-lg px-2 py-1 text-xs font-mono text-center"
                        placeholder="98"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-black/60 font-semibold block">Pulse (bpm)</label>
                      <input
                        value={vitals.pulse}
                        onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                        className="w-full bg-white border border-black/15 rounded-lg px-2 py-1 text-xs font-mono text-center"
                        placeholder="76"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-black/60 font-semibold block">Temp (°F)</label>
                      <input
                        value={vitals.temp}
                        onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                        className="w-full bg-white border border-black/15 rounded-lg px-2 py-1 text-xs font-mono text-center"
                        placeholder="98.6"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-black/60 font-semibold block">Blood Sugar</label>
                      <input
                        value={vitals.blood_sugar}
                        onChange={(e) => setVitals({ ...vitals, blood_sugar: e.target.value })}
                        className="w-full bg-white border border-black/15 rounded-lg px-2 py-1 text-xs font-mono text-center"
                        placeholder="110"
                      />
                    </div>
                  </div>
                </div>

                {/* Voice Input & TTS Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="rounded-xl border border-black/15 px-3 py-1.5 text-xs bg-white font-semibold text-[var(--color-deep-dark)]"
                    >
                      <option value="mr">मराठी (Marathi)</option>
                      <option value="hi">हिन्दी (Hindi)</option>
                      <option value="en">English</option>
                      <option value="ta">தமிழ் (Tamil)</option>
                      <option value="te">తెలుగు (Telugu)</option>
                    </select>

                    <button
                      onClick={startVoice}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                        listening
                          ? "bg-red-600 text-white border-red-700 animate-pulse"
                          : "bg-white text-[var(--color-deep-dark)] border-black/15 hover:border-[var(--color-deep)]"
                      }`}
                    >
                      <span>🎤</span>
                      <span>{listening ? "Listening to Patient (Speak now)…" : "Voice-to-Text Intake"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoSpeakCheck"
                      checked={autoSpeak}
                      onChange={(e) => setAutoSpeak(e.target.checked)}
                      className="w-4 h-4 text-[var(--color-deep)] rounded"
                    />
                    <label htmlFor="autoSpeakCheck" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1">
                      <span>🔊 Auto-Speak Triage Advice Aloud</span>
                    </label>
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Patient symptom complaints (spoken or typed in Marathi, Hindi, English, etc.)..."
                  rows={3}
                  className="w-full rounded-xl border border-black/15 p-3 text-sm outline-none focus:border-[var(--color-deep)] focus:ring-2 focus:ring-[var(--color-deep)]/20 bg-white"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    disabled={!selectedPatientId || !rawInput.trim() || triaging}
                    onClick={submitAssistedTriage}
                    className="px-5 py-2.5 rounded-xl bg-[var(--color-deep)] text-white text-xs font-bold hover:bg-[var(--color-deep-dark)] disabled:opacity-40 shadow-sm cursor-pointer flex items-center gap-2"
                  >
                    <span>🧠</span>
                    <span>{triaging ? "Running Local LLM Triage…" : "Run Local LLM Digital Triage"}</span>
                  </button>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage("ta");
                        setRawInput("நோயாளிக்கு கடுமையான மார்பு வலி மற்றும் மூச்சுத்திணறல் உள்ளது (Severe chest pain and breathless)");
                      }}
                      className="text-[11px] text-[var(--color-deep)] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                    >
                      Sample: 🚨 Tamil Emergency Case
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage("hi");
                        setRawInput("मरीज को 3 दिन से तेज बुखार, खांसी और चक्कर आ रहे हैं (High fever 3 days with cough)");
                      }}
                      className="text-[11px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 hover:bg-amber-100 cursor-pointer"
                    >
                      Sample: ⚠️ Hindi High Priority Case
                    </button>
                  </div>
                </div>

                {/* Triage Results Card */}
                {lastTriage && (
                  <div className="p-4 rounded-2xl border border-emerald-200 bg-white space-y-4 mt-4 shadow-sm">
                    {/* 1. Risk Level Banner & Engine Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800">Triage Risk Assessment:</span>
                        <UrgencyPill urgency={lastTriage.urgency} />
                        <span className="text-[11px] bg-white border border-slate-300 text-slate-700 font-mono font-semibold px-2 py-0.5 rounded-full">
                          Confidence: {Math.round((lastTriage.confidence || 0.95) * 100)}%
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🧠</span>
                        <span>{lastTriage.engine_used || "Local LLM + Safety Rule Layer"}</span>
                      </span>
                    </div>

                    {/* 2. Structured Extraction Grid (Symptoms, Duration, Severity, Warning Signs) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Reported Symptoms</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(() => {
                            try {
                              const s = JSON.parse(lastTriage.structured_symptoms || "[]");
                              return s.length > 0 ? (
                                s.map((sym: string, i: number) => (
                                  <span key={i} className="bg-emerald-100/70 text-emerald-900 font-bold text-[10px] px-1.5 py-0.2 rounded">
                                    {sym}
                                  </span>
                                ))
                              ) : (
                                <span className="font-semibold text-slate-700">General symptoms</span>
                              );
                            } catch {
                              return <span className="font-semibold text-slate-700">General symptoms</span>;
                            }
                          })()}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Duration</span>
                        <span className="font-bold text-[var(--color-deep-dark)] block mt-1">
                          ⏱️ {lastTriage.duration || "acute (< 48 hrs)"}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Severity</span>
                        <span className={`font-bold capitalize block mt-1 ${
                          lastTriage.severity === "severe" ? "text-red-700" :
                          lastTriage.severity === "moderate" ? "text-amber-700" : "text-emerald-700"
                        }`}>
                          ● {lastTriage.severity || "moderate"}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">Warning Signs</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(() => {
                            try {
                              const w = JSON.parse(lastTriage.warning_signs || "[]");
                              return w.length > 0 ? (
                                w.map((sign: string, i: number) => (
                                  <span key={i} className="bg-red-100 text-red-800 font-bold text-[10px] px-1.5 py-0.2 rounded">
                                    ⚠️ {sign}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-emerald-800 font-medium">None detected</span>
                              );
                            } catch {
                              return <span className="text-[11px] text-emerald-800 font-medium">None detected</span>;
                            }
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* 3. Clinical Reason & Recommended Next Step */}
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                        <strong className="text-amber-950">Clinical Triage Reason:</strong>
                        <p className="text-amber-900 mt-0.5">{lastTriage.ai_notes}</p>
                      </div>

                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="text-emerald-950 block">Recommended Action:</strong>
                          <span className="text-emerald-900 font-bold text-sm mt-0.5 block">
                            👉 {lastTriage.recommended_action || lastTriage.care_level || "PHC Doctor Consultation"}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-800 font-semibold bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                          ✓ PHC Alert Queued
                        </div>
                      </div>
                    </div>

                    {/* Non-Diagnostic Medical Disclaimer */}
                    <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-600 border border-slate-200 text-center font-medium">
                      ℹ️ <strong>Disclaimer:</strong> This is a preliminary clinical triage assessment based on reported symptoms, not a definitive medical diagnosis. Final examination is conducted by licensed healthcare officers.
                    </div>

                    {/* 6. Action Booking Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-black/8">
                      <button
                        onClick={() => bookQueueAppointment(false)}
                        disabled={booking}
                        className="px-4 py-2 rounded-xl bg-[var(--color-marigold)] text-[var(--color-deep-dark)] text-xs font-bold hover:bg-[var(--color-marigold-dark)] disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {booking ? "Issuing Token…" : "🏥 Book PHC OPD Token"}
                      </button>
                      <button
                        onClick={() => bookQueueAppointment(true)}
                        disabled={booking}
                        className="px-4 py-2 rounded-xl bg-[var(--color-deep)] text-white text-xs font-bold hover:bg-[var(--color-deep-dark)] disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {booking ? "Connecting…" : "📹 Request Assisted Teleconsultation"}
                      </button>
                    </div>

                    {bookedToken && (
                      <div className="mt-3 p-3 bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-3">
                        <span className="token-badge w-8 h-8 bg-white text-[var(--color-deep-dark)] font-bold text-sm">
                          #{bookedToken}
                        </span>
                        <span>Token #{bookedToken} generated successfully! Patient queued for PHC doctor examination.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* TAB 2: ASSISTED TELECONSULTATION BRIDGE */}
          {tab === "teleconsult" && (
            <Card
              title="Assisted Teleconsultation Bridge (Sub-Centre ➔ Specialist)"
              subtitle="Connect the patient with PHC Medical Officer Dr. Ramesh or District Specialist Dr. Anita with live vitals telemetry."
            >
              <div className="space-y-4">
                <div className="bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden flex flex-col items-center justify-center min-h-[220px] shadow-inner">
                  {teleCallActive ? (
                    <div className="w-full text-center space-y-3">
                      <div className="inline-flex items-center gap-2 bg-red-600/80 text-white text-xs px-3 py-1 rounded-full animate-pulse font-semibold">
                        <span>🔴 Live Teleconsultation in Progress</span>
                        <span>· Dr. Anita (Cardiology Specialist, District Hospital)</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/10 p-3 rounded-xl backdrop-blur max-w-lg mx-auto text-left">
                        <div><span className="text-white/60 text-[10px]">Patient:</span> <div className="font-bold">{selectedPatient?.name || "Ravi Kumar"}</div></div>
                        <div><span className="text-white/60 text-[10px]">BP Telemetry:</span> <div className="font-mono text-emerald-300 font-bold">{vitals.bp_sys}/{vitals.bp_dia} mmHg</div></div>
                        <div><span className="text-white/60 text-[10px]">SpO2 Monitor:</span> <div className="font-mono text-emerald-300 font-bold">{vitals.spo2}%</div></div>
                        <div><span className="text-white/60 text-[10px]">Pulse:</span> <div className="font-mono text-emerald-300 font-bold">{vitals.pulse} bpm</div></div>
                      </div>

                      <div className="flex justify-center gap-3 pt-2">
                        <button
                          onClick={() => setTeleMuted(!teleMuted)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                            teleMuted ? "bg-amber-600 text-white border-amber-700" : "bg-white/20 text-white border-white/20"
                          }`}
                        >
                          {teleMuted ? "🔇 Unmute Mic" : "🎙️ Mute Mic"}
                        </button>
                        <button
                          onClick={() => setTeleCallActive(false)}
                          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                        >
                          End Consultation Call
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl mx-auto">
                        📹
                      </div>
                      <div>
                        <div className="font-bold text-sm">Specialist Teleconsultation Desk Ready</div>
                        <p className="text-xs text-white/60 mt-0.5">
                          Assisting: <strong>{selectedPatient?.name || "Select patient"}</strong> (Sub-Centre Room #1)
                        </p>
                      </div>
                      <button
                        onClick={() => setTeleCallActive(true)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all"
                      >
                        🚀 Launch Assisted Teleconsultation Call
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* TAB 3: HIGH-RISK COHORT & FOLLOW-UP ENGINE */}
          {tab === "followup" && (
            <Card
              title="High-Risk Patient Follow-up &amp; Home Visit Engine"
              subtitle="Prioritized maternal ANC, diabetic, hypertensive, and TB patients requiring proactive home visits."
            >
              <div className="space-y-3">
                {overdueFollowUps.map((fu) => (
                  <div key={fu.id} className="p-4 rounded-xl border border-red-200 bg-red-50/40 space-y-2.5 text-xs shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-[var(--color-deep-dark)] flex items-center gap-2">
                          <span>Patient #{fu.patient_id} — {fu.reason}</span>
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ⚠️ Overdue Alert
                          </span>
                        </div>
                        <div className="text-black/50 text-[11px] mt-0.5">
                          Scheduled Due Date: <strong>{new Date(fu.due_date).toLocaleDateString()}</strong> · Cohort: {fu.category || "General"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <input
                        placeholder="Log observations from field/home visit (e.g., Blood sugar checked, dietary counseling given)..."
                        value={visitNotes[fu.id] || ""}
                        onChange={(e) => setVisitNotes({ ...visitNotes, [fu.id]: e.target.value })}
                        className="w-full bg-white border border-black/15 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--color-deep)]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-black/50">Action: ASHA Home Visit Verification</span>
                      <button
                        onClick={() => handleMarkHomeVisitCompleted(fu.id)}
                        disabled={completingFuId === fu.id}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {completingFuId === fu.id ? "Updating…" : "✓ Mark Home Visit Completed"}
                      </button>
                    </div>
                  </div>
                ))}
                {overdueFollowUps.length === 0 && (
                  <div className="text-center py-8 text-xs text-emerald-800 font-semibold bg-emerald-50 rounded-xl">
                    ✓ All high-risk ANC, diabetic, and TB follow-ups in your area are up to date!
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* TAB 4: REFERRAL TRANSIT TRACKING & FIELD CREATION */}
          {tab === "referrals" && (
            <div className="space-y-5">
              {/* Field Referral Creation Card */}
              <Card
                title="🚑 Initiate Field / Sub-Centre Escalation Referral"
                subtitle="Frontline ASHA emergency escalation to Primary Health Centre or District Hospital"
              >
                <form onSubmit={handleCreateCommunityReferral} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-black/70 block mb-1">Select Patient *</label>
                    <select
                      value={refPatientId}
                      onChange={(e) => setRefPatientId(Number(e.target.value))}
                      className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-medium"
                      required
                    >
                      <option value="">Choose patient…</option>
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
                      value={refToFacilityId}
                      onChange={(e) => setRefToFacilityId(Number(e.target.value))}
                      className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-medium"
                      required
                    >
                      <option value="">Choose facility…</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.type}) · {f.district}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-black/70 block mb-1">Speciality / Department</label>
                    <select
                      value={refDepartment}
                      onChange={(e) => setRefDepartment(e.target.value)}
                      className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
                    >
                      <option value="General Medicine">General Medicine / PHC OPD</option>
                      <option value="Obstetrics & Gynecology">🤰 Obstetrics &amp; Maternal Health</option>
                      <option value="Cardiology">🫀 Cardiology (Chest Discomfort / ECG)</option>
                      <option value="Pediatrics">👶 Pediatrics &amp; Immunization</option>
                      <option value="Pulmonology">🫁 Pulmonology (Severe Cough/TB)</option>
                      <option value="Pathology & Lab">🔬 Central Diagnostic Lab</option>
                      <option value="Emergency & Trauma">🚨 Emergency &amp; Trauma Care</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-black/70 block mb-1">Clinical Urgency Level</label>
                    <select
                      value={refUrgency}
                      onChange={(e) => setRefUrgency(e.target.value)}
                      className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-semibold text-orange-700"
                    >
                      <option value="emergency">🚨 Emergency (Immediate Ambulance Dispatch)</option>
                      <option value="high">⚠️ High Priority (Rapid Assessment Required)</option>
                      <option value="medium">ℹ️ Moderate (Standard OPD Queue)</option>
                      <option value="low">✅ Routine (Preventive / Elective)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-black/70 block mb-1">Clinical Reason &amp; Field Observations *</label>
                    <input
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      placeholder="e.g., Persistent high fever with SpO2 drop, labor onset signs, uncontrolled high blood sugar..."
                      className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hwAmbulanceCheck"
                      checked={refAmbulance}
                      onChange={(e) => setRefAmbulance(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <label htmlFor="hwAmbulanceCheck" className="font-bold text-red-700 text-xs cursor-pointer flex items-center gap-1.5">
                      <span>🚨 Request Toll-Free 108 Emergency Ambulance Dispatch</span>
                    </label>
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5">
                    <button
                      type="submit"
                      disabled={creatingRef || !refPatientId || !refToFacilityId || !refReason.trim()}
                      className="px-5 py-2.5 rounded-xl bg-[var(--color-marigold)] text-[var(--color-deep-dark)] font-bold text-xs hover:bg-[var(--color-marigold-dark)] disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      {creatingRef ? "Registering Referral…" : "🚀 Dispatch Field Referral & Alert Hospital"}
                    </button>
                    {refMsg && <span className="text-xs text-emerald-800 font-semibold">{refMsg}</span>}
                  </div>
                </form>
              </Card>

              {/* Active Village Referrals & Transit Tracker */}
              <Card
                title="Active Patient Referrals &amp; Transport Lifecycle"
                subtitle="Live status of referred patients departing from your village, in transit, and reaching the destination hospital"
                action={
                  <button
                    onClick={loadReferrals}
                    className="text-xs text-[var(--color-deep)] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    🔄 Refresh
                  </button>
                }
              >
                <div className="space-y-4">
                  {facilityReferrals.map((r) => (
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
                          <div className="text-black/60 text-xs mt-1 flex flex-wrap items-center gap-1.5">
                            <span><strong>Village:</strong> {r.patient?.village || "Vallam"}</span>
                            <span>·</span>
                            <span><strong>Route:</strong> {r.from_facility_name || "Sub-Centre"} ➔ <strong className="text-[var(--color-deep-dark)]">{r.to_facility_name || "District Hospital"}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start">
                          {r.ambulance_required && (
                            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
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

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                        <p><strong>Clinical Reason:</strong> {r.reason}</p>
                        {r.specialist_notes && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 mt-1">
                            <strong>👨‍⚕️ Specialist Assessment:</strong> {r.specialist_notes}
                          </div>
                        )}
                        {r.counter_referral_notes && (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 mt-1">
                            <strong>💊 Counter-Referral Advice to Frontline Team:</strong> {r.counter_referral_notes}
                          </div>
                        )}
                      </div>

                      {/* Interactive Transit Action Buttons */}
                      <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/60 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--color-deep-dark)] font-bold">Update Village Transit:</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={updatingRefId === r.id}
                            onClick={() => handleUpdateReferralTransit(r.id, "patient_notified", "arranged")}
                            className="px-3 py-1.5 bg-white border border-black/15 hover:border-[var(--color-deep)] rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            🚗 Transport Arranged
                          </button>
                          <button
                            disabled={updatingRefId === r.id}
                            onClick={() => handleUpdateReferralTransit(r.id, "patient_notified", "in_transit")}
                            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            🛣️ Mark In Transit
                          </button>
                          <button
                            disabled={updatingRefId === r.id}
                            onClick={() => handleUpdateReferralTransit(r.id, "patient_arrived", "arrived")}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                          >
                            🏥 Confirm Hospital Arrival
                          </button>
                          <a
                            href="tel:108"
                            className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs inline-flex items-center gap-1"
                          >
                            <span>📞 Call 108</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                  {facilityReferrals.length === 0 && (
                    <p className="text-xs text-black/40 py-6 text-center">No active referrals recorded for this area.</p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 5: PATIENT REGISTRATION & ABHA GENERATOR */}
          {tab === "register" && (
            <Card
              title="Register New Patient &amp; Generate ABHA ID"
              subtitle="Creates an interoperable ABDM / ABHA profile linked with the national digital health grid."
            >
              <form onSubmit={handleRegister} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-black/70 block mb-1">Full Name *</label>
                  <input
                    required
                    placeholder="e.g. Ramesh V"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold text-black/70 block mb-1">Age *</label>
                  <input
                    required
                    type="number"
                    placeholder="35"
                    value={regForm.age}
                    onChange={(e) => setRegForm({ ...regForm, age: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold text-black/70 block mb-1">Gender *</label>
                  <select
                    value={regForm.gender}
                    onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-black/70 block mb-1">Phone Number</label>
                  <input
                    placeholder="9000000008"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold text-black/70 block mb-1">Village / Sub-Centre Area</label>
                  <input
                    placeholder="Thirukazhukundram"
                    value={regForm.village}
                    onChange={(e) => setRegForm({ ...regForm, village: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="font-semibold text-black/70 block mb-1">Blood Group</label>
                  <select
                    value={regForm.blood_group}
                    onChange={(e) => setRegForm({ ...regForm, blood_group: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white"
                  >
                    <option>B+</option>
                    <option>O+</option>
                    <option>A+</option>
                    <option>AB+</option>
                    <option>B-</option>
                    <option>O-</option>
                    <option>A-</option>
                    <option>AB-</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-black/70 block mb-1">Priority Health Cohort *</label>
                  <select
                    value={regForm.high_risk_category}
                    onChange={(e) => setRegForm({ ...regForm, high_risk_category: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm bg-white font-semibold text-[var(--color-deep)]"
                  >
                    <option value="General">General / Routine</option>
                    <option value="Maternal/ANC">🤰 Maternal / ANC (High Risk)</option>
                    <option value="Diabetes">🩸 Diabetes (NCD)</option>
                    <option value="Hypertension">🫀 Hypertension (Cardio)</option>
                    <option value="TB">🫁 Tuberculosis (DOTS)</option>
                    <option value="Elderly">👵 Elderly Geriatric Care</option>
                    <option value="Child Health">👶 Child Health / Immunization</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-black/70 block mb-1">Medical History / Chronic Illness</label>
                  <input
                    placeholder="e.g. Type 2 Diabetes, Asthmatic, Penicillin allergy..."
                    value={regForm.medical_history}
                    onChange={(e) => setRegForm({ ...regForm, medical_history: e.target.value })}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="sm:col-span-2 py-3 rounded-xl bg-[var(--color-deep)] text-white text-sm font-bold hover:bg-[var(--color-deep-dark)] transition-colors shadow-sm cursor-pointer mt-2"
                >
                  ✓ Complete Registration &amp; Issue ABHA Card
                </button>

                {regMsg && (
                  <p className="sm:col-span-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    {regMsg}
                  </p>
                )}
              </form>
            </Card>
          )}

          {/* TAB 6: INVENTORY & MEDICINE DISCOVERY */}
          {tab === "inventory" && (
            <Card
              title="Facility Medicine Stock Discovery"
              subtitle="Search real-time stock across PHCs, CHCs, and District Hospitals."
            >
              <div className="flex gap-2 mb-3">
                <input
                  value={medQuery}
                  onChange={(e) => setMedQuery(e.target.value)}
                  placeholder="Search medicine (e.g. Paracetamol, Amlodipine, Insulin)..."
                  className="flex-1 rounded-xl border border-black/15 px-3 py-2 text-xs outline-none focus:border-[var(--color-deep)]"
                />
                <button onClick={searchMedicine} className="px-4 py-2 rounded-xl bg-[var(--color-deep)] text-white text-xs font-bold cursor-pointer">
                  Search
                </button>
              </div>
              <div className="space-y-2">
                {medResults.map((r, i) => (
                  <div key={i} className="flex justify-between items-center text-xs border border-black/10 rounded-xl p-3 bg-white shadow-xs">
                    <div>
                      <span className="font-bold text-sm text-[var(--color-deep-dark)]">{r.facility.name}</span>
                      <span className="text-black/40 block text-[11px]">{r.facility.type} · {r.facility.village || r.facility.district}</span>
                    </div>
                    <span className={`font-bold text-xs px-2.5 py-1 rounded-full ${
                      r.is_low_stock ? "bg-orange-100 text-orange-800 border border-orange-200" : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {r.medicine_name}: {r.quantity} in stock {r.is_low_stock ? "(Low Stock)" : ""}
                    </span>
                  </div>
                ))}
                {medResults.length === 0 && <p className="text-xs text-black/40 py-2">Search to view facility stock levels.</p>}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COL: PATIENT SELECTION & DETAILS */}
        <div className="space-y-5">
          {selectedPatient && (
            <ABHACard
              name={selectedPatient.name}
              abhaId={selectedPatient.abha_id}
              age={selectedPatient.age}
              gender={selectedPatient.gender}
              bloodGroup={selectedPatient.blood_group}
              village={selectedPatient.village ?? undefined}
              highRiskCategory={selectedPatient.high_risk_category}
            />
          )}

          <Card title="Registered Village Cohort" subtitle="Quick patient selection for field triage">
            <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs border transition-all cursor-pointer ${
                    selectedPatientId === p.id
                      ? "border-[var(--color-deep)] bg-emerald-50/70 font-semibold ring-1 ring-[var(--color-deep)]"
                      : "border-black/8 hover:border-black/20 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-[var(--color-deep-dark)]">{p.name}</span>
                    {p.high_risk_category && p.high_risk_category !== "General" && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        {p.high_risk_category}
                      </span>
                    )}
                  </div>
                  <div className="text-black/50 text-[11px] mt-0.5">
                    #{p.id} · {p.age}y · {p.gender} · Village: {p.village || "—"}
                  </div>
                  {p.medical_history && (
                    <div className="text-[10px] text-emerald-800 truncate mt-1">
                      {p.medical_history}
                    </div>
                  )}
                </button>
              ))}
              {patients.length === 0 && <p className="text-xs text-black/40">No patients registered yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

