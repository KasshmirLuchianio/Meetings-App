"""
Tenant model — one tenant = one institution (primărie, tribunal, spital etc.)
Every document in the DB is scoped to a tenant_id.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from bson import ObjectId


INSTITUTION_TYPES = [
    "primarie",
    "consiliu_local",
    "tribunal",
    "spital",
    "universitate",
    "ong",
    "asociatie",
    "other",
]

ROLES = ["secretary", "mayor", "councilor", "clerk", "admin"]

# Permission matrix per role
# Keys: read, write, approve, export, sign, manage_users, manage_tenant
ROLE_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "secretary": {
        "read": True,
        "write": True,
        "approve": True,
        "export": True,
        "sign": True,
        "manage_users": False,
        "manage_tenant": False,
    },
    "mayor": {
        "read": True,
        "write": False,
        "approve": True,
        "export": True,
        "sign": True,
        "manage_users": False,
        "manage_tenant": False,
    },
    "councilor": {
        "read": True,
        "write": False,
        "approve": False,
        "export": True,
        "sign": False,
        "manage_users": False,
        "manage_tenant": False,
    },
    "clerk": {
        "read": True,
        "write": True,
        "approve": False,
        "export": False,
        "sign": False,
        "manage_users": False,
        "manage_tenant": False,
    },
    "admin": {
        "read": True,
        "write": True,
        "approve": True,
        "export": True,
        "sign": True,
        "manage_users": True,
        "manage_tenant": True,
    },
}


def new_tenant_doc(
    name: str,
    slug: str,
    institution_type: str = "primarie",
    config: Optional[Dict[str, Any]] = None,
) -> dict:
    """Build a new tenant document ready for MongoDB insertion."""
    return {
        "name": name,
        "slug": slug.lower().strip(),
        "institution_type": institution_type,
        "config": config or {},          # per-tenant vertical overrides live here
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


def new_user_doc(
    name: str,
    email: str,
    password_hash: str,
    tenant_id: ObjectId,
    role: str = "clerk",
    company: Optional[str] = None,
) -> dict:
    """Build a new user document with tenant + role embedded."""
    now = datetime.now(timezone.utc)
    return {
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "company": company,
        "tenant_id": tenant_id,
        "role": role,
        "plan": "enterprise",           # on-premise = always enterprise tier
        "is_verified": True,            # on-premise: admin provisions users
        "is_active": True,
        "meetings_used_this_month": 0,
        "last_monthly_reset": now,
        "created_at": now,
        "updated_at": now,
    }
