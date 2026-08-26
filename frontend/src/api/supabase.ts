export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://drlhlipxnjhiwwgcdlit.supabase.co";
export const SUPABASE_REST_URL = import.meta.env.VITE_SUPABASE_REST_URL || "https://drlhlipxnjhiwwgcdlit.supabase.co/rest/v1/";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybGhsaXB4bmpoaXd3Z2NkbGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MjM3MzEsImV4cCI6MjEwMzI5OTczMX0.EQz7ogEEKdZtw4VRCpILivoPxFezpZzFRJ-YB_eFYOk";

export const getSupabaseHeaders = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
});
