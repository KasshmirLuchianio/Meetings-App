# ============================================================
# Backend Dockerfile — FastAPI only (no MongoDB, no supervisord)
# Base: python:3.11-slim for minimal image size
#
# Multi-stage build:
#   Stage 1 (model-fetcher): downloads Whisper model weights
#   Stage 2 (runtime): production image
#
# For air-gapped deployment: build with --build-arg AIR_GAPPED=true
# and pre-place model files in /opt/models/whisper before build.
# ============================================================

ARG WHISPER_MODEL_SIZE=medium
ARG AIR_GAPPED=false

# ── Stage 1: Download Whisper model (skipped in air-gapped mode) ──────────────
FROM python:3.11-slim AS model-fetcher

ARG WHISPER_MODEL_SIZE
ARG AIR_GAPPED

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir faster-whisper huggingface_hub

# Download model only if not air-gapped
RUN if [ "$AIR_GAPPED" = "false" ]; then \
      python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL_SIZE}', download_root='/opt/models/whisper', device='cpu', compute_type='int8')"; \
    else \
      echo "Air-gapped mode: skipping model download. Mount models at /opt/models/whisper."; \
      mkdir -p /opt/models/whisper; \
    fi


# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# System deps: ffmpeg (audio processing), fonts (PDF diacritics), curl (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Whisper models from fetcher stage
COPY --from=model-fetcher /opt/models/whisper /opt/models/whisper

# Copy application code
COPY . .

# Create upload directory
RUN mkdir -p /app/uploads

# Non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app /opt/models
USER appuser

EXPOSE 8000

# Run migration then start server
CMD ["sh", "-c", \
     "python migrations/002_add_tenant_id.py && \
      uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2"]
