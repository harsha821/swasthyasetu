import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../api/client";

export function ProtectedRoute({
  children,
  allow,
}: {
  children: ReactNode;
  allow: Role[];
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
