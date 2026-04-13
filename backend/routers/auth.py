"""
Auth router — /api/auth/*
Handles: register (admin-only), login, refresh, forgot/reset password,
         email verification, resend verification, /me, /usage.
"""
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth.rbac import create_token, get_current_user, require_role
from config import settings
from db.collections import users_col, tenants_col
from models.tenant import new_user_doc, ROLES
from notifications.email import send_email, build_verification_html, build_reset_html

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


# ── Helpers ────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _user_response(user: dict, token: str) -> dict:
    """Serialize user + token for login/register responses."""
    return {
        "token": token,
        "user": {
            "_id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user["email"],
            "company": user.get("company"),
            "role": user.get("role", "clerk"),
            "tenant_id": str(user.get("tenant_id", "")),
            "plan": user.get("plan", "enterprise"),
            "meetings_used_this_month": user.get("meetings_used_this_month", 0),
            "created_at": (
                user["created_at"].isoformat()
                if isinstance(user.get("created_at"), datetime)
                else str(user.get("created_at", ""))
            ),
        },
    }


# ── Models ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "clerk"
    tenant_id: Optional[str] = None   # admin provides this; if omitted, uses own tenant
    company: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResendVerificationRequest(BaseModel):
    email: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/register")
async def auth_register(request: Request, req: RegisterRequest):
    """
    Register a new user.

    On-premise mode (ALLOW_SELF_REGISTER=false):
        Only admins can create users.  Caller must include a valid admin JWT.

    Cloud/SaaS mode (ALLOW_SELF_REGISTER=true):
        Anyone can register; they get assigned to the default tenant.
    """
    if req.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rol invalid. Valori acceptate: {ROLES}")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă minim 6 caractere")

    # Resolve tenant
    if req.tenant_id:
        try:
            tenant = await tenants_col().find_one({"_id": ObjectId(req.tenant_id)})
        except Exception:
            raise HTTPException(status_code=400, detail="tenant_id invalid")
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant negăsit")
        tenant_id = tenant["_id"]
    else:
        # Use default tenant
        tenant = await tenants_col().find_one({"slug": "default"})
        if not tenant:
            raise HTTPException(status_code=500, detail="Tenant implicit lipsă — rulați migrarea 002.")
        tenant_id = tenant["_id"]

    # Check email uniqueness within tenant
    existing = await users_col().find_one({"email": req.email, "tenant_id": tenant_id})
    if existing:
        raise HTTPException(status_code=400, detail="Email deja înregistrat în această instituție")

    user_doc = new_user_doc(
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        tenant_id=tenant_id,
        role=req.role,
        company=req.company,
    )
    result = await users_col().insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    token = create_token(str(result.inserted_id), req.email, str(tenant_id), req.role)
    return _user_response(user_doc, token)


@router.post("/login")
async def auth_login(request: Request, req: LoginRequest):
    """Login with email + password. Returns JWT with tenant + role."""
    # Email can exist in multiple tenants; find most-recently-created active one
    user = await users_col().find_one(
        {"email": req.email, "is_active": {"$ne": False}},
        sort=[("created_at", -1)],
    )
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email sau parolă incorectă")

    tenant_id = str(user.get("tenant_id", ""))
    role = user.get("role", "clerk")
    token = create_token(str(user["_id"]), req.email, tenant_id, role)
    return _user_response(user, token)


@router.post("/refresh")
async def auth_refresh(req: RefreshRequest):
    """Re-issue a JWT that is still valid (extends session)."""
    import jwt as pyjwt
    try:
        payload = pyjwt.decode(req.token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user = await users_col().find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizator inexistent")
        tenant_id = payload.get("tenant_id", str(user.get("tenant_id", "")))
        role = payload.get("role", user.get("role", "clerk"))
        new_token = create_token(str(user["_id"]), user["email"], tenant_id, role)
        return {"token": new_token}
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirat — reconectează-te")
    except (pyjwt.InvalidTokenError, Exception):
        raise HTTPException(status_code=401, detail="Token invalid")


@router.get("/me")
async def auth_me(user: dict = Depends(get_current_user)):
    """Return current user profile."""
    return {
        "user": {
            "_id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user["email"],
            "company": user.get("company"),
            "role": user.get("role", "clerk"),
            "tenant_id": str(user.get("tenant_id", "")),
            "plan": user.get("plan", "enterprise"),
            "meetings_used_this_month": user.get("meetings_used_this_month", 0),
            "created_at": (
                user["created_at"].isoformat()
                if isinstance(user.get("created_at"), datetime)
                else str(user.get("created_at", ""))
            ),
        }
    }


@router.get("/usage")
async def get_user_usage(user: dict = Depends(get_current_user)):
    """Usage stats for current user."""
    limit = settings.LICENSE_MAX_MEETINGS_PER_MONTH
    used = user.get("meetings_used_this_month", 0)
    return {
        "plan": user.get("plan", "enterprise"),
        "role": user.get("role", "clerk"),
        "meetings_used": used,
        "meetings_limit": limit,
        "meetings_remaining": (limit - used) if limit != -1 else -1,
        "percentage": round((used / limit) * 100, 1) if limit > 0 else 0,
    }


# ── Password reset ─────────────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(request: Request, req: ForgotPasswordRequest):
    """Send password reset email. Always returns success to prevent enumeration."""
    user = await users_col().find_one({"email": req.email})
    if not user:
        return {"message": "Dacă adresa există, vei primi un email de resetare."}

    reset_token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)

    await users_col().update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": reset_token, "reset_token_expires": expires}},
    )

    try:
        html = build_reset_html(reset_token[:8])
        send_email(
            to=req.email,
            subject=f"Resetare parolă — {settings.INSTITUTION_NAME}",
            html=html,
        )
    except Exception as e:
        print(f"[AUTH] Failed to send reset email: {e}")

    return {"message": "Dacă adresa există, vei primi un email de resetare."}


@router.post("/reset-password")
async def reset_password(request: Request, req: ResetPasswordRequest):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă minim 6 caractere")

    user = await users_col().find_one({"reset_token": {"$regex": f"^{re.escape(req.token)}"}})
    if not user:
        raise HTTPException(status_code=400, detail="Cod invalid sau expirat")

    expires = user.get("reset_token_expires")
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Cod expirat. Solicită un nou email.")

    await users_col().update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(req.new_password)},
            "$unset": {"reset_token": "", "reset_token_expires": ""},
        },
    )
    return {"message": "Parola a fost resetată cu succes."}


# ── Email verification ─────────────────────────────────────────────────────────

@router.get("/verify")
async def verify_email(token: str = Query(...)):
    user = await users_col().find_one({"verify_token": token})
    if not user:
        return HTMLResponse("<h2>Link expirat sau invalid</h2>", status_code=400)

    expires = user.get("verify_token_expires")
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            return HTMLResponse("<h2>Link expirat</h2>", status_code=400)

    await users_col().update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True}, "$unset": {"verify_token": "", "verify_token_expires": ""}},
    )
    return HTMLResponse(f"<h1>Cont confirmat! Deschide {settings.INSTITUTION_NAME}.</h1>")


@router.post("/resend-verification")
async def resend_verification(req: ResendVerificationRequest):
    user = await users_col().find_one({"email": req.email})
    if not user:
        return {"message": "Dacă adresa există, vei primi un email de confirmare."}
    if user.get("is_verified"):
        return {"message": "Contul este deja verificat."}

    verify_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await users_col().update_one(
        {"_id": user["_id"]},
        {"$set": {
            "verify_token": verify_token,
            "verify_token_expires": now + timedelta(hours=24),
        }},
    )

    try:
        html = build_verification_html(verify_token)
        send_email(req.email, f"Confirmă contul — {settings.INSTITUTION_NAME}", html)
    except Exception as e:
        print(f"[AUTH] Resend verification failed: {e}")
        raise HTTPException(status_code=500, detail="Eroare la trimiterea emailului.")

    return {"message": "Email de confirmare retrimis."}
