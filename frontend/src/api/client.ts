import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Prevent infinite reload loop if already on login page
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export type Role = "patient" | "health_worker" | "doctor" | "admin";

export interface User {
  id: number;
  name: string;
  phone: string;
  role: Role;
  facility_id: number | null;
}

export async function login(phone: string, password: string) {
  const form = new URLSearchParams();
  form.set("username", phone);
  form.set("password", password);
  const res = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  localStorage.setItem("token", res.data.access_token);
  localStorage.setItem("user", JSON.stringify(res.data.user));
  return res.data.user as User;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
