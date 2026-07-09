import os
from pathlib import Path

from dotenv import load_dotenv

# backend/ directory (parent of app/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    """Central app settings, read from environment variables (see .env.example)."""

    PROJECT_NAME: str = "Logicopilot AI"
    API_PREFIX: str = "/api/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./logicopilot.db")
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

    # File storage for uploaded templates and rendered page previews.
    UPLOADS_DIR: Path = Path(os.getenv("UPLOADS_DIR", str(BASE_DIR / "uploads")))

    # OpenAI — prompt generation + extraction pipeline.
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Google Cloud Document AI — OCR.
    DOCAI_PROJECT_ID: str = os.getenv("DOCAI_PROJECT_ID", "")
    DOCAI_LOCATION: str = os.getenv("DOCAI_LOCATION", "us")
    DOCAI_PROCESSOR_ID: str = os.getenv("DOCAI_PROCESSOR_ID", "")


settings = Settings()

# The google-cloud libraries discover credentials via this env var. Resolve a
# relative path (as written in .env) against backend/ so it works regardless of
# the process's working directory.
_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
if _creds:
    _creds_path = Path(_creds)
    if not _creds_path.is_absolute():
        _creds_path = BASE_DIR / _creds_path
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_creds_path)
