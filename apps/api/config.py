"""Pydantic Settings — tüm env değişkenleri tek yerden."""
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

FORBIDDEN_MODELS = {
    "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash",
    "text-embedding-004",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    gemini_api_key: str = Field(..., description="Gemini API anahtarı")
    chroma_host: str = "localhost"
    chroma_port: int = 8001
    chroma_collection: str = "kobi_mevzuat"

    allowed_origins: str = "http://localhost:5173"
    max_pdf_size_mb: int = 10
    log_level: str = "INFO"

    gemini_vision_model: str = "gemini-2.5-flash"
    gemini_text_model: str = "gemini-2.5-pro"
    gemini_embed_model: str = "gemini-embedding-001"
    gemini_embed_dim: int = 1536

    # ── v2 (multi-tenant) ──
    # Supabase wiring; eksikse v1 endpoint'leri çalışır, v2 endpoint'leri 503 döner.
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    encryption_key: str | None = None

    @field_validator("gemini_vision_model", "gemini_text_model", "gemini_embed_model")
    @classmethod
    def _block_forbidden(cls, v: str) -> str:
        if v in FORBIDDEN_MODELS:
            raise ValueError(f"yasak model: {v}")
        return v

    @field_validator("gemini_embed_model")
    @classmethod
    def _normalize_gemini_embed_model(cls, v: str) -> str:
        """google.generativeai.embed_content tam model yolu ister (models/...)."""
        v = v.strip()
        if v.startswith("models/") or v.startswith("tunedModels/"):
            return v
        return f"models/{v}"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()  # type: ignore[call-arg]
