import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const ROLE_LABEL: Record<string, string> = {
  patient: "Patient Portal",
  health_worker: "Frontline Worker (ASHA / ANM)",
  doctor: "Doctor / Specialist Desk",
  admin: "District Command Center",
};

const DEMO_LOGINS: Record<string, { phone: string; name: string }> = {
  "ASHA Worker (Priya Patil)": { phone: "9000000001", name: "Priya Patil" },
  "PHC Doctor (Dr. Ramesh Kulkarni)": { phone: "9000000002", name: "Dr. Ramesh" },
  "Specialist (Dr. Anita Deshmukh)": { phone: "9000000003", name: "Dr. Anita" },
  "District Admin (DHO Pune)": { phone: "9000000004", name: "DHO Pune" },
  "Patient (Rahul Jadhav)": { phone: "9000000005", name: "Rahul Jadhav" },
  "Patient (Lakshmi Gaikwad - Diabetic)": { phone: "9000000006", name: "Lakshmi" },
  "Patient (Sunita Shinde - ANC)": { phone: "9000000007", name: "Sunita" },
};

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { user, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [lang, setLang] = useState("mr");
  const [networkStatus, setNetworkStatus] = useState<"online" | "low" | "offline">("online");
  const [switching, setSwitching] = useState(false);

  async function handleQuickSwitch(phone: string) {
    setSwitching(true);
    try {
      const u = await signIn(phone, "password123");
      const dest =
        u.role === "patient" ? "/patient" :
        u.role === "health_worker" ? "/health-worker" :
        u.role === "doctor" ? "/doctor" : "/admin";
      navigate(dest);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-mist)] flex flex-col font-sans">
      {/* Top Government ABHA & Emergency Bar */}
      <div className="bg-[var(--color-deep-dark)] text-white/80 text-xs px-5 py-1.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            महाराष्ट्र शासन (Govt. of Maharashtra) · सार्वजनिक आरोग्य विभाग · ABDM / ABHA
          </span>
          <span className="hidden md:inline text-white/40">|</span>
          <span className="hidden md:inline text-white/70">Rural Public Health Access &amp; Care-Continuity Grid</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connectivity toggle simulation */}
          <button
            onClick={() => setNetworkStatus(s => s === "online" ? "low" : s === "low" ? "offline" : "online")}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-white/15 hover:bg-white/10"
            title="Click to simulate rural connectivity mode"
          >
            {networkStatus === "online" && <span className="text-emerald-400">🟢 Online (Sync Active)</span>}
            {networkStatus === "low" && <span className="text-amber-400">🟡 Low Bandwidth (Cached)</span>}
            {networkStatus === "offline" && <span className="text-orange-400">🟠 Offline Mode (Queue Sync)</span>}
          </button>

          {/* Quick Role Switcher for Evaluators */}
          <select
            disabled={switching}
            onChange={(e) => {
              if (e.target.value) handleQuickSwitch(e.target.value);
            }}
            value=""
            className="bg-white/10 text-white text-[11px] rounded px-2 py-0.5 border border-white/20 outline-none"
          >
            <option value="" disabled className="text-black">⚡ Switch Demo Role…</option>
            {Object.entries(DEMO_LOGINS).map(([lbl, val]) => (
              <option key={val.phone} value={val.phone} className="text-black">
                {lbl}
              </option>
            ))}
          </select>

          {/* Language Selector */}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-white/10 text-white text-[11px] rounded px-2 py-0.5 border border-white/20 outline-none font-medium"
          >
            <option value="mr" className="text-black">मराठी (Marathi)</option>
            <option value="hi" className="text-black">हिन्दी (Hindi)</option>
            <option value="en" className="text-black">English</option>
            <option value="ta" className="text-black">தமிழ் (Tamil)</option>
            <option value="te" className="text-black">తెలుగు (Telugu)</option>
          </select>
        </div>
      </div>

      {/* Apollo Signature Main Navbar */}
      <header className="apollo-header text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <span className="token-badge w-10 h-10 text-white text-base font-extrabold shadow-md">
              S+
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-xl tracking-tight leading-none text-white">SwasthyaSetu</h1>
                <span className="bg-[#F37021]/25 text-[#FF9E59] border border-[#F37021]/50 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  महाराष्ट्र शासन
                </span>
              </div>
              <p className="text-xs text-teal-100/80 leading-none mt-1 font-medium">{title}</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3.5 text-sm">
              <div className="text-right hidden sm:block">
                <div className="font-bold text-white leading-tight">{user.name}</div>
                <div className="text-teal-200/80 text-xs font-medium">{ROLE_LABEL[user.role] || user.role}</div>
              </div>
              <button
                onClick={() => {
                  signOut();
                  navigate("/login");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold border border-white/15 cursor-pointer shadow-xs"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-5 py-6 flex-1 w-full">{children}</main>

      {/* Government Footer with Emergency Action Hub */}
      <footer className="bg-white border-t border-black/5 py-4 mt-8 text-xs text-black/60">
        <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--color-deep)]">महाराष्ट्र शासन · सार्वजनिक आरोग्य विभाग (Aarogya Vibhag)</span>
            <span>· SwasthyaSetu Rural Healthcare &amp; Care-Continuity Grid</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span className="text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
              🚨 Emergency / रुग्णवाहिका: Dial <strong>108</strong>
            </span>
            <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
              📞 आरोग्य सल्ला हेल्पलाईन: Dial <strong>104</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-black/8 shadow-xs p-5 hover:shadow-sm transition-shadow ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-3 border-b border-black/5 pb-2.5">
          <div>
            {title && <h2 className="font-display font-bold text-base text-[var(--color-deep-dark)]">{title}</h2>}
            {subtitle && <p className="text-xs text-black/50 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function UrgencyPill({ urgency }: { urgency: string }) {
  const styles: Record<string, string> = {
    emergency: "bg-red-100 text-red-800 border-red-300 font-bold animate-pulse",
    high: "bg-orange-100 text-orange-800 border-orange-300 font-semibold",
    medium: "bg-amber-100 text-amber-800 border-amber-300 font-medium",
    low: "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium",
  };
  const labels: Record<string, string> = {
    emergency: "🚨 Emergency",
    high: "⚠️ High Priority",
    medium: "ℹ️ Moderate",
    low: "✅ Routine",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs border ${styles[urgency] ?? styles.low}`}>
      {labels[urgency] ?? urgency}
    </span>
  );
}

export function ABHACard({
  name,
  abhaId,
  age,
  gender,
  bloodGroup,
  village,
  highRiskCategory,
}: {
  name: string;
  abhaId?: string;
  age: number;
  gender: string;
  bloodGroup?: string;
  village?: string;
  highRiskCategory?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-[var(--color-deep)] to-[var(--color-deep-dark)] text-white rounded-2xl p-5 shadow-md relative overflow-hidden border border-emerald-700">
      <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-white/5 rounded-full pointer-events-none"></div>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-marigold)] text-[var(--color-deep-dark)] font-bold flex items-center justify-center text-xs">
            AB
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">Ayushman Bharat Digital Mission</div>
            <div className="text-xs font-medium text-white/90">National Health Authority · ABHA ID</div>
          </div>
        </div>
        {highRiskCategory && highRiskCategory !== "General" && (
          <span className="bg-amber-400/20 text-amber-300 border border-amber-300/30 text-[11px] font-bold px-2 py-0.5 rounded-full">
            ⭐ {highRiskCategory}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 my-2">
        <div>
          <div className="text-[10px] text-white/60 uppercase">Full Name</div>
          <div className="text-base font-bold font-display tracking-tight text-white">{name}</div>
        </div>
        <div>
          <div className="text-[10px] text-white/60 uppercase">ABHA Address / ID</div>
          <div className="text-sm font-mono font-bold text-[var(--color-marigold)] tracking-wide">
            {abhaId || "91-4829-1049-8392"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-white/10 text-white/80">
        <span>Age: <strong>{age}y</strong></span>
        <span>Gender: <strong>{gender}</strong></span>
        <span>Blood: <strong className="text-[var(--color-marigold)]">{bloodGroup || "B+"}</strong></span>
        <span>Village: <strong>{village || "Thirukazhukundram"}</strong></span>
      </div>
    </div>
  );
}

export function ReferralStepper({ currentStage }: { currentStage: string }) {
  const stages = [
    { key: "created", label: "Referral Created" },
    { key: "facility_assigned", label: "Specialist Assigned" },
    { key: "patient_notified", label: "Patient Transit" },
    { key: "patient_arrived", label: "Hospital Arrival" },
    { key: "consult_completed", label: "Specialist Consult" },
    { key: "completed", label: "Follow-up Closed" },
  ];

  const getStageIndex = (st: string) => {
    if (st === "pending") return 1;
    if (st === "facility_assigned") return 2;
    if (st === "patient_notified") return 3;
    if (st === "patient_arrived" || st === "in_progress") return 4;
    if (st === "consult_completed") return 5;
    if (st === "completed") return 6;
    return 1;
  };

  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-black/10 -z-0"></div>
        <div
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-[var(--color-deep)] transition-all duration-500 -z-0"
          style={{ width: `${Math.min(100, (currentIndex / stages.length) * 100)}%` }}
        ></div>

        {stages.map((st, i) => {
          const isDone = i + 1 < currentIndex;
          const isCurrent = i + 1 === currentIndex;
          return (
            <div key={st.key} className="flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  isDone
                    ? "bg-[var(--color-deep)] text-white"
                    : isCurrent
                    ? "bg-[var(--color-marigold)] text-[var(--color-deep-dark)] ring-4 ring-[var(--color-marigold)]/30 font-extrabold"
                    : "bg-white text-black/40 border border-black/20"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center font-medium max-w-[65px] leading-tight ${isCurrent ? "text-[var(--color-deep-dark)] font-bold" : "text-black/50"}`}>
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

