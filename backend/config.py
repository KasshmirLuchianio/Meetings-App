"""
Centralized configuration — all settings come from environment variables.
Never hardcode secrets or URLs here.
"""
import os
from pathlib import Path
from typing import List


class Settings:
    # ── Core ──────────────────────────────────────────────────────────────────
    MONGO_URL: str = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME: str = os.environ.get("DB_NAME", "meetings_platform")
    UPLOAD_DIR: Path = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))

    # ── Auth ──────────────────────────────────────────────────────────────────
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = int(os.environ.get("JWT_EXPIRATION_HOURS", "72"))

    # ── Institution / Branding ────────────────────────────────────────────────
    INSTITUTION_NAME: str = os.environ.get("INSTITUTION_NAME", "Meetings Platform")
    APP_BASE_URL: str = os.environ.get("APP_BASE_URL", "http://localhost:8000")
    ALLOW_SELF_REGISTER: bool = os.environ.get("ALLOW_SELF_REGISTER", "false").lower() == "true"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        o.strip()
        for o in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:8081,exp://localhost:19000",
        ).split(",")
        if o.strip()
    ]

    # ── Local AI — Whisper ────────────────────────────────────────────────────
    WHISPER_MODEL_PATH: str = os.environ.get("WHISPER_MODEL_PATH", "/opt/models/whisper")
    WHISPER_MODEL_SIZE: str = os.environ.get("WHISPER_MODEL_SIZE", "medium")
    WHISPER_DEVICE: str = os.environ.get("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

    # ── Local AI — Ollama / LLM ───────────────────────────────────────────────
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
    OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "llama3:8b-instruct")

    # ── SMTP (local mail server) ───────────────────────────────────────────────
    SMTP_HOST: str = os.environ.get("SMTP_HOST", "smtp")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", "1025"))
    SMTP_USER: str = os.environ.get("SMTP_USER", "")
    SMTP_PASS: str = os.environ.get("SMTP_PASS", "")
    SMTP_FROM: str = os.environ.get("SMTP_FROM", f"no-reply@meetings.local")
    SMTP_TLS: bool = os.environ.get("SMTP_TLS", "false").lower() == "true"

    # ── Upload limits ─────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "100"))

    # ── License (on-premise replaces Stripe) ─────────────────────────────────
    LICENSE_MAX_USERS: int = int(os.environ.get("LICENSE_MAX_USERS", "-1"))        # -1 = unlimited
    LICENSE_MAX_MEETINGS_PER_MONTH: int = int(os.environ.get("LICENSE_MAX_MEETINGS_PER_MONTH", "-1"))

    # ── Digital signatures ────────────────────────────────────────────────────
    SIGNING_CERT_PATH: str = os.environ.get("SIGNING_CERT_PATH", "")
    SIGNING_CERT_PASS: str = os.environ.get("SIGNING_CERT_PASS", "")

    # ── Feature flags ─────────────────────────────────────────────────────────
    SHOW_PRICING: bool = os.environ.get("SHOW_PRICING", "false").lower() == "true"
    ENABLE_STRIPE: bool = os.environ.get("ENABLE_STRIPE", "false").lower() == "true"

    def validate(self):
        if not self.JWT_SECRET:
            raise RuntimeError("JWT_SECRET environment variable is required")
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
