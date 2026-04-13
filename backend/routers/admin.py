"""
Admin router — /api/admin/*
Tenant management, user provisioning, user deactivation.
All endpoints require role=admin.
"""
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth.rbac import get_current_user, require_role
from db.collections import users_col, tenants_col, meetings_col
from models.tenant import new_tenant_doc, new_user_doc, ROLES, INSTITUTION_TYPES

router = APIRouter(prefix="/api/admin", tags=["admin"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def serialize_doc(doc):
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == "password_hash":
            continue  # never expose hashes
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result


# ── Tenant management (super-admin) ───────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    slug: str
    institution_type: str = "primarie"
    config: Optional[dict] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    institution_type: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[dict] = None


@router.get("/tenants")
async def list_tenants(admin: dict = Depends(require_role("admin"))):
    """List all tenants. Only admins of the default tenant (platform admins) should call this."""
    docs = []
    async for doc in tenants_col().find({}).sort("name", 1):
        docs.append(serialize_doc(doc))
    return {"tenants": docs}


@router.post("/tenants")
async def create_tenant(data: TenantCreate, admin: dict = Depends(require_role("admin"))):
    if data.institution_type not in INSTITUTION_TYPES:
        raise HTTPException(status_code=400, detail=f"Tip instituție invalid: {INSTITUTION_TYPES}")
    existing = await tenants_col().find_one({"slug": data.slug.lower().strip()})
    if existing:
        raise HTTPException(status_code=409, detail="Slug deja folosit")
    doc = new_tenant_doc(
        name=data.name,
        slug=data.slug,
        institution_type=data.institution_type,
        config=data.config,
    )
    result = await tenants_col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.patch("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    data: TenantUpdate,
    admin: dict = Depends(require_role("admin")),
):
    update: dict = {"updated_at": datetime.now(timezone.utc)}
    if data.name is not None:
        update["name"] = data.name
    if data.institution_type is not None:
        if data.institution_type not in INSTITUTION_TYPES:
            raise HTTPException(status_code=400, detail="Tip instituție invalid")
        update["institution_type"] = data.institution_type
    if data.is_active is not None:
        update["is_active"] = data.is_active
    if data.config is not None:
        update["config"] = data.config

    try:
        result = await tenants_col().update_one({"_id": ObjectId(tenant_id)}, {"$set": update})
    except Exception:
        raise HTTPException(status_code=400, detail="tenant_id invalid")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant negăsit")
    updated = await tenants_col().find_one({"_id": ObjectId(tenant_id)})
    return serialize_doc(updated)


# ── User management (tenant admin) ────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "clerk"
    company: Optional[str] = None
    tenant_id: Optional[str] = None  # if omitted, uses admin's tenant


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    company: Optional[str] = None


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(require_role("admin")),
):
    """List users in the admin's tenant."""
    query = {"tenant_id": admin["tenant_id"]}
    skip = (page - 1) * limit
    total = await users_col().count_documents(query)
    docs = []
    async for doc in users_col().find(query).sort("created_at", -1).skip(skip).limit(limit):
        docs.append(serialize_doc(doc))
    return {"users": docs, "total": total, "page": page, "limit": limit,
            "pages": (total + limit - 1) // limit}


@router.post("/users")
async def create_user(data: UserCreate, admin: dict = Depends(require_role("admin"))):
    if data.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rol invalid: {ROLES}")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă minim 6 caractere")

    # Resolve target tenant
    if data.tenant_id:
        try:
            tenant = await tenants_col().find_one({"_id": ObjectId(data.tenant_id)})
        except Exception:
            raise HTTPException(status_code=400, detail="tenant_id invalid")
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant negăsit")
        target_tenant_id = tenant["_id"]
    else:
        target_tenant_id = admin["tenant_id"]

    existing = await users_col().find_one({"email": data.email, "tenant_id": target_tenant_id})
    if existing:
        raise HTTPException(status_code=409, detail="Email deja înregistrat în această instituție")

    user_doc = new_user_doc(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        tenant_id=target_tenant_id,
        role=data.role,
        company=data.company,
    )
    result = await users_col().insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return serialize_doc(user_doc)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    admin: dict = Depends(require_role("admin")),
):
    try:
        target = await users_col().find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="user_id invalid")
    if not target:
        raise HTTPException(status_code=404, detail="Utilizator negăsit")
    if str(target.get("tenant_id", "")) != str(admin["tenant_id"]):
        raise HTTPException(status_code=403, detail="Nu poți modifica utilizatori din alt tenant")

    update: dict = {"updated_at": datetime.now(timezone.utc)}
    if data.name is not None:
        update["name"] = data.name
    if data.role is not None:
        if data.role not in ROLES:
            raise HTTPException(status_code=400, detail=f"Rol invalid: {ROLES}")
        update["role"] = data.role
    if data.is_active is not None:
        update["is_active"] = data.is_active
    if data.company is not None:
        update["company"] = data.company

    await users_col().update_one({"_id": ObjectId(user_id)}, {"$set": update})
    updated = await users_col().find_one({"_id": ObjectId(user_id)})
    return serialize_doc(updated)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_role("admin"))):
    try:
        target = await users_col().find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="user_id invalid")
    if not target:
        raise HTTPException(status_code=404, detail="Utilizator negăsit")
    if str(target.get("tenant_id", "")) != str(admin["tenant_id"]):
        raise HTTPException(status_code=403, detail="Nu poți șterge utilizatori din alt tenant")
    if str(target["_id"]) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Nu te poți șterge pe tine însuți")
    await users_col().delete_one({"_id": ObjectId(user_id)})
    return {"status": "deleted", "user_id": user_id}


# ── Stats ──────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def tenant_stats(admin: dict = Depends(require_role("admin"))):
    """Basic usage stats for the admin's tenant."""
    tenant_id = admin["tenant_id"]
    total_meetings = await meetings_col().count_documents({"tenant_id": tenant_id})
    total_users = await users_col().count_documents({"tenant_id": tenant_id})
    done_meetings = await meetings_col().count_documents({"tenant_id": tenant_id, "status": "done"})
    error_meetings = await meetings_col().count_documents({"tenant_id": tenant_id, "status": "error"})

    return {
        "tenant_id": str(tenant_id),
        "total_meetings": total_meetings,
        "done_meetings": done_meetings,
        "error_meetings": error_meetings,
        "total_users": total_users,
    }
