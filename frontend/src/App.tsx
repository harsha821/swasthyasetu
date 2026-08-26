import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import PatientPortal from "./pages/PatientPortal";
import HealthWorkerPortal from "./pages/HealthWorkerPortal";
import DoctorPortal from "./pages/DoctorPortal";
import AdminPortal from "./pages/AdminPortal";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const dest =
    user.role === "patient" ? "/patient" :
    user.role === "health_worker" ? "/health-worker" :
    user.role === "doctor" ? "/doctor" : "/admin";
  return <Navigate to={dest} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/patient"
        element={<ProtectedRoute allow={["patient"]}><PatientPortal /></ProtectedRoute>}
      />
      <Route
        path="/health-worker"
        element={<ProtectedRoute allow={["health_worker"]}><HealthWorkerPortal /></ProtectedRoute>}
      />
      <Route
        path="/doctor"
        element={<ProtectedRoute allow={["doctor"]}><DoctorPortal /></ProtectedRoute>}
      />
      <Route
        path="/admin"
        element={<ProtectedRoute allow={["admin"]}><AdminPortal /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
