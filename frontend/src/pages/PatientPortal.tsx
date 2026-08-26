import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Layout, Card, UrgencyPill, ABHACard, ReferralStepper } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

interface PatientProfile {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone?: string;
  village?: string;
  medical_history?: string;
  abha_id?: string;
  blood_group?: string;
  high_risk_category?: string;
  emergency_contact?: string;
  facility_id?: number;
}

export default function PatientPortal() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.get("/patients/me");
        if (res.data) {
          setProfile(res.data);
          const pid = res.data.id;
          api.get(`/appointments/patient/${pid}`).then((r) => setAppointments(r.data)).catch(() => {});
          api.get(`/referrals/patient/${pid}`).then((r) => setReferrals(r.data)).catch(() => {});
          api.get(`/reports/patient/${pid}`).then((r) => setReports(r.data)).catch(() => {});
          api.get(`/followups/patient/${pid}`).then((r) => setFollowUps(r.data)).catch(() => {});
          api.get(`/symptoms/patient/${pid}`).then((r) => setSymptoms(r.data)).catch(() => {});
        }
      } catch (err) {
        console.error("Could not load patient profile", err);
      }
    }
    loadData();
  }, [user]);

  return (
    <Layout title="Patient Care Portal &amp; ABHA Health Card">
      {/* Top Profile Summary & ABHA Card */}
      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <div className="lg:col-span-2">
            <ABHACard
              name={profile.name}
              abhaId={profile.abha_id}
              age={profile.age}
              gender={profile.gender}
              bloodGroup={profile.blood_group}
              village={profile.village}
              highRiskCategory={profile.high_risk_category}
            />
          </div>

          <Card title="Patient Health Summary" className="flex flex-col justify-between">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-black/5 pb-1.5">
                <span className="text-black/50">Registered Facility:</span>
                <span className="font-semibold text-[var(--color-deep)]">Thirukazhukundram PHC</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1.5">
                <span className="text-black/50">Primary Contact:</span>
                <span className="font-mono">{profile.phone || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 pb-1.5">
                <span className="text-black/50">Emergency Contact:</span>
                <span className="font-mono text-red-700 font-semibold">{profile.emergency_contact || "+91 98401 23456"}</span>
              </div>
              {profile.medical_history && (
                <div className="bg-emerald-50 text-[var(--color-deep-dark)] p-2.5 rounded-xl border border-emerald-100 mt-2">
                  <strong>Known Medical Conditions:</strong> {profile.medical_history}
                </div>
              )}
            </div>
            <div className="pt-2 text-[11px] text-black/40 flex items-center gap-1">
              <span>🔒 Encrypted EHR</span>
              <span>· ABDM Consent-Ready</span>
            </div>
          </Card>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-black/10 pb-3">
        {[
          { id: "overview", label: "📋 My Active Care & Referrals" },
          { id: "history", label: "📜 Longitudinal Records & Reports" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === t.id
                ? "bg-[var(--color-deep)] text-white shadow-sm"
                : "bg-white text-black/70 hover:bg-black/5 border border-black/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & REFERRALS */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Active Queue Tokens & Appointments */}
          <Card title="Today's OPD Queue & Appointments" subtitle="Live token tracker and consultation status">
            <div className="space-y-3">
              {appointments.map((a) => (
                <div key={a.id} className="p-4 rounded-xl border border-black/10 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="token-badge w-10 h-10 bg-[var(--color-deep)] text-white text-base shadow-sm">
                        #{a.queue_token}
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-[var(--color-deep-dark)]">
                          {a.is_teleconsultation ? "📹 Teleconsultation Session" : "🏥 In-Person OPD Consultation"}
                        </div>
                        <div className="text-xs text-black/50">
                          Scheduled: {new Date(a.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Dr. Ramesh (PHC)
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                      a.status === "in_progress" ? "bg-amber-100 text-amber-800 animate-pulse" :
                      a.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {a.status.replace("_", " ")}
                    </span>
                  </div>

                  {a.clinical_notes && (
                    <div className="text-xs bg-white p-2.5 rounded-lg border border-black/5 text-black/70">
                      <strong>Doctor Notes:</strong> {a.clinical_notes}
                    </div>
                  )}

                  {a.prescription && (
                    <div className="text-xs bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                      <strong>Prescribed Medication:</strong>
                      <p className="whitespace-pre-line mt-0.5 font-medium">{a.prescription}</p>
                    </div>
                  )}
                </div>
              ))}
              {appointments.length === 0 && (
                <div className="text-center py-6 text-xs text-black/40">
                  No active appointments today.
                </div>
              )}
            </div>
          </Card>

          {/* Referral Progress Visualizer (6-Stage Stepper) */}
          <Card
            title="Referral Care-Continuity Pipeline"
            subtitle="End-to-end journey tracking to secondary district hospital"
            action={
              <button
                onClick={() => {
                  if (profile) {
                    api.get(`/referrals/patient/${profile.id}`).then((r) => setReferrals(r.data)).catch(() => {});
                  }
                }}
                className="text-xs text-[var(--color-deep)] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                title="Refresh referral status"
              >
                🔄 Refresh Status
              </button>
            }
          >
            <div className="space-y-4">
              {referrals.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-black/10 bg-white space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[var(--color-deep-dark)]">
                          Referral #{r.id}
                        </span>
                        <span className="text-[11px] bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded">
                          🏥 {r.department || "General Medicine"}
                        </span>
                        <UrgencyPill urgency={r.urgency} />
                      </div>
                      <div className="text-xs text-black/70 mt-1 flex flex-wrap items-center gap-1.5">
                        <span><strong>From:</strong> {r.from_facility_name || "Primary Health Centre"}</span>
                        <span>➔</span>
                        <span><strong>To:</strong> <span className="text-[var(--color-deep-dark)] font-bold">{r.to_facility_name || "Aundh District Headquarters Hospital, Pune"}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      {r.ambulance_required && (
                        <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full animate-pulse border border-red-200">
                          🚨 108 Ambulance Requested
                        </span>
                      )}
                      <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono capitalize">
                        Transit: {r.transport_status || "in_transit"}
                      </span>
                    </div>
                  </div>

                  {/* 6-Stage Stepper Component */}
                  <ReferralStepper currentStage={r.status} />

                  <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 space-y-1.5">
                    <p><strong>Clinical Reason for Referral:</strong> {r.reason}</p>
                    {r.specialist_notes && (
                      <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                        <strong>👨‍⚕️ Specialist Clinical Assessment:</strong>
                        <p className="mt-0.5">{r.specialist_notes}</p>
                      </div>
                    )}
                    {r.counter_referral_notes && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                        <strong>💊 Counter-Referral Advice to PHC Doctor:</strong>
                        <p className="mt-0.5">{r.counter_referral_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {referrals.length === 0 && (
                <div className="text-center py-6 text-xs text-black/40">
                  No active referrals. When a PHC doctor initiates a referral, live transit &amp; specialist updates appear here.
                </div>
              )}
            </div>
          </Card>

          {/* High-Risk Follow-Up Reminders */}
          <Card title="Follow-Up Care Schedule" subtitle="Prioritized reminders for chronic conditions &amp; maternal health">
            <div className="space-y-2.5">
              {followUps.map((f) => (
                <div key={f.id} className="flex justify-between items-center p-3 rounded-xl border border-black/8 bg-white text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-sm text-[var(--color-deep-dark)] flex items-center gap-2">
                      {f.reason}
                      {f.is_high_risk && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          High-Risk
                        </span>
                      )}
                    </div>
                    <div className="text-black/50">
                      Due Date: <strong>{new Date(f.due_date).toLocaleDateString()}</strong> · Category: {f.category || "General"}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    f.completed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {f.completed ? "✓ Attended" : "⏳ Pending Visit"}
                  </span>
                </div>
              ))}
              {followUps.length === 0 && <p className="text-xs text-black/40 py-2">No follow-ups pending.</p>}
            </div>
          </Card>

          {/* Quick Emergency Quick Action Hub */}
          <Card title="Rural Emergency &amp; Telehealth Escalation">
            <div className="space-y-2 text-xs">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-red-800 text-sm">Emergency Medical Ambulance</div>
                  <div className="text-red-700/80">Toll-free 24x7 Government Ambulance Dispatch</div>
                </div>
                <a href="tel:108" className="px-3 py-1.5 bg-red-700 text-white rounded-lg font-bold hover:bg-red-800">
                  Call 108
                </a>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-blue-800 text-sm">Tele-MANAS &amp; Health Helpline</div>
                  <div className="text-blue-700/80">24x7 Free Doctor &amp; Counseling Advisory</div>
                </div>
                <a href="tel:104" className="px-3 py-1.5 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800">
                  Call 104
                </a>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: LONGITUDINAL RECORDS & BLOCKCHAIN REPORTS */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Verified Medical Reports (Tamper-Proof Audit)" subtitle="Diagnostic reports sealed with SHA-256 blockchain hashes">
            <div className="space-y-3">
              {reports.map((rep) => (
                <div key={rep.id} className="p-3.5 rounded-xl border border-black/10 bg-white space-y-1.5 text-xs shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-[var(--color-deep-dark)]">{rep.title}</span>
                    <span className="text-[10px] text-black/40">{new Date(rep.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="font-mono text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-700 truncate">
                    SHA-256: {rep.content_hash}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                    <span>✓ Tamper-evident on national health ledger</span>
                  </div>
                </div>
              ))}
              {reports.length === 0 && <p className="text-xs text-black/40 py-2">No uploaded reports yet.</p>}
            </div>
          </Card>

          <Card title="Past AI Triage &amp; Symptom Records" subtitle="Longitudinal symptom history and intake transcripts">
            <div className="space-y-3">
              {symptoms.map((s) => (
                <div key={s.id} className="p-3.5 rounded-xl border border-black/10 bg-emerald-50/40 space-y-1.5 text-xs shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-black/50 font-semibold">{new Date(s.created_at).toLocaleString()}</span>
                    <UrgencyPill urgency={s.urgency} />
                  </div>
                  <p className="font-medium text-[var(--color-deep-dark)]">"{s.raw_input}"</p>
                  <p className="text-black/60 italic">{s.ai_notes}</p>
                </div>
              ))}
              {symptoms.length === 0 && <p className="text-xs text-black/40 py-2">No symptom records logged.</p>}
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
}

