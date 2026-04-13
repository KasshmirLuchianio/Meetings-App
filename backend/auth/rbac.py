"""
RBAC — Role-Based Access Control
JWT-claims-based authorization for all protected routes.

Usage:
    @router.get("/...")
    async def endpoint(user = Depends(require_role("secretary", "admin"))):
        ...
"""
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId

from config import settings
from db.collections import users_col
from models.tenant import ROLE_PERMISSIONS

security = HTTPBearer()


# ── JWT helpers ────────────────────────────────────────────────────────────────

def create_token(user_id: str, email: str, tenant_id: str, role: str) -> str:
    """Issue a JWT with tenant + role embedded."""
    from datetime import datetime, timezone, timedelta
    payload = {
        "sub": user_id,
        "email": email,
        "tenant_id": tenant_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Decode JWT and return the full user document from MongoDB.
    Attaches tenant_id and role to the returned dict even if the DB doc
    is missing them (safety net during migration window).
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirat — reconectează-te")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalid")

    tenant_id = payload.get("tenant_id")
    role = payload.get("role", "clerk")

    if not tenant_id:
        raise HTTPException(
            status_code=401,
            detail="Token vechi — te rugăm să te reconectezi pentru a continua.",
        )

    try:
        user = await users_col().find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalid")

    if not user:
        raise HTTPException(status_code=401, detail="Utilizator inexistent")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Contul a fost dezactivat")

    # Ensure tenant_id and role are always present on the returned user dict
    user["tenant_id"] = ObjectId(tenant_id) if not isinstance(tenant_id, ObjectId) else tenant_id
    user["role"] = role
    return user


# ── Role enforcement ───────────────────────────────────────────────────────────

def require_role(*roles: str):
    """
    Dependency factory.  Returns a FastAPI Depends that passes only if the
    current user's role is in the allowed list.

    Example:
        Depends(require_role("secretary", "admin"))
    """
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Acces interzis. Rol necesar: {', '.join(roles)}.",
            )
        return user
    return _check


def require_permission(permission: str):
    """
    Dependency factory — check a specific permission key from ROLE_PERMISSIONS.

    Example:
        Depends(require_permission("sign"))
    """
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "clerk")
        perms = ROLE_PERMISSIONS.get(role, {})
        if not perms.get(permission, False):
            raise HTTPException(
                status_code=403,
                detail=f"Permisiune lipsă: '{permission}'.",
            )
        return user
    return _check


def require_tenant_member():
    """
    Verifies that the authenticated user belongs to the same tenant as the
    resource being accessed.  Used together with verify_meeting_ownership.
    """
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if not user.get("tenant_id"):
            raise HTTPException(status_code=403, detail="Tenant neidentificat")
        return user
    return _check
