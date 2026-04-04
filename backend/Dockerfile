# ============================================================
# Meetings.ro — Backend All-in-One (FastAPI + MongoDB 7.0)
# Single container: MongoDB + FastAPI in same process space
# ============================================================

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Bucharest

# -------------------- System deps --------------------
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    python3.11 \
    python3.11-venv \
    python3-pip \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# -------------------- MongoDB 7.0 --------------------
RUN curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org && \
    rm -rf /var/lib/apt/lists/*

# -------------------- Directories --------------------
RUN mkdir -p /data/db /app/uploads /var/log/supervisor

WORKDIR /app

# -------------------- Python deps --------------------
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# -------------------- App code --------------------
COPY . .

# -------------------- Supervisor config --------------------
# Runs both MongoDB and FastAPI as managed processes
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# -------------------- Entrypoint --------------------
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# -------------------- Health check --------------------
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# -------------------- Expose --------------------
EXPOSE 8000

# -------------------- Start --------------------
CMD ["/entrypoint.sh"]
