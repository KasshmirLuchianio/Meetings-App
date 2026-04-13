"""
Migration 002 — Add tenant_id to all existing documents.

Run this BEFORE deploying the new multi-tenant backend.
It is fully idempotent — safe to run multiple times.

Usage:
    python migrations/002_add_tenant_id.py
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "meetings_platform")

DEFAULT_TENANT = {
    "name": "Default Institution",
    "slug": "default",
    "institution_type": "primarie",
    "config": {},
    "is_active": True,
    "created_at": datetime.now(timezone.utc),
    "updated_at": datetime.now(timezone.utc),
}


async def run():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    tenants_col = db["tenants"]
    meetings_col = db["meetings"]
    localities_col = db["localities"]
    users_col = db["users"]

    # ── Step 1: Ensure default tenant exists ─────────────────────────────────
    existing_tenant = await tenants_col.find_one({"slug": "default"})
    if existing_tenant:
        default_tenant_id = existing_tenant["_id"]
        print(f"[002] Default tenant already exists: {default_tenant_id}")
    else:
        result = await tenants_col.insert_one(DEFAULT_TENANT)
        default_tenant_id = result.inserted_id
        print(f"[002] Created default tenant: {default_tenant_id}")

    # ── Step 2: Backfill meetings ─────────────────────────────────────────────
    meetings_result = await meetings_col.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {"tenant_id": default_tenant_id}}
    )
    print(f"[002] Meetings backfilled: {meetings_result.modified_count}")

    # ── Step 3: Backfill localities ────────────────────────────────────────────
    localities_result = await localities_col.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {"tenant_id": default_tenant_id}}
    )
    print(f"[002] Localities backfilled: {localities_result.modified_count}")

    # ── Step 4: Backfill users ─────────────────────────────────────────────────
    users_result = await users_col.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {
            "tenant_id": default_tenant_id,
            "role": "admin",        # existing users get admin on the default tenant
            "plan": "enterprise",
            "is_active": True,
        }}
    )
    print(f"[002] Users backfilled: {users_result.modified_count}")

    # ── Step 5: Ensure tenant-scoped indexes ───────────────────────────────────
    await meetings_col.create_index([("tenant_id", 1), ("created_at", -1)])
    await meetings_col.create_index([("tenant_id", 1), ("locality", 1)])
    await meetings_col.create_index([("tenant_id", 1), ("status", 1)])
    await users_col.create_index([("tenant_id", 1), ("email", 1)], unique=True)
    await localities_col.create_index([("tenant_id", 1), ("name", 1)], unique=True)
    await tenants_col.create_index("slug", unique=True)
    print("[002] Indexes created.")

    print("[002] Migration complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
