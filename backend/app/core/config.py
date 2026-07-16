from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./logicopilot.db"

    jwt_secret_key: str = "change-me-to-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False

    # Document-extraction stack (onboarding wizard: OCR + prompt generation).
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    docai_project_id: str = ""
    docai_location: str = "us"
    docai_processor_id: str = ""
    google_application_credentials: str = "google-credentials.json"
    uploads_dir: str = "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
