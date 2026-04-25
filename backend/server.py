import os
import json
import uuid
import re
import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from io import BytesIO
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import aiofiles
import stripe
import jwt
import bcrypt
import resend
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

load_dotenv()

# ==================== CONFIG ====================
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017/gal_meetings")
DB_NAME = os.environ.get("DB_NAME", "gal_meetings")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# ==================== STRIPE ====================
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICES = {
    "pro_monthly": "price_1TIOnGHa4KY3ww8wNuZfnCvN",
    "pro_yearly": "price_1TIOneHa4KY3ww8wkmyVhjDP",
    "enterprise_monthly": "price_1TIOnuHa4KY3ww8wYMLsIRIw",
    "enterprise_yearly": "price_1TIOoCHa4KY3ww8wjDYteZ14",
}

# ==================== RESEND (Email) ====================
resend.api_key = os.environ.get("RESEND_API_KEY")

# CORS Origins - includes Expo development
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",                         # Web dev
    "https://*.onrender.com",                         # Render preview
    "https://meetings.ro",                           # Production web
    "exp://192.168.*",                               # Expo Go LAN (iOS/Android)
    "exp://localhost:19000",                         # Expo dev server
    "capacitor://localhost",                         # Capacitor (if needed)
]

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ==================== APP ====================
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Meetings.ro API", version="1.0.0")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Prea multe cereri. Încearcă din nou mai târziu."}
    )

ALLOWED_ORIGINS = [
    "https://meetings-ro-api.onrender.com",
    "http://localhost:8081",
    "exp://localhost:8081",
    "exp://192.168.*",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges"],
)

# ==================== AUTH CONFIG ====================
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72  # 3 days

# ==================== PLAN LIMITS ====================
PLAN_LIMITS = {
    "free": 5,
    "pro": 100,
    "enterprise": -1,
}

# ==================== DATABASE ====================
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
meetings_col = db["meetings"]
localities_col = db["localities"]
users_col = db["users"]
tenants_col = db["tenants"]
invitations_col = db["invitations"]


# ==================== AUTH HELPERS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str, email: str) -> str:
    from datetime import timedelta
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Extract and validate JWT from Authorization header (FastAPI Depends pattern)."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await users_col.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizator inexistent")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirat")
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(status_code=401, detail="Token invalid")


async def verify_meeting_ownership(meeting_id: str, user: dict) -> dict:
    """Fetch meeting and verify access (owner, same tenant, or admin). Returns meeting doc."""
    try:
        meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID meeting invalid")
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")

    # Admin role bypasses ownership checks
    user_role = user.get("role", "member")
    if user_role == "admin":
        return meeting

    user_id = str(user["_id"])
    user_tenant = str(user["tenant_id"]) if user.get("tenant_id") else None
    meeting_user = meeting.get("user_id")
    meeting_tenant = meeting.get("tenant_id")

    # Owner match
    if meeting_user and meeting_user == user_id:
        return meeting

    # Same tenant match (for enterprise multi-user scenarios)
    if user_tenant and meeting_tenant and user_tenant == meeting_tenant:
        return meeting

    raise HTTPException(status_code=403, detail="Nu ai acces la această ședință")


def build_meetings_scope_query(user: dict) -> dict:
    """Build a MongoDB query that scopes meetings to what the user can see.
    - admin: sees all
    - enterprise members (with tenant_id): see tenant-wide meetings
    - regular users: see only their own meetings
    """
    user_role = user.get("role", "member")
    if user_role == "admin":
        return {}

    user_id = str(user["_id"])
    user_tenant = str(user["tenant_id"]) if user.get("tenant_id") else None

    if user_tenant:
        # Enterprise user — see own meetings OR any meeting in same tenant
        return {"$or": [
            {"user_id": user_id},
            {"tenant_id": user_tenant},
        ]}

    # Solo user — own meetings only
    return {"user_id": user_id}


def require_role(*allowed_roles: str):
    """Dependency factory: require user to have one of the given roles (or be admin)."""
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "member")
        if role == "admin" or role in allowed_roles:
            return user
        raise HTTPException(
            status_code=403,
            detail=f"Acțiune restricționată. Necesită unul din rolurile: {', '.join(allowed_roles)}"
        )
    return checker


# ==================== PLAN LIMIT HELPERS ====================
async def reset_monthly_if_needed(user: dict) -> dict:
    """Reset meetings_used_this_month if we're in a new month."""
    last_reset = user.get("last_monthly_reset")
    now = datetime.now(timezone.utc)
    if last_reset is None or (isinstance(last_reset, datetime) and (last_reset.month != now.month or last_reset.year != now.year)):
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"meetings_used_this_month": 0, "last_monthly_reset": now}}
        )
        user["meetings_used_this_month"] = 0
        user["last_monthly_reset"] = now
    return user


async def check_plan_limit(user: dict):
    """Check if user has reached their plan limit. Raises 402 if exceeded."""
    user = await reset_monthly_if_needed(user)
    plan = user.get("plan", "FREE").lower()
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    if limit == -1:
        return  # unlimited
    used = user.get("meetings_used_this_month", 0)
    if used >= limit:
        raise HTTPException(
            status_code=402,
            detail=f"Ai atins limita de {limit} întâlniri/lună pentru planul tău. Fă upgrade pentru mai multe."
        )


async def increment_usage(user_id) -> None:
    """Increment meetings_used_this_month for a user."""
    await users_col.update_one(
        {"_id": user_id},
        {"$inc": {"meetings_used_this_month": 1}}
    )


# ==================== EMAIL HELPERS ====================
def build_verification_email(verify_token: str) -> str:
    """Build HTML for verification email."""
    return f"""
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1B2A4A; font-size: 24px;">Bun venit la Meetings.ro</h1>
        <p style="color: #444; font-size: 16px;">Confirmă adresa de email pentru a activa contul tău.</p>
        <a href="https://meetings-ro-api.onrender.com/api/auth/verify?token={verify_token}"
           style="display:inline-block; background:#1B2A4A; color:#FAF8F3; padding:14px 28px;
                  border-radius:8px; text-decoration:none; font-size:16px; margin: 20px 0;">
            Confirmă contul
        </a>
        <p style="color:#888; font-size:13px;">Link-ul expiră în 24 de ore.</p>
        <hr style="border:none; border-top:1px solid #eee; margin: 30px 0;">
        <p style="color:#888; font-size:12px;">Meetings.ro — Transcriere și sinteză AI pentru orice domeniu</p>
    </div>
    """


def send_verification_email(email: str, verify_token: str):
    """Send verification email via Resend."""
    print(f"[EMAIL] RESEND_API_KEY present: {bool(os.environ.get('RESEND_API_KEY'))}")
    params: resend.Emails.SendParams = {
        "from": "Meetings.ro <onboarding@resend.dev>",
        "to": [email],
        "subject": "Confirmă contul tău Meetings.ro",
        "html": build_verification_email(verify_token),
    }
    email_response = resend.Emails.send(params)
    print(f"[EMAIL] Sent to {email}: {email_response}")


# ==================== HELPERS ====================
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else (str(v) if isinstance(v, ObjectId) else v) for v in value]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result


async def ensure_indexes():
    """Create MongoDB indexes."""
    await meetings_col.create_index("locality")
    await meetings_col.create_index("status")
    await meetings_col.create_index("created_at")
    await meetings_col.create_index([("title", "text"), ("transcript", "text"), ("locality", "text")])


# Default localities (folders)
DEFAULT_LOCALITIES = ["Chilia Veche", "Crișan", "C.A.Rosetti", "Maliuc", "Beștepe"]


async def seed_default_localities():
    """Ensure default locality folders exist."""
    for name in DEFAULT_LOCALITIES:
        await localities_col.update_one(
            {"name": name},
            {"$setOnInsert": {"name": name, "created_at": datetime.now(timezone.utc), "is_default": True}},
            upsert=True
        )
    print(f"[GAL] Default localities seeded: {DEFAULT_LOCALITIES}")


async def create_demo_account():
    """Create a demo account for Apple Review if it doesn't exist."""
    demo_email = "demo@meetings.ro"
    existing = await users_col.find_one({"email": demo_email})
    if not existing:
        await users_col.insert_one({
            "email": demo_email,
            "password_hash": hash_password("Demo2026!"),
            "name": "Demo User",
            "plan": "PRO",
            "is_verified": True,
            "meetings_used_this_month": 0,
            "last_monthly_reset": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        })
        print("[DEMO] Demo account created: demo@meetings.ro / Demo2026!")


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    # User indexes
    await users_col.create_index("email", unique=True)
    await users_col.create_index("reset_token", sparse=True)
    await users_col.create_index("verify_token", sparse=True)
    # Meeting indexes for user-scoped queries
    await meetings_col.create_index("user_id")
    await meetings_col.create_index([("user_id", 1), ("created_at", -1)])
    await meetings_col.create_index("tenant_id", sparse=True)
    await users_col.create_index("tenant_id", sparse=True)
    # Tenants + Invitations indexes
    await tenants_col.create_index("created_by")
    await invitations_col.create_index("token", unique=True)
    await invitations_col.create_index("expires_at", expireAfterSeconds=0)
    await seed_default_localities()
    await create_demo_account()
    print("[Meetings.ro] Server started. Indexes ensured.")


# ==================== AUTH ENDPOINTS ====================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    company: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def auth_register(request: Request, req: RegisterRequest):
    """Register a new user with email verification."""
    # Check if email already exists
    existing = await users_col.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email deja înregistrat")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă minim 6 caractere")

    # Generate verification token
    verify_token = secrets.token_urlsafe(32)

    now = datetime.now(timezone.utc)
    user_doc = {
        "name": req.name,
        "email": req.email,
        "password_hash": hash_password(req.password),
        "company": req.company,
        "plan": "FREE",
        "role": "member",
        "tenant_id": None,
        "is_verified": True,
        "meetings_used_this_month": 0,
        "last_monthly_reset": now,
        "created_at": now,
    }
    result = await users_col.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Auto-login: return token + user directly
    token = create_token(user_id, req.email)

    return {
        "token": token,
        "user": {
            "_id": user_id,
            "name": req.name,
            "email": req.email,
            "company": req.company,
            "plan": "FREE",
            "role": "member",
            "tenant_id": None,
            "meetings_used_this_month": 0,
            "created_at": now.isoformat(),
        }
    }


@app.post("/api/auth/login")
@limiter.limit("10/minute")
async def auth_login(request: Request, req: LoginRequest):
    """Login with email and password."""
    user = await users_col.find_one({"email": req.email})
    if not user:
        raise HTTPException(status_code=401, detail="Email sau parolă incorectă")

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email sau parolă incorectă")

    # Auto-verify unverified accounts (Resend sandbox can't deliver to all emails)
    if not user.get("is_verified", False):
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"is_verified": True}}
        )

    user_id = str(user["_id"])
    token = create_token(user_id, req.email)

    return {
        "token": token,
        "user": {
            "_id": user_id,
            "name": user.get("name", ""),
            "email": user["email"],
            "company": user.get("company"),
            "plan": user.get("plan", "FREE"),
            "role": user.get("role", "member"),
            "tenant_id": str(user["tenant_id"]) if user.get("tenant_id") else None,
            "meetings_used_this_month": user.get("meetings_used_this_month", 0),
            "created_at": user["created_at"].isoformat() if isinstance(user.get("created_at"), datetime) else str(user.get("created_at", "")),
        }
    }


# ---- ADMIN: Require admin role ----
async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires the user to have admin role."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acces permis doar administratorilor")
    return user


@app.delete("/api/admin/delete-user")
async def admin_delete_user(email: str = Query(...), admin: dict = Depends(require_admin)):
    """Delete a user by email. Requires admin role."""
    result = await users_col.delete_one({"email": email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User {email} deleted", "deleted": result.deleted_count}


@app.delete("/api/admin/delete-all-users")
async def admin_delete_all_users(admin: dict = Depends(require_admin)):
    """Delete ALL users. Requires admin role."""
    result = await users_col.delete_many({})
    return {"message": f"All users deleted", "deleted": result.deleted_count}


@app.get("/api/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    return {
        "user": {
            "_id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user["email"],
            "company": user.get("company"),
            "plan": user.get("plan", "FREE"),
            "meetings_used_this_month": user.get("meetings_used_this_month", 0),
            "created_at": user["created_at"].isoformat() if isinstance(user.get("created_at"), datetime) else str(user.get("created_at", "")),
        }
    }


# ==================== TOKEN REFRESH ====================

class RefreshRequest(BaseModel):
    token: str


@app.post("/api/auth/refresh")
async def auth_refresh(req: RefreshRequest):
    """Refresh an expiring JWT token. Returns new token if current one is still valid."""
    try:
        payload = jwt.decode(req.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await users_col.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizator inexistent")
        new_token = create_token(str(user["_id"]), user["email"])
        return {"token": new_token}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirat — reconectează-te")
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(status_code=401, detail="Token invalid")


# ==================== PASSWORD RESET ====================

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@app.post("/api/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, req: ForgotPasswordRequest):
    """Send a password reset email. Always returns success to prevent email enumeration."""
    user = await users_col.find_one({"email": req.email})
    if not user:
        return {"message": "Dacă adresa există, vei primi un email de resetare."}

    reset_token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)

    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": reset_token, "reset_token_expires": expires}}
    )

    # Send reset email via Resend
    try:
        reset_html = f"""
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1B2A4A; font-size: 24px;">Resetare parolă</h1>
            <p style="color: #444; font-size: 16px;">Ai solicitat resetarea parolei pentru contul tău Meetings.ro.</p>
            <p style="color: #444; font-size: 16px;">Folosește codul de mai jos în aplicație:</p>
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 28px; font-weight: bold; color: #1B2A4A; letter-spacing: 2px;">{reset_token[:8]}</span>
            </div>
            <p style="color:#888; font-size:13px;">Codul expiră în 1 oră.</p>
            <hr style="border:none; border-top:1px solid #eee; margin: 30px 0;">
            <p style="color:#888; font-size:12px;">Meetings.ro — Transcriere și sinteză AI pentru orice domeniu</p>
        </div>
        """
        params: resend.Emails.SendParams = {
            "from": "Meetings.ro <onboarding@resend.dev>",
            "to": [req.email],
            "subject": "Resetare parolă Meetings.ro",
            "html": reset_html,
        }
        resend.Emails.send(params)
    except Exception as e:
        print(f"[PASSWORD RESET] Failed to send reset email: {e}")

    return {"message": "Dacă adresa există, vei primi un email de resetare."}


@app.post("/api/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, req: ResetPasswordRequest):
    """Reset password using a valid reset token."""
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă minim 6 caractere")

    # Find user by reset_token (match first 8 chars or full token)
    user = await users_col.find_one({"reset_token": {"$regex": f"^{re.escape(req.token)}"}})
    if not user:
        raise HTTPException(status_code=400, detail="Cod invalid sau expirat")

    # Check expiry
    expires = user.get("reset_token_expires")
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Cod expirat. Solicită un nou email de resetare.")

    # Update password and clear reset token
    await users_col.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(req.new_password)},
            "$unset": {"reset_token": "", "reset_token_expires": ""}
        }
    )

    return {"message": "Parola a fost resetată cu succes. Te poți autentifica."}


# ==================== EMAIL VERIFICATION ENDPOINTS ====================

@app.get("/api/auth/verify")
async def verify_email(token: str = Query(...)):
    """Verify user email via token link."""
    try:
        user = await users_col.find_one({
            "verify_token": token,
        })
        if not user:
            return HTMLResponse("""
                <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#FAF8F3">
                <h2 style="color:#1B2A4A">Link expirat sau invalid</h2>
                <p>Solicită un nou email de confirmare din aplicație.</p>
                </body></html>
            """, status_code=400)

        # Check expiration (handle both aware and naive datetimes from MongoDB)
        expires = user.get("verify_token_expires")
        if expires and isinstance(expires, datetime):
            now = datetime.now(timezone.utc)
            # Make expires timezone-aware if it's naive (MongoDB can return naive datetimes)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if now > expires:
                return HTMLResponse("""
                    <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#FAF8F3">
                    <h2 style="color:#1B2A4A">Link expirat</h2>
                    <p>Solicită un nou email de confirmare din aplicație.</p>
                    </body></html>
                """, status_code=400)

        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"is_verified": True}, "$unset": {"verify_token": "", "verify_token_expires": ""}}
        )
        return HTMLResponse("""
            <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#FAF8F3">
            <h1 style="color:#1B2A4A">✓ Cont confirmat!</h1>
            <p style="color:#444;font-size:18px">Contul tău Meetings.ro este activ.</p>
            <p style="color:#888">Deschide aplicația și conectează-te.</p>
            </body></html>
        """)
    except Exception as e:
        print(f"[VERIFY ERROR] {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))


class ResendVerificationRequest(BaseModel):
    email: str


@app.post("/api/auth/resend-verification")
async def resend_verification(req: ResendVerificationRequest):
    """Resend verification email. Rate limited: max 3/hour per email."""
    user = await users_col.find_one({"email": req.email})
    if not user:
        # Don't reveal if email exists
        return {"message": "Dacă adresa există, vei primi un email de confirmare."}

    if user.get("is_verified", False):
        return {"message": "Contul este deja verificat. Te poți autentifica."}

    # Rate limit: max 3 emails per hour
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)
    sent_times = user.get("verification_emails_sent", [])
    recent_sends = [t for t in sent_times if isinstance(t, datetime) and t > one_hour_ago]

    if len(recent_sends) >= 3:
        raise HTTPException(
            status_code=429,
            detail="Prea multe încercări. Așteaptă o oră înainte de a solicita un alt email."
        )

    # Generate new token
    verify_token = secrets.token_urlsafe(32)

    await users_col.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "verify_token": verify_token,
                "verify_token_expires": now + timedelta(hours=24),
            },
            "$push": {
                "verification_emails_sent": now,
            }
        }
    )

    # Send email
    try:
        send_verification_email(req.email, verify_token)
    except Exception as e:
        print(f"[Resend] Failed to resend verification to {req.email}: {e}")
        raise HTTPException(status_code=500, detail="Eroare la trimiterea emailului. Încearcă din nou.")

    return {"message": "Email de confirmare retrimis. Verifică inbox-ul."}


# ==================== DELETE ACCOUNT ====================

@app.delete("/api/auth/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account and all associated data. Required by Apple App Store."""
    import shutil
    user_id = str(current_user["_id"])

    # Delete all user's meetings
    await meetings_col.delete_many({"user_id": user_id})

    # Delete user record
    await users_col.delete_one({"_id": current_user["_id"]})

    # Delete uploaded audio files
    user_uploads_path = UPLOAD_DIR / user_id
    if user_uploads_path.exists():
        shutil.rmtree(str(user_uploads_path), ignore_errors=True)

    return {"message": "Contul și toate datele asociate au fost șterse definitiv."}


# ==================== PUSH NOTIFICATIONS ====================

class PushTokenRequest(BaseModel):
    token: str

@app.post("/api/users/push-token")
async def save_push_token(req: PushTokenRequest, current_user: dict = Depends(get_current_user)):
    """Save Expo push token for the current user."""
    await users_col.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"push_token": req.token}}
    )
    return {"ok": True}


async def notify_user_meeting_done(user_id: str, meeting_title: str):
    """Send push notification when meeting processing is complete."""
    try:
        user = await users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            return
        push_token = user.get("push_token")
        if not push_token:
            return
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post("https://exp.host/--/api/v2/push/send", json={
                "to": push_token,
                "title": "Raport gata",
                "body": f"{meeting_title or 'Întâlnirea ta'} a fost procesată.",
                "sound": "default",
            })
    except Exception as e:
        print(f"[Push] Failed to send notification: {e}")


# ==================== USAGE ENDPOINT ====================
@app.get("/api/users/me/usage")
async def get_user_usage(user: dict = Depends(get_current_user)):
    """Get current user's plan usage stats."""
    user = await reset_monthly_if_needed(user)
    plan = user.get("plan", "FREE")
    limit = PLAN_LIMITS.get(plan.lower(), PLAN_LIMITS["free"])
    used = user.get("meetings_used_this_month", 0)

    return {
        "plan": plan,
        "meetings_used": used,
        "meetings_limit": limit,  # -1 = unlimited
        "meetings_remaining": (limit - used) if limit != -1 else -1,
        "percentage": round((used / limit) * 100, 1) if limit > 0 else 0,
    }


# ==================== MODELS ====================
class ActionItemModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    completed: bool = False


class MeetingCreate(BaseModel):
    title: Optional[str] = None
    locality: Optional[str] = None
    vertical_type: Optional[str] = "GAL"


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    locality: Optional[str] = None


# ==================== DIARIZATION CONSTANTS ====================
MAX_DIARIZATION_CHUNK = 8000   # chars per Claude call
CHUNK_OVERLAP = 500            # overlap between chunks for context continuity

# TASK 1 — Engineered institutional diarization prompt
DIARIZATION_SYSTEM_PROMPT = """Ești un expert în analiza transcrierilor din ședințe oficiale românești.
Primești o transcriere cu timestamps dintr-o ședință instituțională (consiliu local, tribunal, spital, universitate, primărie).

SARCINA: Identifică cu precizie maximă fiecare schimbare de vorbitor și atribuie corect fiecare replică.

═══ REGULI DE IDENTIFICARE ════════════════════════════════════════

1. PREZENTĂRI EXPLICITE (prioritate maximă):
   - Dacă cineva spune "Eu sunt [Nume]", "Mă numesc [Nume]", "Din partea [instituției]" → folosește acel nume de acum încolo
   - Dacă menționează funcția: "în calitate de primar", "ca secretar general" → adaugă funcția în câmpul "role"
   - Dacă președintele ședinței se identifică la deschidere → păstrează-l ca speaker consistent

2. FRAZE DE TRANZIȚIE (indică schimbare de vorbitor):
   - "Vă mulțumesc", "Mulțumesc pentru cuvânt" → vorbitor curent cedează cuvântul
   - "Dacă îmi permiteți", "Solicit cuvântul", "Cer cuvântul" → vorbitor nou intră
   - "Domnul/Doamna [nume/funcție]" spus de altcineva → urmează intervenția acelei persoane
   - "Supun la vot", "Cine este pentru?", "Împotrivă?", "Abțineri?" → ÎNTOTDEAUNA președinte/primar
   - "Da / Nu / Abținere" ca răspuns izolat → consilier/participant care votează (nu schimbă speaker principal)

3. ROLURI INSTITUȚIONALE (deduse din context):
   - Cel care deschide ședința, citește ordinea de zi, conduce votul → Președinte ședință / Primar
   - Cel care citește un referat sau raport → Secretar / Director / Referent
   - Cei care intervin scurt cu "sunt de acord", "propun", "amendament" → Consilieri
   - Cel care consemnează ("Am înregistrat", "Se consemnează") → Secretar general

4. CONSISTENȚĂ (regula de aur):
   - Dacă ai identificat că Vorbitor 1 e primarul → ORICE frază de vot sau deschidere ulterioară = același Vorbitor 1
   - Nu schimba speaker dacă e aceeași persoană care continuă după o pauză scurtă (<3 secunde)
   - Dacă două segmente consecutive au același pattern de vorbire și nu există semnal de schimbare → același vorbitor

5. CÂND NU ȘTII:
   - Folosește Vorbitor N (număr incremental)
   - Nu inventa nume sau funcții
   - Nu modifica niciun cuvânt din transcriere

═══ STRUCTURI SPECIFICE DE ȘEDINȚĂ ════════════════════════════════

Ședință consiliu local: Primar (conduce) → Secretar (citește) → Consilieri (intervin) → Primar (vot)
Ședință tribunal: Judecător (conduce) → Grefier (consemnează) → Avocați → Părți
Ședință medicală: Director (conduce) → Medici șefi (raportează) → Personal (intervenții)

═══ FORMAT RĂSPUNS ═══════════════════════════════════════════════

Răspunde STRICT cu JSON valid — array de obiecte, fără text în afara JSON-ului:
[
  {
    "speaker": "Primar Ion Popescu",
    "role": "Primar",
    "timestamp": "00:00",
    "text": "Declar deschisă ședința ordinară a Consiliului Local..."
  }
]

REGULI FORMAT:
- "speaker": nume real dacă identificat, altfel "Vorbitor 1", "Vorbitor 2" etc.
- "role": funcția dacă identificată (ex: "Primar", "Secretar general", "Consilier"), altfel null
- "timestamp": MM:SS al primului segment din grupul de replici
- "text": textul exact din transcriere, grupat dacă același vorbitor continuă
- Grupează segmentele consecutive ale aceluiași vorbitor într-un singur obiect
- NU adăuga explicații, NU modifica textul transcrierii
"""


# ==================== AUDIO PREPROCESSING ====================
async def preprocess_audio(input_path: str) -> str:
    """
    TASK 5a — Normalize audio to 16kHz mono WAV using ffmpeg for optimal Whisper accuracy.
    Applies EBU R128 loudness normalization and resamples to 16kHz mono.
    Returns path to preprocessed WAV, or original path if ffmpeg fails/unavailable.
    """
    base = input_path.rsplit('.', 1)[0]
    output_path = f"{base}_preprocessed.wav"
    try:
        proc = await asyncio.create_subprocess_exec(
            'ffmpeg', '-y',
            '-i', input_path,
            '-ar', '16000',        # resample to 16kHz (Whisper native sample rate)
            '-ac', '1',            # mono channel
            '-af', 'loudnorm',     # EBU R128 loudness normalization
            '-f', 'wav',
            output_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        if proc.returncode == 0 and os.path.exists(output_path):
            print(f"[Preprocess] Audio normalized → {output_path}")
            return output_path
        else:
            print(f"[Preprocess] ffmpeg returned {proc.returncode}, using original file")
            return input_path
    except Exception as e:
        print(f"[Preprocess] ffmpeg error: {e} — using original file")
        return input_path


# ==================== AI CLIENTS ====================
# Groq for transcription (Whisper), OpenAI as fallback
groq_client = AsyncOpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
) if GROQ_API_KEY else None
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


# ==================== AI PROCESSING ====================
async def transcribe_audio(file_path: str) -> dict:
    """
    TASK 5b/5c — Transcribe audio using Groq Whisper (primary) or OpenAI Whisper (fallback).
    Requests word + segment timestamps for finer diarization alignment.
    Falls back to segment-only timestamps if word granularity is unsupported.
    """
    if groq_client:
        client = groq_client
        model = "whisper-large-v3"
        print("[Transcribe] Using Groq Whisper")
    elif openai_client:
        client = openai_client
        model = "whisper-1"
        print("[Transcribe] Using OpenAI Whisper")
    else:
        raise RuntimeError("Nicio cheie API pentru transcriere configurată (GROQ_API_KEY sau OPENAI_API_KEY)")

    WHISPER_PROMPT = (
        "Aceasta este o înregistrare a unei ședințe în limba română. "
        "Participanții vorbesc clar și discută subiecte profesionale."
    )

    # Try with word + segment timestamps first
    response = None
    try:
        with open(file_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                model=model,
                file=audio_file,
                response_format="verbose_json",
                language="ro",
                prompt=WHISPER_PROMPT,
                temperature=0.0,
                timestamp_granularities=["word", "segment"],
            )
        print("[Transcribe] Word-level timestamps requested")
    except Exception:
        # Fallback: segment timestamps only
        print("[Transcribe] Word timestamps not supported — falling back to segment-only")
        with open(file_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                model=model,
                file=audio_file,
                response_format="verbose_json",
                language="ro",
                prompt=WHISPER_PROMPT,
                temperature=0.0,
            )

    transcript_text = response.text
    segments = []
    words = []

    if hasattr(response, 'segments') and response.segments:
        for seg in response.segments:
            if isinstance(seg, dict):
                segments.append(seg)
            else:
                segments.append({
                    "start": getattr(seg, 'start', 0),
                    "end":   getattr(seg, 'end', 0),
                    "text":  getattr(seg, 'text', ''),
                })

    # Extract word-level timestamps when available (TASK 5c)
    if hasattr(response, 'words') and response.words:
        for w in response.words:
            if isinstance(w, dict):
                words.append(w)
            else:
                words.append({
                    "start": getattr(w, 'start', 0),
                    "end":   getattr(w, 'end', 0),
                    "word":  getattr(w, 'word', ''),
                })
        print(f"[Transcribe] Got {len(words)} word-level timestamps")

    return {"text": transcript_text, "segments": segments, "words": words}


# ==================== SPEAKER DIARIZATION ====================

async def extract_speaker_context(segments_text: str) -> str:
    """
    TASK 2 — First pass: cheap context extraction using claude-haiku-4-5.
    Identifies meeting type, named speakers, and speaker count estimate
    from the first 3000 chars. Returns JSON string injected into main pass.
    """
    try:
        response = await anthropic_client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=500,
            system=(
                "Ești un analizor de transcrieri. Extrage DOAR informațiile explicit menționate.\n"
                "Răspunde în JSON cu structura:\n"
                '{"meeting_type": "...", "speakers_identified": [{"name": "...", "role": "..."}], '
                '"total_speakers_estimate": N}'
            ),
            messages=[{
                "role": "user",
                "content": (
                    "Din această transcriere, extrage:\n"
                    "1. Tipul ședinței (consiliu local / tribunal / medical / altul)\n"
                    "2. Numele și funcțiile persoanelor menționate explicit\n"
                    "3. Estimarea numărului de vorbitori diferiți\n\n"
                    f"Transcriere (primele 3000 caractere):\n{segments_text[:3000]}"
                )
            }]
        )
        return response.content[0].text.strip()
    except Exception as e:
        print(f"[Diarize/Context] Extraction failed: {e}")
        return "{}"


def validate_and_fix_diarization(result: list, segments: list) -> list:
    """
    TASK 3 — Post-process Claude diarization output:
    - Remove empty / too-short entries
    - Normalize "Vorbitor 0" → "Vorbitor 1"
    - Validate MM:SS timestamp format
    - Fallback to single-speaker block if result is empty but segments exist
    """
    if not isinstance(result, list):
        return []

    cleaned = []
    speaker_map: dict = {}

    for item in result:
        if not isinstance(item, dict):
            continue

        text = item.get("text", "").strip()
        if not text or len(text) < 2:
            continue

        speaker = item.get("speaker", "").strip()
        if not speaker:
            speaker = f"Vorbitor {len(speaker_map) + 1}"

        # Normalize "Vorbitor 0" → "Vorbitor 1"
        if re.match(r'^Vorbitor\s+0$', speaker, re.IGNORECASE):
            speaker = "Vorbitor 1"

        if speaker not in speaker_map:
            speaker_map[speaker] = speaker

        # Validate / coerce timestamp to MM:SS
        ts = str(item.get("timestamp", "00:00"))
        if not re.match(r'^\d{2}:\d{2}$', ts):
            ts = "00:00"

        cleaned.append({
            "speaker": speaker_map[speaker],
            "role":    item.get("role") or None,
            "timestamp": ts,
            "text":    text,
        })

    # Sanity fallback: if Claude returned nothing but segments exist
    if not cleaned and segments:
        fallback_text = " ".join(s.get("text", "") for s in segments[:50]).strip()
        if fallback_text:
            return [{
                "speaker":   "Vorbitor 1",
                "role":      None,
                "timestamp": "00:00",
                "text":      fallback_text,
            }]

    return cleaned


async def _diarize_with_claude_nlp(segments: list, segments_text: str = None) -> list:
    """
    TASK 1+2+3 — Single-call diarization path.
    Two-pass: cheap Haiku context extraction → full Sonnet diarization with injected context.
    Dynamic token budget based on segment count (min 4000, max 8000).
    """
    if not segments or not anthropic_client:
        return []

    # Build segments_text if caller didn't pre-build it
    if segments_text is None:
        segments_text = ""
        for seg in segments:
            start = seg.get("start", 0)
            text  = seg.get("text", "").strip()
            if text:
                minutes = int(start // 60)
                seconds = int(start % 60)
                segments_text += f"[{minutes:02d}:{seconds:02d}] {text}\n"

    if not segments_text.strip():
        return []

    # PASS 1 — cheap context extraction with Haiku (TASK 2)
    speaker_context = await extract_speaker_context(segments_text)

    # Build enriched user message
    user_message = (
        f"CONTEXT EXTRAS DIN TRANSCRIERE:\n{speaker_context}\n\n"
        f"TRANSCRIERE COMPLETĂ DE DIARIZAT:\n\n{segments_text}"
    )

    # Dynamic token budget (TASK 3): ~60 tokens per segment turn
    estimated_turns = len([s for s in segments if s.get("text", "").strip()])
    max_tokens_needed = min(8000, max(4000, estimated_turns * 60))

    try:
        response = await anthropic_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=max_tokens_needed,
            system=DIARIZATION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}]
        )

        response_text = response.content[0].text.strip()
        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(0))
            else:
                print("[Diarize] Could not parse JSON from Claude response")
                return validate_and_fix_diarization([], segments)

        return validate_and_fix_diarization(
            result if isinstance(result, list) else [], segments
        )

    except Exception as e:
        print(f"[Diarize] Error: {e}")
        return []


async def diarize_long_transcript(segments: list) -> list:
    """
    TASK 4 — Chunked diarization for long transcripts (>MAX_DIARIZATION_CHUNK chars).
    Splits into overlapping chunks, diarizes each with speaker-continuity context,
    then merges by deduplicating on timestamp comparison.
    """
    # Build full formatted text once
    full_text = ""
    for seg in segments:
        start = seg.get("start", 0)
        text  = seg.get("text", "").strip()
        if text:
            minutes = int(start // 60)
            seconds = int(start % 60)
            full_text += f"[{minutes:02d}:{seconds:02d}] {text}\n"

    if not full_text.strip():
        return []

    # Split into chunks at newline boundaries
    chunks = []
    start_idx = 0
    while start_idx < len(full_text):
        end_idx = start_idx + MAX_DIARIZATION_CHUNK
        if end_idx < len(full_text):
            # Snap to last newline to avoid cutting mid-segment
            newline_idx = full_text.rfind('\n', start_idx, end_idx)
            if newline_idx > start_idx:
                end_idx = newline_idx + 1
        chunks.append(full_text[start_idx:end_idx])
        start_idx = end_idx - CHUNK_OVERLAP

    print(f"[Diarize] Long transcript split into {len(chunks)} chunks")

    all_turns: list = []
    previous_speakers: list = []

    for i, chunk in enumerate(chunks):
        # Carry speaker labels from previous chunk for consistency
        context_note = ""
        if previous_speakers:
            speaker_list = ", ".join(set(previous_speakers[-10:]))
            context_note = (
                f"NOTĂ: Aceasta este continuarea ședinței. "
                f"Vorbitorii identificați până acum: {speaker_list}. "
                f"Păstrează aceleași etichete pentru aceiași vorbitori.\n\n"
            )

        chunk_with_context = context_note + chunk

        try:
            response = await anthropic_client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=6000,
                system=DIARIZATION_SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": f"Identifică vorbitorii:\n\n{chunk_with_context}"
                }]
            )
            response_text = response.content[0].text.strip()
            try:
                chunk_result = json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
                chunk_result = json.loads(json_match.group(0)) if json_match else []

            chunk_result = validate_and_fix_diarization(
                chunk_result if isinstance(chunk_result, list) else [], []
            )

            # Deduplicate overlap: skip turns whose timestamp ≤ last saved turn
            if all_turns and chunk_result:
                last_ts = all_turns[-1].get("timestamp", "00:00")
                chunk_result = [t for t in chunk_result if t.get("timestamp", "99:99") > last_ts]

            all_turns.extend(chunk_result)
            previous_speakers.extend([t["speaker"] for t in chunk_result])
            print(f"[Diarize] Chunk {i + 1}/{len(chunks)} → {len(chunk_result)} turns")

        except Exception as e:
            print(f"[Diarize] Chunk {i + 1}/{len(chunks)} failed: {e}")
            continue

    return all_turns


async def diarize_transcript(segments: list) -> list:
    """
    Public entry point for speaker diarization.
    Routes to chunked path for long transcripts, single-call for short ones.
    """
    if not segments or not anthropic_client:
        return []

    # Pre-build segments_text to measure total length
    segments_text = ""
    for seg in segments:
        start = seg.get("start", 0)
        text  = seg.get("text", "").strip()
        if text:
            minutes = int(start // 60)
            seconds = int(start % 60)
            segments_text += f"[{minutes:02d}:{seconds:02d}] {text}\n"

    if not segments_text.strip():
        return []

    # TASK 4 — Route to chunked diarization for long transcripts
    if len(segments_text) > MAX_DIARIZATION_CHUNK:
        print(f"[Diarize] Long transcript ({len(segments_text)} chars) → chunked mode")
        return await diarize_long_transcript(segments)

    return await _diarize_with_claude_nlp(segments, segments_text)


async def extract_meeting_data(transcript: str, vertical_type: str = "GAL") -> dict:
    """Extract structured data from transcript using Anthropic Claude SDK."""
    from verticals import get_vertical_config

    vertical_config = get_vertical_config(vertical_type)

    # Truncate transcript to avoid 413 / context-limit errors — full text stays in MongoDB
    MAX_TRANSCRIPT_LENGTH = 12000
    if len(transcript) > MAX_TRANSCRIPT_LENGTH:
        truncated = transcript[:MAX_TRANSCRIPT_LENGTH]
        note = f"\n\n[NOTĂ: Transcrierea a fost trunchiată la {MAX_TRANSCRIPT_LENGTH} caractere din {len(transcript)} total pentru procesare AI]"
        transcript_for_claude = truncated + note
    else:
        transcript_for_claude = transcript

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        system=vertical_config.prompt_template,
        messages=[{
            "role": "user",
            "content": f"Extrage informațiile structurate din această transcriere:\n\n{transcript_for_claude}"
        }]
    )

    response_text = response.content[0].text

    # Parse JSON from response
    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(1))
        else:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(response_text[start:end])
            else:
                raise ValueError("Could not parse JSON from Claude response")

    return result


async def process_meeting(meeting_id: str):
    """Background task: transcribe + extract data for a meeting."""
    try:
        meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
        if not meeting:
            return
        
        # Update status to processing
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc)}}
        )
        
        audio_path = meeting.get("audio_path")
        if not audio_path or not os.path.exists(audio_path):
            await meetings_col.update_one(
                {"_id": ObjectId(meeting_id)},
                {"$set": {"status": "error", "error": "Fișier audio lipsă", "updated_at": datetime.now(timezone.utc)}}
            )
            return
        
        # Step 1a: Preprocess audio (ffmpeg normalize + 16kHz WAV)
        print(f"[GAL] Preprocessing audio for meeting {meeting_id}...")
        processed_audio_path = await preprocess_audio(audio_path)

        # Step 1b: Transcribe (word + segment timestamps)
        print(f"[GAL] Transcribing meeting {meeting_id}...")
        transcription = await transcribe_audio(processed_audio_path)

        # Clean up preprocessed temp file if a new one was created
        if processed_audio_path != audio_path and os.path.exists(processed_audio_path):
            try:
                os.remove(processed_audio_path)
            except Exception:
                pass

        # Step 1c: Speaker diarization (two-pass NLP via Claude)
        print(f"[Meetings.ro] Diarizing speakers for meeting {meeting_id}...")
        diarized = await diarize_transcript(transcription["segments"])
        print(f"[Meetings.ro] Found {len(set(d.get('speaker','') for d in diarized))} speakers in {len(diarized)} segments")

        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "transcript":          transcription["text"],
                "segments":            transcription["segments"],
                "words":               transcription.get("words", []),
                "diarized_transcript": diarized,
                "updated_at":          datetime.now(timezone.utc),
            }}
        )

        # Step 2: Extract structured data via Claude
        vertical_type = meeting.get("vertical_type", "GAL")
        print(f"[Meetings.ro] Extracting data for meeting {meeting_id} (vertical: {vertical_type})...")
        extracted = await extract_meeting_data(transcription["text"], vertical_type)
        print(f"[Meetings.ro] Extracted fields: {list(extracted.keys())}")

        # Determine locality from extracted fields — try multiple possible keys
        raw_locality = (
            extracted.get("localitate") or
            extracted.get("locality") or
            extracted.get("loc_desfasurare") or
            extracted.get("location") or
            ""
        )
        # Reject placeholder values
        INVALID_LOCALITY = {"necunoscut", "unknown", "n/a", "na", "null", "none", "-", ""}
        locality = raw_locality.strip() if raw_locality and raw_locality.strip().lower() not in INVALID_LOCALITY else None

        # Generate title: DD.MM.YYYY | Localitate  OR  DD.MM.YYYY | HH:MM
        created_at = meeting.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        if locality:
            title = f"{created_at.strftime('%d.%m.%Y')} | {locality}"
        else:
            title = created_at.strftime("%d.%m.%Y | %H:%M")

        # Save locality as "Necunoscut" only for DB purposes (backward compat), not in title
        db_locality = locality or "Necunoscut"

        # Build update data — GAL fields at top level + vertical_config for all verticals
        update_data = {
            "title": title,
            "locality": db_locality,
            "vertical_config": extracted,
            "status": "done",
            "error": None,
            "updated_at": datetime.now(timezone.utc)
        }

        # Also save GAL-specific fields at top level for backward compatibility
        for field in ["data_desfasurare", "format_intalnire", "loc_desfasurare",
                       "mod_promovare", "obiectiv", "tematica", "scurta_descriere",
                       "numar_participanti", "concluzia"]:
            if field in extracted:
                update_data[field] = extracted[field]

        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": update_data}
        )

        # Ensure locality exists in localities collection (only real localities, not placeholders)
        if locality:
            await localities_col.update_one(
                {"name": locality},
                {"$setOnInsert": {"name": locality, "created_at": datetime.now(timezone.utc)}, "$inc": {"count": 1}},
                upsert=True
            )
        
        print(f"[GAL] Meeting {meeting_id} processed successfully!")

        # Send push notification to user
        meeting_doc = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
        if meeting_doc and meeting_doc.get("user_id"):
            await notify_user_meeting_done(meeting_doc["user_id"], title)

    except Exception as e:
        print(f"[GAL] Error processing meeting {meeting_id}: {e}")
        import traceback
        traceback.print_exc()
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "status": "error",
                "error": str(e),
                "updated_at": datetime.now(timezone.utc)
            }}
        )


# ==================== API ENDPOINTS ====================

@app.get("/api/v1/verticals")
async def get_verticals():
    """Get all available vertical configurations with output fields."""
    from verticals import VERTICALS
    result = []
    for key, config in VERTICALS.items():
        result.append({
            "id": key,
            "name": config.name,
            "display_name_ro": config.display_name_ro,
            "icon": config.icon,
            "color_accent": config.color_accent,
            "description_ro": config.description_ro,
            "output_fields": [
                {"key": f.key, "label_ro": f.label_ro, "field_type": f.field_type}
                for f in config.output_fields
            ],
            "predefined_locations": config.predefined_locations or [],
        })
    return {"verticals": result}


@app.get("/download/meetings-ro.zip")
async def download_project():
    """Download Meetings.ro Expo project"""
    from fastapi.responses import FileResponse
    zip_path = "/tmp/meetings-ro.zip"
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Project archive not found")
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="meetings-ro.zip"
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Meetings.ro API"}


# ==================== TENANTS ====================

class TenantCreate(BaseModel):
    name: str
    type: str  # primarie | ong | firma
    vertical: str = "GENERAL"

class InviteRequest(BaseModel):
    email: str
    role: str = "member"

class RegisterWithInviteRequest(BaseModel):
    token: str
    name: str
    password: str


@app.post("/api/tenants")
async def create_tenant(body: TenantCreate, user: dict = Depends(get_current_user)):
    """Create a new tenant (organization). First user becomes admin."""
    existing = await tenants_col.find_one({"created_by": str(user["_id"])})
    if existing:
        raise HTTPException(status_code=400, detail="Ai deja o organizație creată")

    # Also block if already in a tenant (not created by him)
    if user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="Ești deja membre al unei organizații")

    valid_types = {"primarie", "ong", "firma", "consiliu", "spital", "scoala", "other"}
    if body.type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Tip invalid. Valori acceptate: {valid_types}")

    valid_verticals = {"GENERAL", "GAL", "BANKING", "LEGAL", "JOURNALISM", "HEALTHCARE", "STARTUPS"}
    vertical = body.vertical.upper() if body.vertical else "GENERAL"
    if vertical not in valid_verticals:
        vertical = "GENERAL"

    now = datetime.now(timezone.utc)
    tenant = {
        "name": body.name,
        "type": body.type,
        "vertical": vertical,
        "plan": "free",
        "billing_email": user["email"],
        "antet_text": body.name,
        "stema_url": None,
        "created_by": str(user["_id"]),
        "created_at": now,
    }
    result = await tenants_col.insert_one(tenant)
    tenant_id = str(result.inserted_id)

    # Promote creator to admin of the new tenant
    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"tenant_id": tenant_id, "role": "admin"}}
    )

    tenant["_id"] = tenant_id
    tenant["created_at"] = now.isoformat()
    return {"tenant_id": tenant_id, **{k: v for k, v in tenant.items() if k != "_id"}}


@app.get("/api/tenants/me")
async def get_my_tenant(user: dict = Depends(get_current_user)):
    """Get current user's tenant."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Nu ești parte dintr-o organizație")
    tenant = await tenants_col.find_one({"_id": ObjectId(tenant_id)})
    if not tenant:
        raise HTTPException(status_code=404, detail="Organizația nu există")
    return serialize_doc(tenant)


@app.patch("/api/tenants/me")
async def update_my_tenant(
    name: Optional[str] = None,
    antet_text: Optional[str] = None,
    vertical: Optional[str] = None,
    user: dict = Depends(require_role("admin")),
):
    """Update tenant info (admin only)."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Nu ești parte dintr-o organizație")
    updates: dict = {}
    if name:
        updates["name"] = name
    if antet_text:
        updates["antet_text"] = antet_text
    if vertical:
        updates["vertical"] = vertical.upper()
    if updates:
        await tenants_col.update_one({"_id": ObjectId(tenant_id)}, {"$set": updates})
    tenant = await tenants_col.find_one({"_id": ObjectId(tenant_id)})
    return serialize_doc(tenant)


@app.get("/api/tenants/me/members")
async def get_tenant_members(user: dict = Depends(get_current_user)):
    """List all members of the current user's tenant."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Nu ești parte dintr-o organizație")
    cursor = users_col.find(
        {"tenant_id": tenant_id},
        {"password_hash": 0, "verify_token": 0, "reset_token": 0}
    )
    members = []
    async for m in cursor:
        members.append(serialize_doc(m))
    return {"members": members, "count": len(members)}


@app.delete("/api/tenants/me/members/{user_id}")
async def remove_tenant_member(user_id: str, user: dict = Depends(require_role("admin"))):
    """Remove a member from the tenant (admin only). Cannot remove yourself."""
    if user_id == str(user["_id"]):
        raise HTTPException(status_code=400, detail="Nu poți elimina propriul cont din organizație")
    target = await users_col.find_one({"_id": ObjectId(user_id)})
    if not target or target.get("tenant_id") != user.get("tenant_id"):
        raise HTTPException(status_code=404, detail="Membrul nu a fost găsit în organizație")
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"tenant_id": None, "role": "member"}}
    )
    return {"message": "Membrul a fost eliminat din organizație"}


# ==================== INVITE FLOW ====================

INVITE_EMAIL_TEMPLATE = """
<div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB">
  <div style="padding:32px 0 24px">
    <h1 style="color:#1B2A4A;font-size:22px;margin:0 0 8px">Ai fost invitat în {tenant_name}</h1>
    <p style="color:#6B7280;font-size:15px;margin:0 0 24px">
      Rolul tău va fi: <strong style="color:#1B2A4A">{role_label}</strong>
    </p>
    <a href="{accept_url}"
       style="display:inline-block;background:#1B2A4A;color:#FAF8F3;padding:14px 28px;
              border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">
        Acceptă invitația →
    </a>
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px">Link valabil 7 zile. Dacă nu ești tu, ignoră acest email.</p>
  </div>
  <div style="border-top:1px solid #F3F4F6;padding:16px 0;text-align:center">
    <span style="color:#9CA3AF;font-size:12px">Meetings.ro — Transcriere AI pentru organizații</span>
  </div>
</div>
"""

ROLE_LABELS_RO = {
    "member": "Membru", "secretary": "Secretar", "mayor": "Primar",
    "councilor": "Consilier", "clerk": "Funcționar", "admin": "Administrator"
}
VALID_ROLES = {"member", "secretary", "mayor", "councilor", "clerk", "admin"}
API_BASE = os.environ.get("API_BASE_URL", "https://meetings-ro-api.onrender.com")


@app.post("/api/tenants/invite")
async def invite_member(body: InviteRequest, user: dict = Depends(require_role("admin"))):
    """Invite a user to the tenant by email (admin only)."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Nu ești parte dintr-o organizație")

    role = body.role if body.role in VALID_ROLES else "member"
    email = body.email.lower().strip()

    # Check if already in this tenant
    existing = await users_col.find_one({"email": email, "tenant_id": tenant_id})
    if existing:
        raise HTTPException(status_code=400, detail="Utilizatorul este deja în organizație")

    # Revoke any old pending invite for same email+tenant
    await invitations_col.delete_many({"email": email, "tenant_id": tenant_id})

    invite_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    invite = {
        "tenant_id": tenant_id,
        "email": email,
        "role": role,
        "token": invite_token,
        "invited_by": str(user["_id"]),
        "expires_at": now + timedelta(days=7),
        "created_at": now,
    }
    await invitations_col.insert_one(invite)

    tenant = await tenants_col.find_one({"_id": ObjectId(tenant_id)})
    tenant_name = tenant["name"] if tenant else "Meetings.ro"
    accept_url = f"{API_BASE}/api/auth/accept-invite?token={invite_token}"
    role_label = ROLE_LABELS_RO.get(role, role.capitalize())

    try:
        resend.Emails.send({
            "from": "Meetings.ro <noreply@resend.dev>",
            "to": [email],
            "subject": f"Invitație să te alături organizației {tenant_name}",
            "html": INVITE_EMAIL_TEMPLATE.format(
                tenant_name=tenant_name,
                role_label=role_label,
                accept_url=accept_url,
            ),
        })
    except Exception as e:
        print(f"[Invite] Email failed: {e}. Token: {invite_token}")
        # Don't fail — return token so admin can share manually if needed
        return {
            "message": f"Invitație creată (email eșuat). Token manual: {invite_token}",
            "token": invite_token,
            "accept_url": accept_url,
        }

    return {"message": f"Invitație trimisă la {email}", "accept_url": accept_url}


@app.get("/api/tenants/me/invitations")
async def list_pending_invitations(user: dict = Depends(require_role("admin"))):
    """List pending invitations for the current tenant (admin only)."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Nu ești parte dintr-o organizație")
    now = datetime.now(timezone.utc)
    cursor = invitations_col.find({"tenant_id": tenant_id, "expires_at": {"$gt": now}})
    invites = []
    async for inv in cursor:
        inv["_id"] = str(inv["_id"])
        inv["expires_at"] = inv["expires_at"].isoformat()
        inv["created_at"] = inv["created_at"].isoformat()
        invites.append(inv)
    return {"invitations": invites}


@app.delete("/api/tenants/me/invitations/{token}")
async def revoke_invitation(token: str, user: dict = Depends(require_role("admin"))):
    """Revoke a pending invitation (admin only)."""
    tenant_id = user.get("tenant_id")
    result = await invitations_col.delete_one({"token": token, "tenant_id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invitație negăsită")
    return {"message": "Invitație revocată"}


@app.get("/api/auth/accept-invite")
async def accept_invite_page(token: str):
    """Landing page when user clicks the invite link."""
    invite = await invitations_col.find_one({
        "token": token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if not invite:
        return HTMLResponse("""
            <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#FAF8F3">
            <h1 style="color:#EF4444">Link invalid sau expirat</h1>
            <p>Roagă administratorul să îți trimită o nouă invitație.</p>
            </body></html>
        """)

    existing_user = await users_col.find_one({"email": invite["email"]})
    if existing_user:
        # User already exists → just assign tenant and role
        await users_col.update_one(
            {"_id": existing_user["_id"]},
            {"$set": {"tenant_id": invite["tenant_id"], "role": invite["role"]}}
        )
        await invitations_col.delete_one({"token": token})
        return HTMLResponse("""
            <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#FAF8F3">
            <h1 style="color:#1B2A4A">✓ Ai fost adăugat în organizație!</h1>
            <p style="color:#6B7280">Deschide aplicația Meetings.ro și loghează-te din nou.</p>
            </body></html>
        """)

    # New user → show registration page
    tenant = await tenants_col.find_one({"_id": ObjectId(invite["tenant_id"])})
    tenant_name = tenant["name"] if tenant else "Meetings.ro"
    return HTMLResponse(f"""
        <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px;background:#FAF8F3;max-width:400px;margin:0 auto">
        <h1 style="color:#1B2A4A">Bun venit în {tenant_name}!</h1>
        <p style="color:#6B7280">Creează contul tău Meetings.ro folosind adresa<br>
           <strong style="color:#1B2A4A">{invite["email"]}</strong></p>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #E5E7EB;margin-top:24px;text-align:left">
          <p style="color:#9CA3AF;font-size:12px;text-align:center">
            Folosește acest token în aplicație la înregistrare:<br>
            <code style="background:#F3F4F6;padding:4px 8px;border-radius:4px;font-size:11px">{token}</code>
          </p>
        </div>
        </body></html>
    """)


@app.post("/api/auth/register-with-invite")
async def register_with_invite(body: RegisterWithInviteRequest):
    """Register a new user via an invitation token."""
    invite = await invitations_col.find_one({
        "token": body.token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    if not invite:
        raise HTTPException(status_code=400, detail="Invitație invalidă sau expirată")

    # Check email not already taken
    existing = await users_col.find_one({"email": invite["email"]})
    if existing:
        # Already has account → just join tenant
        await users_col.update_one(
            {"_id": existing["_id"]},
            {"$set": {"tenant_id": invite["tenant_id"], "role": invite["role"]}}
        )
        await invitations_col.delete_one({"token": body.token})
        token_jwt = create_token(str(existing["_id"]), existing["email"])
        return {
            "token": token_jwt,
            "name": existing.get("name", ""),
            "email": existing["email"],
            "role": invite["role"],
            "tenant_id": invite["tenant_id"],
        }

    now = datetime.now(timezone.utc)
    new_user = {
        "email": invite["email"],
        "name": body.name,
        "password_hash": hash_password(body.password),
        "company": None,
        "plan": "FREE",
        "role": invite["role"],
        "tenant_id": invite["tenant_id"],
        "is_verified": True,
        "meetings_used_this_month": 0,
        "last_monthly_reset": now,
        "created_at": now,
        "updated_at": now,
    }
    result = await users_col.insert_one(new_user)
    await invitations_col.delete_one({"token": body.token})

    token_jwt = create_token(str(result.inserted_id), invite["email"])
    return {
        "token": token_jwt,
        "name": body.name,
        "email": invite["email"],
        "role": invite["role"],
        "tenant_id": invite["tenant_id"],
    }


# ==================== ROLE MANAGEMENT ====================

class RoleUpdateBody(BaseModel):
    role: str


@app.patch("/api/users/{user_id}/role")
async def change_user_role(user_id: str, body: RoleUpdateBody, user: dict = Depends(require_role("admin"))):
    """Change the role of a tenant member (admin only)."""
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol invalid. Roluri valide: {list(VALID_ROLES)}")

    try:
        target = await users_col.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID user invalid")
    if not target:
        raise HTTPException(status_code=404, detail="Utilizator negăsit")
    if target.get("tenant_id") != user.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Nu poți modifica utilizatori din altă organizație")
    if str(target["_id"]) == str(user["_id"]) and body.role != "admin":
        raise HTTPException(status_code=400, detail="Nu îți poți retrage propriul rol de admin")

    await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": body.role}})
    return {"message": f"Rol actualizat la {ROLE_LABELS_RO.get(body.role, body.role)}", "role": body.role}


# ---- MEETINGS CRUD ----

@app.post("/api/meetings")
async def create_meeting(data: MeetingCreate = None, user: dict = Depends(get_current_user)):
    """Create a new meeting placeholder (auth + plan limit enforced)."""
    await check_plan_limit(user)

    now = datetime.now(timezone.utc)

    # Determine vertical: explicit request > tenant config > GENERAL default
    vertical_type = data.vertical_type if data and hasattr(data, 'vertical_type') and data.vertical_type else None
    if not vertical_type:
        if user.get("tenant_id"):
            tenant_doc = await tenants_col.find_one({"_id": ObjectId(user["tenant_id"])})
            vertical_type = tenant_doc.get("vertical") if tenant_doc else "GENERAL"
        vertical_type = vertical_type or "GENERAL"

    meeting = {
        "title": (data.title if data and data.title else None),
        "locality": (data.locality if data and data.locality else None),
        "date": now.isoformat(),
        "audio_path": None,
        "audio_url": None,
        "transcript": None,
        "segments": [],
        # GAL report fields (backward compat)
        "data_desfasurare": None,
        "format_intalnire": None,
        "loc_desfasurare": None,
        "mod_promovare": None,
        "obiectiv": None,
        "tematica": None,
        "scurta_descriere": None,
        "numar_participanti": None,
        "concluzia": None,
        # Vertical system
        "vertical_type": vertical_type,
        "vertical_config": {},
        # Ownership + multi-tenant
        "user_id": str(user["_id"]),
        "tenant_id": str(user["tenant_id"]) if user.get("tenant_id") else None,
        "status": "pending",
        "error": None,
        "duration": 0,
        "created_at": now,
        "updated_at": now
    }
    result = await meetings_col.insert_one(meeting)
    meeting["_id"] = result.inserted_id

    # Increment usage counter
    await increment_usage(user["_id"])

    return serialize_doc(meeting)


ALLOWED_AUDIO_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/m4a", "audio/x-m4a", "audio/mp4", "audio/ogg",
    "audio/webm", "audio/aac", "audio/x-m4a", "audio/3gpp",
    "audio/x-aac", "audio/flac", "audio/x-flac",
    "application/octet-stream",  # iOS often sends this for m4a
    "video/mp4",  # some devices send m4a as video/mp4
}
ALLOWED_AUDIO_EXTENSIONS = {".m4a", ".mp3", ".wav", ".ogg", ".webm", ".aac", ".flac", ".3gp", ".mp4"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

@app.post("/api/meetings/{meeting_id}/upload")
async def upload_audio(meeting_id: str, background_tasks: BackgroundTasks, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload audio file for a meeting and start processing."""
    # Validate MIME type — allow unknown types if extension is valid
    file_ext = Path(file.filename or "").suffix.lower() if file.filename else ""
    content_type = (file.content_type or "").lower().strip()

    if content_type and content_type not in ALLOWED_AUDIO_TYPES:
        # MIME unknown, check extension as fallback
        if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
            print(f"[Upload] Rejected: content_type={content_type}, ext={file_ext}, filename={file.filename}")
            raise HTTPException(status_code=415, detail=f"Format audio neacceptat: {content_type}")

    # Validate meeting exists + ownership
    meeting = await verify_meeting_ownership(meeting_id, user)

    # Save audio file with size check
    ext = file.filename.split(".")[-1] if "." in file.filename else "webm"
    allowed_exts = {"mp3", "wav", "m4a", "mp4", "ogg", "webm", "aac", "3gpp"}
    if ext.lower() not in allowed_exts:
        ext = "webm"
    audio_filename = f"{meeting_id}.{ext}"
    audio_path = str(UPLOAD_DIR / audio_filename)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Fișierul depășește limita de 100MB")

    async with aiofiles.open(audio_path, "wb") as f:
        await f.write(content)
    
    file_size = os.path.getsize(audio_path)
    
    # Update meeting with audio info
    await meetings_col.update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {
            "audio_path": audio_path,
            "audio_url": f"/api/meetings/{meeting_id}/audio",
            "status": "uploading",
            "file_size": file_size,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Start processing in background
    background_tasks.add_task(process_meeting, meeting_id)
    
    updated = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    return serialize_doc(updated)


@app.get("/api/meetings/{meeting_id}/audio")
async def get_audio(meeting_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Stream audio file with HTTP Range request support for mobile playback."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    if not meeting.get("audio_path"):
        raise HTTPException(status_code=404, detail="Audio nu a fost găsit")
    
    audio_path = meeting["audio_path"]
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Fișier audio lipsă")
    
    ext = audio_path.split(".")[-1]
    media_types = {
        "webm": "audio/webm",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "m4a": "audio/mp4",
        "ogg": "audio/ogg"
    }
    media_type = media_types.get(ext, "audio/webm")
    file_size = os.path.getsize(audio_path)
    
    # Check for Range header
    range_header = None
    if request and request.headers.get("range"):
        range_header = request.headers.get("range")
    
    if range_header:
        # Parse range: "bytes=start-end"
        try:
            range_spec = range_header.replace("bytes=", "")
            parts = range_spec.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
        except (ValueError, IndexError):
            start = 0
            end = file_size - 1
        
        # Clamp values
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        content_length = end - start + 1
        
        async def range_file_generator():
            async with aiofiles.open(audio_path, "rb") as f:
                await f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(65536, remaining)
                    chunk = await f.read(chunk_size)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        return StreamingResponse(
            range_file_generator(),
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Cache-Control": "public, max-age=3600",
            }
        )
    else:
        # Full file response
        async def full_file_generator():
            async with aiofiles.open(audio_path, "rb") as f:
                while chunk := await f.read(65536):
                    yield chunk
        
        return StreamingResponse(
            full_file_generator(),
            media_type=media_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "public, max-age=3600",
            }
        )


@app.get("/api/meetings")
async def list_meetings(
    locality: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """List meetings with optional filters (scoped to current user / tenant)."""
    query = build_meetings_scope_query(user)

    if locality:
        query["locality"] = locality
    if status:
        query["status"] = status
    if q:
        query["$text"] = {"$search": q}
    
    skip = (page - 1) * limit
    
    total = await meetings_col.count_documents(query)
    cursor = meetings_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    meetings = []
    async for doc in cursor:
        meetings.append(serialize_doc(doc))
    
    return {
        "meetings": meetings,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


# ---- CALENDAR: MEETING DATES ----

@app.get("/api/meetings/calendar-dates")
async def get_meeting_dates(
    year: int = Query(...),
    month: int = Query(...),
    user: dict = Depends(get_current_user),
):
    """Get dates that have meetings for a given month (for calendar highlighting)."""
    from calendar import monthrange

    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    _, last_day = monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    scope = build_meetings_scope_query(user)
    match_stage = {**scope, "created_at": {"$gte": start_date, "$lte": end_date}}
    pipeline = [
        {"$match": match_stage},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    cursor = meetings_col.aggregate(pipeline)
    dates = {}
    async for doc in cursor:
        dates[doc["_id"]] = doc["count"]
    
    return {"dates": dates}


@app.get("/api/meetings/calendar-by-date")
async def get_meetings_by_date(
    date: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """Get meetings for a specific date (YYYY-MM-DD)."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format dată invalid. Folosiți YYYY-MM-DD")

    next_date = target_date.replace(hour=23, minute=59, second=59)

    query = {
        **build_meetings_scope_query(user),
        "created_at": {"$gte": target_date, "$lte": next_date}
    }
    
    cursor = meetings_col.find(query).sort("created_at", -1)
    meetings = []
    async for doc in cursor:
        meetings.append(serialize_doc(doc))
    
    return {"meetings": meetings, "date": date, "count": len(meetings)}


@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    """Get single meeting detail."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    return serialize_doc(meeting)


@app.patch("/api/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, data: MeetingUpdate, user: dict = Depends(get_current_user)):
    """Update meeting title or locality."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    
    update_fields = {"updated_at": datetime.now(timezone.utc)}
    if data.title is not None:
        update_fields["title"] = data.title
    if data.locality is not None:
        update_fields["locality"] = data.locality
        # Ensure new locality exists
        if data.locality and data.locality != "Necunoscut":
            await localities_col.update_one(
                {"name": data.locality},
                {"$setOnInsert": {"name": data.locality, "created_at": datetime.now(timezone.utc)}, "$inc": {"count": 1}},
                upsert=True
            )
    
    await meetings_col.update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": update_fields}
    )
    
    updated = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    return serialize_doc(updated)


@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    """Delete a meeting."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    
    # Delete audio file if exists
    if meeting.get("audio_path") and os.path.exists(meeting["audio_path"]):
        os.remove(meeting["audio_path"])
    
    await meetings_col.delete_one({"_id": ObjectId(meeting_id)})
    return {"status": "deleted"}


# ---- ACTION ITEMS ----

@app.patch("/api/meetings/{meeting_id}/actions/{action_id}")
async def toggle_action(meeting_id: str, action_id: str, user: dict = Depends(get_current_user)):
    """Toggle action item completion."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    
    actions = meeting.get("actions", [])
    found = False
    for action in actions:
        if action["id"] == action_id:
            action["completed"] = not action["completed"]
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Acțiunea nu a fost găsită")
    
    await meetings_col.update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {"actions": actions, "updated_at": datetime.now(timezone.utc)}}
    )
    
    updated = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    return serialize_doc(updated)


# ---- REGENERATE AI ----

@app.post("/api/meetings/{meeting_id}/regenerate")
async def regenerate_meeting(meeting_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Regenerate AI processing for a meeting."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    
    if not meeting.get("transcript") and not meeting.get("audio_path"):
        raise HTTPException(status_code=400, detail="Nu există transcriere sau audio pentru procesare")
    
    # Reset status
    await meetings_col.update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {"status": "processing", "error": None, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if meeting.get("transcript"):
        # Just re-process the transcript
        background_tasks.add_task(reprocess_transcript, meeting_id)
    else:
        # Full reprocess from audio
        background_tasks.add_task(process_meeting, meeting_id)
    
    return {"status": "regenerating"}


# ---- CORRECT TRANSCRIPT (Claude) ----

@app.post("/api/meetings/{meeting_id}/correct-transcript")
async def correct_transcript(meeting_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Use Claude to correct grammar/transcription errors, then re-extract report."""
    meeting = await verify_meeting_ownership(meeting_id, user)

    if not meeting.get("transcript"):
        raise HTTPException(status_code=400, detail="Nu există transcriere de corectat")

    # Save original transcript before correction
    original = meeting.get("transcript_original") or meeting.get("transcript")
    await meetings_col.update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {
            "transcript_original": original,
            "status": "processing",
            "error": None,
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    background_tasks.add_task(correct_and_reprocess, meeting_id)
    return {"status": "correcting"}


async def correct_and_reprocess(meeting_id: str):
    """Background: correct transcript with Claude, then re-extract report."""
    try:
        meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
        if not meeting or not meeting.get("transcript"):
            return

        # Step 1: Correct transcript with Claude
        response = await anthropic_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=8000,
            system=(
                "Ești un editor profesionist de transcrieri în limba română. "
                "Corectează erorile gramaticale, de ortografie și de transcriere. "
                "Păstrează sensul original și structura textului. "
                "NU adăuga, nu șterge și nu reformula conținutul — doar corectează greșelile. "
                "Returnează DOAR textul corectat, fără explicații."
            ),
            messages=[{
                "role": "user",
                "content": f"Corectează următoarea transcriere:\n\n{meeting['transcript']}"
            }]
        )

        corrected_transcript = response.content[0].text.strip()

        # Step 2: Save corrected transcript
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "transcript": corrected_transcript,
                "transcript_corrected_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }}
        )

        # Step 3: Re-extract report from corrected transcript
        extracted = await extract_meeting_data(corrected_transcript)

        locality = extracted.get("locality") or meeting.get("locality") or "Necunoscut"
        created_at = meeting.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        title = f"{created_at.strftime('%d.%m.%Y')} | {locality}"

        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "title": title,
                "locality": locality,
                "data_desfasurare": extracted.get("data_desfasurare"),
                "format_intalnire": extracted.get("format_intalnire"),
                "loc_desfasurare": extracted.get("loc_desfasurare"),
                "mod_promovare": extracted.get("mod_promovare"),
                "obiectiv": extracted.get("obiectiv"),
                "tematica": extracted.get("tematica"),
                "scurta_descriere": extracted.get("scurta_descriere"),
                "numar_participanti": extracted.get("numar_participanti"),
                "concluzia": extracted.get("concluzia"),
                "status": "done",
                "error": None,
                "updated_at": datetime.now(timezone.utc),
            }}
        )

        if locality and locality != "Necunoscut":
            await localities_col.update_one(
                {"name": locality},
                {"$setOnInsert": {"name": locality, "created_at": datetime.now(timezone.utc)}, "$inc": {"count": 1}},
                upsert=True
            )
    except Exception as e:
        print(f"[CORRECT] Error correcting transcript {meeting_id}: {e}")
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"status": "error", "error": str(e), "updated_at": datetime.now(timezone.utc)}}
        )


async def reprocess_transcript(meeting_id: str):
    """Re-extract data from existing transcript."""
    try:
        meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
        if not meeting or not meeting.get("transcript"):
            return
        
        extracted = await extract_meeting_data(meeting["transcript"])
        
        # Determine locality
        locality = extracted.get("locality") or meeting.get("locality") or "Necunoscut"
        
        # Generate title: DD.MM.YYYY | Localitatea
        created_at = meeting.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        title = f"{created_at.strftime('%d.%m.%Y')} | {locality}"
        
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "title": title,
                "locality": locality,
                "data_desfasurare": extracted.get("data_desfasurare"),
                "format_intalnire": extracted.get("format_intalnire"),
                "loc_desfasurare": extracted.get("loc_desfasurare"),
                "mod_promovare": extracted.get("mod_promovare"),
                "obiectiv": extracted.get("obiectiv"),
                "tematica": extracted.get("tematica"),
                "scurta_descriere": extracted.get("scurta_descriere"),
                "numar_participanti": extracted.get("numar_participanti"),
                "concluzia": extracted.get("concluzia"),
                "status": "done",
                "error": None,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if locality and locality != "Necunoscut":
            await localities_col.update_one(
                {"name": locality},
                {"$setOnInsert": {"name": locality, "created_at": datetime.now(timezone.utc)}, "$inc": {"count": 1}},
                upsert=True
            )
    except Exception as e:
        print(f"[GAL] Error reprocessing {meeting_id}: {e}")
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"status": "error", "error": str(e), "updated_at": datetime.now(timezone.utc)}}
        )


# ---- LOCALITIES ----

class LocalityCreate(BaseModel):
    name: str

class LocalityRename(BaseModel):
    new_name: str

@app.get("/api/localities")
async def list_localities(user: dict = Depends(get_current_user)):
    """List all localities (folders) with meeting counts."""
    # Get all localities from the localities collection
    all_localities = {}
    cursor = localities_col.find({}).sort("name", 1)
    async for doc in cursor:
        all_localities[doc["name"]] = {"name": doc["name"], "count": 0, "is_default": doc.get("is_default", False)}
    
    # Count meetings per locality
    pipeline = [
        {"$match": {"locality": {"$ne": None, "$ne": "", "$exists": True}}},
        {"$group": {"_id": "$locality", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    agg_cursor = meetings_col.aggregate(pipeline)
    async for doc in agg_cursor:
        name = doc["_id"]
        if not name:
            continue
        if name in all_localities:
            all_localities[name]["count"] = doc["count"]
        else:
            all_localities[name] = {"name": name, "count": doc["count"], "is_default": False}
    
    localities = sorted(all_localities.values(), key=lambda x: x["name"] or "")
    return {"localities": localities}


@app.post("/api/localities")
async def create_locality(data: LocalityCreate, user: dict = Depends(get_current_user)):
    """Create a new locality folder."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Numele localității nu poate fi gol")
    
    # Check if exists
    existing = await localities_col.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=409, detail="Localitate deja existentă")
    
    await localities_col.insert_one({
        "name": name,
        "created_at": datetime.now(timezone.utc),
        "is_default": False
    })
    
    return {"name": name, "count": 0, "is_default": False}


@app.patch("/api/localities/{locality_name}")
async def rename_locality(locality_name: str, data: LocalityRename, user: dict = Depends(get_current_user)):
    """Rename a locality folder and update all meetings."""
    new_name = data.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Numele nou nu poate fi gol")
    
    # Check if source exists
    existing = await localities_col.find_one({"name": locality_name})
    if not existing:
        raise HTTPException(status_code=404, detail="Localitatea nu a fost găsită")
    
    # Check if target name already exists
    if new_name != locality_name:
        target = await localities_col.find_one({"name": new_name})
        if target:
            raise HTTPException(status_code=409, detail="O localitate cu acest nume există deja")
    
    # Rename in localities collection
    await localities_col.update_one(
        {"name": locality_name},
        {"$set": {"name": new_name, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Update all meetings with this locality
    result = await meetings_col.update_many(
        {"locality": locality_name},
        {"$set": {"locality": new_name}}
    )
    
    return {"old_name": locality_name, "new_name": new_name, "meetings_updated": result.modified_count}


@app.delete("/api/localities/{locality_name}")
async def delete_locality(locality_name: str, user: dict = Depends(get_current_user)):
    """Delete a locality folder (meetings stay but lose locality)."""
    # Delete from localities collection if exists
    await localities_col.delete_one({"name": locality_name})
    
    # Set meetings locality to null
    await meetings_col.update_many(
        {"locality": locality_name},
        {"$set": {"locality": None}}
    )
    
    return {"status": "deleted", "name": locality_name}




# ---- EXPORT ----

@app.get("/api/meetings/{meeting_id}/export/pdf")
async def export_pdf(meeting_id: str, user: dict = Depends(get_current_user)):
    """Export meeting as PDF."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    
    from fpdf import FPDF
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_left_margin(15)
    pdf.set_right_margin(15)
    
    # Use built-in font that supports basic characters
    pdf.set_font("Arial", "B", 16)
    title = meeting.get("title", "Sedinta") or "Sedinta"
    # Transliterate Romanian chars for PDF compatibility
    title_safe = transliterate_ro(title)
    pdf.cell(0, 10, title_safe, new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("Arial", "", 10)
    locality = meeting.get("locality", "Necunoscut") or "Necunoscut"
    date_str = meeting.get("date", "")
    if date_str:
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            date_str = dt.strftime("%d.%m.%Y %H:%M")
        except (ValueError, AttributeError):
            pass
    
    pdf.cell(0, 6, f"Localitate: {transliterate_ro(locality)}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Data: {date_str}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Summary
    summary = meeting.get("summary", [])
    if summary:
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 8, "Rezumat", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Arial", "", 9)
        for i, item in enumerate(summary[:5]):  # Limit to 5 items
            text = transliterate_ro(item)[:100]  # Limit length
            pdf.cell(0, 5, f"{i+1}. {text}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
    
    # Actions
    actions = meeting.get("actions", [])
    if actions:
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 8, "Actiuni", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Arial", "", 9)
        for i, action in enumerate(actions[:5]):  # Limit to 5 actions
            status = "[X]" if action.get("completed") else "[ ]"
            text = transliterate_ro(action.get("text", ""))[:80]
            pdf.cell(0, 5, f"{status} {text}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
    
    # Output
    pdf_bytes = pdf.output()
    buffer = BytesIO(pdf_bytes)
    
    safe_title = re.sub(r'[^\w\s-]', '', title_safe).strip().replace(' ', '_')[:30]
    safe_date = date_str.replace('.', '-').replace(' ', '_').replace(':', '-') if date_str else 'no-date'
    filename = f"GAL_{safe_title}_{safe_date}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.get("/api/meetings/{meeting_id}/export/docx")
async def export_docx(meeting_id: str, user: dict = Depends(get_current_user)):
    """Export meeting as DOCX."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    
    from docx import Document
    from docx.shared import Pt, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    
    doc = Document()
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    
    title = meeting.get("title", "Ședință") or "Ședință"
    doc.add_heading(title, level=1)
    
    locality = meeting.get("locality", "Necunoscut") or "Necunoscut"
    date_str = meeting.get("date", "")
    if date_str:
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            date_str = dt.strftime("%d.%m.%Y %H:%M")
        except (ValueError, AttributeError):
            pass
    
    p = doc.add_paragraph()
    p.add_run(f"Localitate: ").bold = True
    p.add_run(locality)
    p = doc.add_paragraph()
    p.add_run(f"Data: ").bold = True
    p.add_run(date_str)
    
    # Summary
    summary = meeting.get("summary", [])
    if summary:
        doc.add_heading("Rezumat", level=2)
        for item in summary:
            doc.add_paragraph(item, style='List Bullet')
    
    # Key Points
    key_points = meeting.get("key_points", [])
    if key_points:
        doc.add_heading("Puncte cheie", level=2)
        for item in key_points:
            doc.add_paragraph(item, style='List Bullet')
    
    # Actions
    actions = meeting.get("actions", [])
    if actions:
        doc.add_heading("Acțiuni", level=2)
        table = doc.add_table(rows=1, cols=4)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Status'
        hdr_cells[1].text = 'Acțiune'
        hdr_cells[2].text = 'Responsabil'
        hdr_cells[3].text = 'Termen'
        
        for action in actions:
            row_cells = table.add_row().cells
            row_cells[0].text = '✓' if action.get('completed') else '○'
            row_cells[1].text = action.get('text', '')
            row_cells[2].text = action.get('owner', '-') or '-'
            row_cells[3].text = action.get('deadline', '-') or '-'
    
    # Transcript
    transcript = meeting.get("transcript", "")
    if transcript:
        doc.add_heading("Transcriere", level=2)
        doc.add_paragraph(transcript)
    
    # Output
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    
    safe_title = re.sub(r'[^\w\s-]', '', transliterate_ro(title)).strip().replace(' ', '_')[:50]
    filename = f"Sedinta_{safe_title}.docx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ==================== PROCES VERBAL (Enterprise / Public Institutions) ====================

@app.get("/api/meetings/{meeting_id}/export/proces-verbal")
async def export_proces_verbal(meeting_id: str, user: dict = Depends(get_current_user)):
    """Export meeting as formal Proces Verbal (minutes) DOCX — institutional format.

    Used by mayors, secretaries, councilors and clerks in public institutions.
    Produces a formally structured document with:
      - Header (institution, date, participants, quorum)
      - Agenda (ordinea de zi)
      - Dezbateri (per speaker, from diarized transcript)
      - Hotărâri / Decizii adoptate
      - Semnături
    """
    meeting = await verify_meeting_ownership(meeting_id, user)

    from docx import Document
    from docx.shared import Pt, Inches, RGBColor, Cm
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    # Base style
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(12)

    # ---- ANTET (Header) ----
    institution = meeting.get("locality") or user.get("company") or "Instituție"
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(institution.upper())
    run.bold = True
    run.font.size = Pt(14)

    # Titlu
    title_text = meeting.get("title") or "Ședință"
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("\nPROCES-VERBAL")
    run.bold = True
    run.font.size = Pt(16)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f"al ședinței „{title_text}”").italic = True

    doc.add_paragraph()  # spacer

    # ---- DATA / LOC ----
    date_str = meeting.get("date") or meeting.get("data_desfasurare") or ""
    if date_str:
        try:
            dt = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
            date_fmt = dt.strftime("%d.%m.%Y, ora %H:%M")
        except (ValueError, AttributeError):
            date_fmt = str(date_str)
    else:
        date_fmt = "—"

    p = doc.add_paragraph()
    p.add_run("Data și ora desfășurării: ").bold = True
    p.add_run(date_fmt)

    loc = meeting.get("loc_desfasurare") or meeting.get("locality") or "—"
    p = doc.add_paragraph()
    p.add_run("Locul desfășurării: ").bold = True
    p.add_run(str(loc))

    # Participanți
    vc = meeting.get("vertical_config") or {}
    participants = (
        vc.get("participanti")
        or vc.get("participants")
        or meeting.get("participanti")
        or []
    )
    if participants:
        doc.add_paragraph()
        p = doc.add_paragraph()
        p.add_run("Participanți: ").bold = True
        if isinstance(participants, list):
            for item in participants:
                doc.add_paragraph(f"• {item}")
        else:
            p.add_run(str(participants))

    # ---- ORDINEA DE ZI ----
    agenda = (
        vc.get("ordine_de_zi")
        or vc.get("subiecte_discutate")
        or vc.get("agenda")
        or []
    )
    if agenda:
        doc.add_paragraph()
        h = doc.add_heading("ORDINEA DE ZI", level=2)
        if isinstance(agenda, list):
            for i, item in enumerate(agenda, 1):
                doc.add_paragraph(f"{i}. {item}")
        else:
            doc.add_paragraph(str(agenda))

    # ---- DEZBATERI (from diarized transcript) ----
    diarized = meeting.get("diarized_transcript") or []
    if diarized:
        doc.add_paragraph()
        doc.add_heading("DEZBATERI", level=2)
        for entry in diarized:
            speaker = entry.get("speaker") or "Vorbitor"
            role = entry.get("role") or ""
            timestamp = entry.get("timestamp") or ""
            text = entry.get("text") or ""
            p = doc.add_paragraph()
            label = f"{speaker}"
            if role:
                label += f" ({role})"
            if timestamp:
                label += f" — {timestamp}"
            label += ":"
            run = p.add_run(label)
            run.bold = True
            p.add_run(f" {text}")
    else:
        # Fallback: raw transcript
        transcript = meeting.get("transcript", "")
        if transcript:
            doc.add_paragraph()
            doc.add_heading("DEZBATERI", level=2)
            doc.add_paragraph(transcript)

    # ---- HOTĂRÂRI / DECIZII ----
    decisions = (
        vc.get("decizii")
        or vc.get("hotarari")
        or vc.get("decizii_luate")
        or []
    )
    if decisions:
        doc.add_paragraph()
        doc.add_heading("HOTĂRÂRI ADOPTATE", level=2)
        if isinstance(decisions, list):
            for i, item in enumerate(decisions, 1):
                doc.add_paragraph(f"{i}. {item}")
        else:
            doc.add_paragraph(str(decisions))

    # ---- ACȚIUNI DE URMAT ----
    actions = (
        vc.get("actiuni_de_urmat")
        or vc.get("actions")
        or meeting.get("actions")
        or []
    )
    if actions:
        doc.add_paragraph()
        doc.add_heading("ACȚIUNI STABILITE", level=2)
        table = doc.add_table(rows=1, cols=3)
        table.style = 'Table Grid'
        hdr = table.rows[0].cells
        hdr[0].text = 'Acțiune'
        hdr[1].text = 'Responsabil'
        hdr[2].text = 'Termen'
        if isinstance(actions, list):
            for a in actions:
                row = table.add_row().cells
                if isinstance(a, dict):
                    row[0].text = str(a.get('text') or a.get('actiune') or '')
                    row[1].text = str(a.get('owner') or a.get('responsabil') or '-')
                    row[2].text = str(a.get('deadline') or a.get('termen') or '-')
                else:
                    row[0].text = str(a)
                    row[1].text = '-'
                    row[2].text = '-'

    # ---- CONCLUZII ----
    conclusions = vc.get("concluzii") or meeting.get("concluzia") or ""
    if conclusions:
        doc.add_paragraph()
        doc.add_heading("CONCLUZII", level=2)
        if isinstance(conclusions, list):
            for c in conclusions:
                doc.add_paragraph(str(c))
        else:
            doc.add_paragraph(str(conclusions))

    # ---- SEMNĂTURI ----
    doc.add_paragraph()
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.add_run("Drept pentru care am încheiat prezentul proces-verbal.").italic = True

    doc.add_paragraph()
    table = doc.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "Președinte de ședință"
    table.rows[0].cells[1].text = "Secretar"
    table.rows[1].cells[0].text = "\n\n_______________________"
    table.rows[1].cells[1].text = "\n\n_______________________"

    # Footer
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f"Document generat automat cu Meetings.ro — {datetime.now(timezone.utc).strftime('%d.%m.%Y')}")
    run.italic = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x80, 0x80, 0x80)

    # Output
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    safe_title = re.sub(r'[^\w\s-]', '', transliterate_ro(title_text)).strip().replace(' ', '_')[:50]
    filename = f"ProcesVerbal_{safe_title}.docx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


def transliterate_ro(text: str) -> str:
    """Transliterate Romanian special characters for PDF compatibility."""
    if not text:
        return ""
    mapping = {
        'ă': 'a', 'Ă': 'A',
        'â': 'a', 'Â': 'A',
        'î': 'i', 'Î': 'I',
        'ș': 's', 'Ș': 'S',
        'ş': 's', 'Ş': 'S',
        'ț': 't', 'Ț': 'T',
        'ţ': 't', 'Ţ': 'T',
    }
    result = text
    for ro_char, latin_char in mapping.items():
        result = result.replace(ro_char, latin_char)
    return result


# ---- MEETING STATUS POLLING ----

@app.get("/api/meetings/{meeting_id}/status")
async def get_meeting_status(meeting_id: str, user: dict = Depends(get_current_user)):
    """Quick status check for polling."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    return serialize_doc({"_id": meeting["_id"], "status": meeting.get("status"), "error": meeting.get("error"), "title": meeting.get("title"), "locality": meeting.get("locality")})


# ---- HEALTH CHECK ----

@app.get("/api/health")
async def health_check():
    """API health check."""
    return {"status": "ok", "service": "Meetings.ro API"}


# ==================== STRIPE PAYMENTS ====================

class CheckoutRequest(BaseModel):
    plan: str  # "pro" or "enterprise"
    interval: str  # "monthly" or "yearly"
    user_email: str


@app.post("/api/payments/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout Session for subscription."""
    price_key = f"{req.plan}_{req.interval}"
    price_id = STRIPE_PRICES.get(price_key)
    if not price_id:
        raise HTTPException(status_code=400, detail="Plan invalid")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            customer_email=req.user_email,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url="https://meetings-ro-api.onrender.com/payment-success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://meetings-ro-api.onrender.com/payment-cancel",
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/payments/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_email = session.get("customer_email")
        # Determine plan from price ID
        subscription_id = session.get("subscription")
        plan_tier = "PRO"  # default

        if subscription_id:
            try:
                sub = stripe.Subscription.retrieve(subscription_id)
                price_id = sub["items"]["data"][0]["price"]["id"]
                if price_id in [STRIPE_PRICES["enterprise_monthly"], STRIPE_PRICES["enterprise_yearly"]]:
                    plan_tier = "ENTERPRISE"
            except Exception:
                pass

        if user_email:
            await db.users.update_one(
                {"email": user_email},
                {"$set": {
                    "plan": plan_tier,
                    "stripe_customer_id": session.get("customer"),
                    "stripe_subscription_id": subscription_id,
                    "plan_updated_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            print(f"[Stripe] User {user_email} upgraded to {plan_tier}")

    elif event["type"] == "customer.subscription.deleted":
        session = event["data"]["object"]
        customer_id = session.get("customer")
        if customer_id:
            await db.users.update_one(
                {"stripe_customer_id": customer_id},
                {"$set": {
                    "plan": "FREE",
                    "stripe_subscription_id": None,
                    "plan_updated_at": datetime.now(timezone.utc),
                }}
            )
            print(f"[Stripe] Customer {customer_id} downgraded to FREE")

    return {"status": "ok"}


@app.get("/payment-success")
async def payment_success(session_id: str = ""):
    """Redirect page after successful payment."""
    return JSONResponse(content={
        "status": "success",
        "message": "Plata a fost procesată cu succes! Poți închide această pagină și reveni în aplicație.",
        "session_id": session_id,
    })


@app.get("/payment-cancel")
async def payment_cancel():
    """Redirect page after cancelled payment."""
    return JSONResponse(content={
        "status": "cancelled",
        "message": "Plata a fost anulată. Poți reveni în aplicație.",
    })


# ==================== LEGAL PAGES (App Store / Google Play) ====================

@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return HTMLResponse("""
    <html>
    <head><title>Politică de Confidențialitate — Meetings.ro</title>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{font-family:'Segoe UI',system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#333}h1{color:#1B2A4A}h2{color:#1B2A4A;margin-top:28px}</style>
    </head>
    <body>
    <h1>Politică de Confidențialitate</h1>
    <p>Ultima actualizare: Aprilie 2026</p>
    <h2>Date colectate</h2>
    <p>Meetings.ro colectează: adresă email, numele utilizatorului, înregistrări audio ale ședințelor, transcrieri și rapoarte generate automat.</p>
    <h2>Utilizarea datelor</h2>
    <p>Datele sunt folosite exclusiv pentru generarea transcrierilor și rapoartelor solicitate de utilizator. Nu vindem și nu partajăm datele cu terți.</p>
    <h2>Stocarea datelor</h2>
    <p>Datele sunt stocate pe servere securizate în Europa (Frankfurt, Germania) prin intermediul platformei Render.com și MongoDB Atlas.</p>
    <h2>Servicii terțe</h2>
    <p>Folosim: Groq/OpenAI (transcriere audio), Anthropic Claude (extracție date), Stripe (plăți), Resend (email-uri tranzacționale). Fiecare serviciu procesează doar datele minime necesare.</p>
    <h2>Drepturi GDPR</h2>
    <p>Ai dreptul la acces, rectificare, portabilitate și ștergere a datelor tale. Pentru orice solicitare, contactează-ne la adresa de mai jos.</p>
    <h2>Retenția datelor</h2>
    <p>Înregistrările audio și transcrierile sunt păstrate atât timp cât contul este activ. La ștergerea contului, toate datele sunt eliminate în maxim 30 de zile.</p>
    <h2>Contact</h2>
    <p>hello@meetings.ro</p>
    </body></html>
    """)


@app.get("/terms", response_class=HTMLResponse)
async def terms_of_service():
    return HTMLResponse("""
    <html>
    <head><title>Termeni și Condiții — Meetings.ro</title>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{font-family:'Segoe UI',system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#333}h1{color:#1B2A4A}h2{color:#1B2A4A;margin-top:28px}</style>
    </head>
    <body>
    <h1>Termeni și Condiții</h1>
    <p>Ultima actualizare: Aprilie 2026</p>
    <h2>Serviciul</h2>
    <p>Meetings.ro oferă servicii de transcriere automată și generare rapoarte AI pentru ședințe profesionale, disponibile prin aplicație mobilă.</p>
    <h2>Cont și responsabilitate</h2>
    <p>Ești responsabil pentru securitatea contului tău și pentru conținutul înregistrărilor uploadate. Nu este permisă înregistrarea fără consimțământul participanților.</p>
    <h2>Planuri și plăți</h2>
    <p>Planul gratuit include 5 întâlniri pe lună. Abonamentele plătite (Pro, Enterprise) sunt lunare sau anuale, procesate prin Stripe. Anularea se poate face oricând, cu efect la finalul perioadei plătite.</p>
    <h2>Proprietate intelectuală</h2>
    <p>Conținutul înregistrărilor și transcrierilor tale îți aparține. Meetings.ro deține drepturile asupra platformei, designului și algoritmilor.</p>
    <h2>Limitarea răspunderii</h2>
    <p>Meetings.ro nu garantează acuratețea 100% a transcrierilor sau a rapoartelor generate. Serviciul este furnizat "așa cum este".</p>
    <h2>Modificări ale termenilor</h2>
    <p>Ne rezervăm dreptul de a modifica acești termeni. Utilizatorii vor fi notificați prin email cu minim 14 zile înainte.</p>
    <h2>Contact</h2>
    <p>hello@meetings.ro</p>
    </body></html>
    """)

