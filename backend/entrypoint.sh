#!/bin/bash
# ============================================================
# Meetings.ro — Entrypoint script
# Sets up persistent storage, MongoDB auth, and starts supervisord
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

# ==================== MongoDB Auth Setup ====================
# Start MongoDB temporarily without auth to create admin user
mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 --fork --logpath /data/mongod_init.log

# Wait for MongoDB to be ready
sleep 3

# Create admin user if not already exists
MONGO_PASSWORD="${MONGO_PASSWORD:-changeme_in_production}"
mongosh --quiet --eval "
use admin
if (db.getUsers().users.length === 0) {
  db.createUser({
    user: 'meetingsadmin',
    pwd: '${MONGO_PASSWORD}',
    roles: [
      { role: 'readWrite', db: 'gal_meetings' },
      { role: 'dbAdmin', db: 'gal_meetings' }
    ]
  });
  print('MongoDB admin user created.');
} else {
  print('MongoDB admin user already exists.');
}
" 2>/dev/null || echo "MongoDB user setup skipped (may already exist)"

# Stop the temporary MongoDB instance
mongod --shutdown --dbpath /data/db 2>/dev/null || true
sleep 1

# ==================== Export MONGO_URL with auth ====================
export MONGO_URL="mongodb://meetingsadmin:${MONGO_PASSWORD}@localhost:27017/gal_meetings?authSource=admin"

echo "=== Meetings.ro Backend Starting ==="
echo "MongoDB: localhost:27017 (auth enabled)"
echo "FastAPI: 0.0.0.0:8000"
echo "Storage: /data (persistent disk)"
echo "===================================="

# Start supervisor (manages both mongod + uvicorn)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
