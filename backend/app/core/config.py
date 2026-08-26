import os

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://drlhlipxnjhiwwgcdlit.supabase.co")
        SUPABASE_REST_URL: str = os.getenv("SUPABASE_REST_URL", "https://drlhlipxnjhiwwgcdlit.supabase.co/rest/v1/")
        SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybGhsaXB4bmpoaXd3Z2NkbGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MjM3MzEsImV4cCI6MjEwMzI5OTczMX0.EQz7ogEEKdZtw4VRCpILivoPxFezpZzFRJ-YB_eFYOk")
        DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./swasthyasetu.db")
        JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")

        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore"
        )

    settings = Settings()

except ImportError:
    # Fallback to standard os.getenv if pydantic-settings is not installed in the active environment
    def load_env_file(dotenv_path=".env"):
        if os.path.exists(dotenv_path):
            with open(dotenv_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())

    load_env_file()

    class FallbackSettings:
        SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://drlhlipxnjhiwwgcdlit.supabase.co")
        SUPABASE_REST_URL: str = os.getenv("SUPABASE_REST_URL", "https://drlhlipxnjhiwwgcdlit.supabase.co/rest/v1/")
        SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybGhsaXB4bmpoaXd3Z2NkbGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MjM3MzEsImV4cCI6MjEwMzI5OTczMX0.EQz7ogEEKdZtw4VRCpILivoPxFezpZzFRJ-YB_eFYOk")
        DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./swasthyasetu.db")
        JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")

    settings = FallbackSettings()
