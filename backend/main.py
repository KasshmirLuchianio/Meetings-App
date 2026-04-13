"""
main.py — Application factory.
Replaces the monolithic server.py.
All route logic lives in routers/.
"""
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import settings
from db.collections import users_col, meetings_col, localities_col, tenants_col

# ── Validate config at startup ────────────────────────────────────────────────
settings.validate()

# ── App factory ────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=f"{settings.INSTITUTION_NAME} — Meetings API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges"],
)

# ── Mount routers ──────────────────────────────────────────────────────────────
from routers.auth import router as auth_router
from routers.meetings import router as meetings_router, localities_router
from routers.export import router as export_router
from routers.admin import router as admin_router
from routers.verticals import router as verticals_router

app.include_router(auth_router)
app.include_router(meetings_router)
app.include_router(localities_router)
app.include_router(export_router)
app.include_router(admin_router)
app.include_router(verticals_router)


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": settings.INSTITUTION_NAME, "version": "2.0.0"}


# ── Legal pages ────────────────────────────────────────────────────────────────
@app.get("/privacy", response_class=HTMLResponse)
async def privacy():
    name = settings.INSTITUTION_NAME
    return HTMLResponse(f"""
    <html><head><title>Politică de Confidențialitate — {name}</title>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{{font-family:'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#333}}h1,h2{{color:#1B2A4A}}</style>
    </head><body>
    <h1>Politică de Confidențialitate</h1>
    <p>Platforma {name} procesează date exclusiv în rețeaua internă a instituției.
    Nicio dată nu este transmisă către servere externe.</p>
    <h2>Contact</h2><p>Contactați administratorul de sistem al instituției.</p>
    </body></html>
    """)


@app.get("/terms", response_class=HTMLResponse)
async def terms():
    name = settings.INSTITUTION_NAME
    return HTMLResponse(f"""
    <html><head><title>Termeni — {name}</title>
    <meta charset="utf-8">
    <style>body{{font-family:'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7}}</style>
    </head><body>
    <h1>Termeni de utilizare</h1>
    <p>Platforma {name} este destinată exclusiv utilizului intern al instituției.</p>
    </body></html>
    """)


# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Indexes
    await meetings_col().create_index("tenant_id")
    await meetings_col().create_index([("tenant_id", 1), ("created_at", -1)])
    await meetings_col().create_index([("tenant_id", 1), ("locality", 1)])
    await meetings_col().create_index([("tenant_id", 1), ("status", 1)])
    await meetings_col().create_index([("title", "text"), ("transcript", "text"), ("locality", "text")])
    await meetings_col().create_index("user_id")

    await users_col().create_index([("tenant_id", 1), ("email", 1)], unique=True)
    await users_col().create_index("reset_token", sparse=True)
    await users_col().create_index("verify_token", sparse=True)

    await localities_col().create_index([("tenant_id", 1), ("name", 1)], unique=True)
    await tenants_col().create_index("slug", unique=True)

    # Ensure default tenant exists (idempotent)
    existing = await tenants_col().find_one({"slug": "default"})
    if not existing:
        await tenants_col().insert_one({
            "name": settings.INSTITUTION_NAME,
            "slug": "default",
            "institution_type": "primarie",
            "config": {},
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        print("[Startup] Default tenant created.")

    # Pre-load Whisper model in background so first request is fast
    try:
        from ai.transcriber import get_whisper_model
        import asyncio
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, get_whisper_model)
    except Exception as e:
        print(f"[Startup] Whisper preload skipped: {e}")

    print(f"[Startup] {settings.INSTITUTION_NAME} API v2.0 ready.")
