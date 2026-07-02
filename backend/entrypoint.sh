#!/bin/bash
# ============================================================
# Meetings.ro — Entrypoint script
# Storage setup + dynamic supervisord config, then starts supervisord.
#
# MONGO_URL decides the database mode:
#   - unset / localhost  → starts local mongod (data in /data/db;
#     PERSISTENT only on paid Render plans with a disk — on the free
#     plan this is wiped at every restart/spin-down!)
#   - external URI (e.g. MongoDB Atlas mongodb+srv://...) → mongod is
#     NOT started; the app connects to the external cluster. This is
#     the required setup on the Render free plan.
# ============================================================

set -e

# Storage dirs. On paid plans /data is the persistent disk; on the free
# plan it is ephemeral container storage (audio files won't survive restarts).
mkdir -p /data/db /data/uploads /var/log/supervisor

# Symlink /app/uploads → /data/uploads
if [ ! -L /app/uploads ]; then
    rm -rf /app/uploads
    ln -sf /data/uploads /app/uploads
fi

# Respect MONGO_URL from the environment (Render dashboard). Only default
# to local mongod when nothing is configured.
export MONGO_URL="${MONGO_URL:-mongodb://localhost:27017/gal_meetings}"
export DB_NAME="${DB_NAME:-gal_meetings}"

# uvicorn workers: UVICORN_WORKERS > WEB_CONCURRENCY (set by Render) > 2.
# Keep this low on the free plan (512MB RAM).
export UVICORN_WORKERS="${UVICORN_WORKERS:-${WEB_CONCURRENCY:-2}}"

# ---------- Dynamic supervisord programs ----------
EXTRA_DIR=/etc/supervisor/conf.d/extra
mkdir -p "$EXTRA_DIR"
rm -f "$EXTRA_DIR"/*.conf
# supervisord's [include] errors out if the glob matches no files
echo "; placeholder" > "$EXTRA_DIR/00-placeholder.conf"

case "$MONGO_URL" in
  *localhost*|*127.0.0.1*)
    DB_MODE="local mongod (/data/db)"
    cat > "$EXTRA_DIR/mongodb.conf" <<'EOF'
[program:mongodb]
command=mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 --noauth --quiet
autostart=true
autorestart=true
priority=10
startsecs=5
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
redirect_stderr=true
EOF
    ;;
  *)
    # External DB (Atlas etc.) — never print the URI, it contains credentials.
    DB_MODE="external (MONGO_URL from env)"
    ;;
esac

# Daily MongoDB backup to S3 — enabled only when fully configured.
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ -n "$S3_BACKUP_BUCKET" ]; then
    BACKUP_MODE="enabled → s3://$S3_BACKUP_BUCKET"
    cat > "$EXTRA_DIR/backup.conf" <<'EOF'
[program:mongo_backup]
command=python3 /app/scripts/mongo_backup.py
directory=/app
autostart=true
autorestart=true
priority=30
startsecs=5
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
redirect_stderr=true
EOF
else
    BACKUP_MODE="disabled (set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + S3_BACKUP_BUCKET)"
fi

echo "=== Meetings.ro Backend Starting ==="
echo "MongoDB:  $DB_MODE"
echo "Backup:   $BACKUP_MODE"
echo "FastAPI:  0.0.0.0:8000 ($UVICORN_WORKERS workers)"
echo "===================================="

# Start supervisor (manages fastapi + optional mongod/backup)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
