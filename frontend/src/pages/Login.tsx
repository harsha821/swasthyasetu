import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const DEMO_ACCOUNTS = [
  { label: "Frontline ASHA Worker (Priya Patil)", phone: "9000000001", role: "ASHA / Sub-Centre" },
  { label: "PHC Medical Officer (Dr. Ramesh Kulkarni)", phone: "9000000002", role: "Primary Care OPD" },
  { label: "District Specialist (Dr. Anita Deshmukh)", phone: "9000000003", role: "Secondary / Hospital" },
  { label: "District Admin (DHO Pune)", phone: "9000000004", role: "Command Center" },
  { label: "Patient Rahul Jadhav (Active Referral)", phone: "9000000005", role: "Referral & Care Journey" },
  { label: "Patient Lakshmi Gaikwad (Diabetic Care)", phone: "9000000006", role: "NCD & Teleconsult" },
  { label: "Patient Sunita Shinde (Maternal ANC)", phone: "9000000007", role: "High-Risk ANC Alert" },
];

export default function Login() {
  const [phone, setPhone] = useState("9000000002");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await signIn(phone, password);
      const dest =
        user.role === "patient" ? "/patient" :
        user.role === "health_worker" ? "/health-worker" :
        user.role === "doctor" ? "/doctor" : "/admin";
      navigate(dest);
    } catch {
      setError("Incorrect phone number or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between py-8 px-4 font-sans overflow-hidden bg-gradient-to-br from-[#002B37] via-[#02475B] to-[#0A6178]">
      {/* Background Maharashtra Emblem Watermark Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-20 bg-center bg-no-repeat bg-cover pointer-events-none filter saturate-150"
        style={{ backgroundImage: "url('/maharashtra_bg.png')" }}
      />
      {/* Radial soft lighting vignette */}
      <div className="absolute inset-0 z-0 bg-radial from-transparent via-[#002B37]/60 to-[#002B37]/90 pointer-events-none" />

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-md mx-auto my-auto">
        <div className="flex flex-col items-center mb-5 text-center">
          {/* Official Maharashtra Emblem Showcase */}
          <div className="relative mb-3 flex items-center justify-center">
            <img
              src="/maharashtra_emblem.png"
              alt="Government of Maharashtra State Emblem"
              className="w-22 h-22 object-contain rounded-full shadow-2xl border-2 border-amber-400/80 bg-amber-50 p-1 transition-transform hover:scale-105"
            />
            <span className="absolute -bottom-1 -right-1 token-badge w-8 h-8 text-white text-xs font-black shadow-md border-2 border-white">
              S+
            </span>
          </div>

          <h1 className="font-display font-black text-2xl text-white tracking-tight drop-shadow-md">
            SwasthyaSetu AI
          </h1>
          <p className="text-xs text-amber-300 font-extrabold uppercase tracking-wider mt-1 drop-shadow-sm">
            महाराष्ट्र शासन · सार्वजनिक आरोग्य विभाग
          </p>
          <p className="text-xs text-teal-100/80 mt-0.5 max-w-xs font-medium">
            Government of Maharashtra · Digital Public Healthcare Grid
          </p>
        </div>

        {/* Login Form Card */}
        <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-800">Phone number / मोबाईल क्रमांक</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9000000002"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#02475B] focus:ring-3 focus:ring-[#02475B]/20 bg-slate-50 transition-all font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-800">Password / पासवर्ड</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#02475B] focus:ring-3 focus:ring-[#02475B]/20 bg-slate-50 transition-all"
            />
          </div>
          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          <button
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F37021] to-[#FF8533] hover:from-[#E05E10] hover:to-[#F37021] text-white font-extrabold text-sm transition-all disabled:opacity-50 shadow-md hover:shadow-lg cursor-pointer transform active:scale-[0.99]"
          >
            {loading ? "Authenticating…" : "Sign In to Healthcare Grid"}
          </button>
        </form>

        {/* Quick Demo Persona Switcher */}
        <div className="mt-5 bg-white/90 backdrop-blur-md rounded-2xl border border-white/20 p-4 shadow-xl">
          <p className="text-xs font-extrabold text-center text-[#002B37] mb-2.5 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F37021] animate-ping"></span>
            ⚡ Quick-Launch Demo Roles (Click to fill)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.phone}
                type="button"
                onClick={() => setPhone(acc.phone)}
                className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                  phone === acc.phone
                    ? "border-[#02475B] bg-[#E4F7F4] text-[#002B37] font-bold ring-1.5 ring-[#02475B] shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="font-bold truncate">{acc.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{acc.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 text-center text-[11px] text-teal-100/70 mt-6 font-medium">
        महाराष्ट्र शासन (Government of Maharashtra) · Public Health Access &amp; Care Continuity
      </div>
    </div>
  );
}
