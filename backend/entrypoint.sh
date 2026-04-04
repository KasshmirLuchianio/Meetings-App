#!/bin/bash
# ============================================================
# Meetings.ro — Entrypoint script
# Sets up persistent storage and starts supervisord
# ============================================================

set -e

# Ensure MongoDB data directory exists on persistent disk
mkdir -p /data/db

# Ensure uploads directory exists on persistent disk
mkdir -p /data/uploads

# Symlink /app/uploads → /data/uploads (persistent disk)
if [ ! -L /app/uploads ]; then
    rm -rf /app/uploads
    ln -sf /data/uploads /app/uploads
fi

echo "=== Meetings.ro Backend Starting ==="
echo "MongoDB: localhost:27017"
echo "FastAPI: 0.0.0.0:8000"
echo "Storage: /data (persistent disk)"
echo "===================================="

# Start supervisor (manages both mongod + uvicorn)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
