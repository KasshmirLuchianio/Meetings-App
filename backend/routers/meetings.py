"""
Meetings router — /api/meetings*
All queries are scoped to tenant_id from the JWT.
Roles: secretary/admin can create+write; mayor/councilor read+export; clerk upload.
"""
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import aiofiles
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth.rbac import get_current_user, require_role, require_permission
from config import settings
from db.collections import meetings_col, localities_col

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

ALLOWED_AUDIO_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/m4a", "audio/x-m4a", "audio/mp4", "audio/ogg",
    "audio/webm", "audio/aac", "audio/3gpp",
}
MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


# ── Models ─────────────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: Optional[str] = None
    locality: Optional[str] = None
    vertical_type: Optional[str] = "GAL"


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    locality: Optional[str] = None


class ActionItemModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    completed: bool = False


# ── Helpers ────────────────────────────────────────────────────────────────────

def serialize_doc(doc):
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [
                serialize_doc(v) if isinstance(v, dict)
                else (str(v) if isinstance(v, ObjectId) else v)
                for v in value
            ]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result


async def verify_meeting_ownership(meeting_id: str, user: dict) -> dict:
    """Fetch meeting and verify it belongs to the same tenant (+ user for non-admins)."""
    try:
        meeting = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="ID meeting invalid")
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")

    # Tenant isolation — hard block
    if str(meeting.get("tenant_id", "")) != str(user.get("tenant_id", "")):
        raise HTTPException(status_code=403, detail="Nu ai acces la această ședință")

    # Admins and secretaries see all tenant meetings; others only their own
    role = user.get("role", "clerk")
    if role not in ("admin", "secretary", "mayor", "councilor"):
        if meeting.get("user_id") and meeting["user_id"] != str(user["_id"]):
            raise HTTPException(status_code=403, detail="Nu ai acces la această ședință")

    return meeting


async def reset_monthly_if_needed(user: dict) -> dict:
    from db.collections import users_col as ucol
    last_reset = user.get("last_monthly_reset")
    now = datetime.now(timezone.utc)
    if last_reset is None or (
        isinstance(last_reset, datetime)
        and (last_reset.month != now.month or last_reset.year != now.year)
    ):
        await ucol().update_one(
            {"_id": user["_id"]},
            {"$set": {"meetings_used_this_month": 0, "last_monthly_reset": now}},
        )
        user["meetings_used_this_month"] = 0
    return user


async def check_plan_limit(user: dict):
    user = await reset_monthly_if_needed(user)
    limit = settings.LICENSE_MAX_MEETINGS_PER_MONTH
    if limit == -1:
        return
    used = user.get("meetings_used_this_month", 0)
    if used >= limit:
        raise HTTPException(
            status_code=402,
            detail=f"Limita lunară de {limit} întâlniri atinsă. Contactați administratorul.",
        )


async def increment_usage(user_id):
    from db.collections import users_col as ucol
    await ucol().update_one({"_id": user_id}, {"$inc": {"meetings_used_this_month": 1}})


# ── CRUD ───────────────────────────────────────────────────────────────────────

@router.post("")
async def create_meeting(
    data: MeetingCreate = None,
    user: dict = Depends(require_role("secretary", "clerk", "admin")),
):
    await check_plan_limit(user)
    now = datetime.now(timezone.utc)
    vertical_type = (data.vertical_type if data and data.vertical_type else "GAL")

    meeting = {
        "title": data.title if data and data.title else None,
        "locality": data.locality if data and data.locality else None,
        "date": now.isoformat(),
        "audio_path": None,
        "audio_url": None,
        "transcript": None,
        "transcript_original": None,
        "segments": [],
        "vertical_type": vertical_type,
        "vertical_config": {},
        # GAL backward-compat fields
        "data_desfasurare": None, "format_intalnire": None,
        "loc_desfasurare": None, "mod_promovare": None,
        "obiectiv": None, "tematica": None,
        "scurta_descriere": None, "numar_participanti": None, "concluzia": None,
        # Ownership
        "user_id": str(user["_id"]),
        "tenant_id": user["tenant_id"],
        "status": "pending",
        "error": None,
        "duration": 0,
        "created_at": now,
        "updated_at": now,
    }
    result = await meetings_col().insert_one(meeting)
    meeting["_id"] = result.inserted_id
    await increment_usage(user["_id"])
    return serialize_doc(meeting)


@router.get("")
async def list_meetings(
    locality: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    vertical_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """List meetings scoped to tenant. Admins/secretaries see all; others see own."""
    query: dict = {"tenant_id": user["tenant_id"]}
    role = user.get("role", "clerk")
    if role not in ("admin", "secretary", "mayor", "councilor"):
        query["user_id"] = str(user["_id"])

    if locality:
        query["locality"] = locality
    if status:
        query["status"] = status
    if vertical_type:
        query["vertical_type"] = vertical_type
    if q:
        query["$text"] = {"$search": q}

    skip = (page - 1) * limit
    total = await meetings_col().count_documents(query)
    cursor = meetings_col().find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = [serialize_doc(doc) async for doc in cursor]

    return {"meetings": docs, "total": total, "page": page, "limit": limit,
            "pages": (total + limit - 1) // limit}


@router.get("/calendar-dates")
async def get_meeting_dates(
    year: int = Query(...),
    month: int = Query(...),
    user: dict = Depends(get_current_user),
):
    from calendar import monthrange
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    _, last_day = monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)

    match_filter: dict = {
        "tenant_id": user["tenant_id"],
        "created_at": {"$gte": start_date, "$lte": end_date},
    }
    role = user.get("role", "clerk")
    if role not in ("admin", "secretary", "mayor", "councilor"):
        match_filter["user_id"] = str(user["_id"])

    pipeline = [
        {"$match": match_filter},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    dates = {}
    async for doc in meetings_col().aggregate(pipeline):
        dates[doc["_id"]] = doc["count"]
    return {"dates": dates}


@router.get("/calendar-by-date")
async def get_meetings_by_date(
    date: str = Query(...),
    user: dict = Depends(get_current_user),
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format dată invalid. Folosiți YYYY-MM-DD")

    end_date = target_date.replace(hour=23, minute=59, second=59)
    query: dict = {
        "tenant_id": user["tenant_id"],
        "created_at": {"$gte": target_date, "$lte": end_date},
    }
    role = user.get("role", "clerk")
    if role not in ("admin", "secretary", "mayor", "councilor"):
        query["user_id"] = str(user["_id"])

    docs = [serialize_doc(doc) async for doc in meetings_col().find(query).sort("created_at", -1)]
    return {"meetings": docs, "date": date, "count": len(docs)}


@router.get("/{meeting_id}/status")
async def get_meeting_status(meeting_id: str, user: dict = Depends(get_current_user)):
    meeting = await verify_meeting_ownership(meeting_id, user)
    return serialize_doc({
        "_id": meeting["_id"],
        "status": meeting.get("status"),
        "error": meeting.get("error"),
        "title": meeting.get("title"),
        "locality": meeting.get("locality"),
    })


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    meeting = await verify_meeting_ownership(meeting_id, user)
    return serialize_doc(meeting)


@router.patch("/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    data: MeetingUpdate,
    user: dict = Depends(require_role("secretary", "admin")),
):
    await verify_meeting_ownership(meeting_id, user)
    update_fields: dict = {"updated_at": datetime.now(timezone.utc)}
    if data.title is not None:
        update_fields["title"] = data.title
    if data.locality is not None:
        update_fields["locality"] = data.locality
        if data.locality and data.locality != "Necunoscut":
            await localities_col().update_one(
                {"name": data.locality, "tenant_id": user["tenant_id"]},
                {"$setOnInsert": {"name": data.locality, "tenant_id": user["tenant_id"],
                                  "created_at": datetime.now(timezone.utc)},
                 "$inc": {"count": 1}},
                upsert=True,
            )

    await meetings_col().update_one({"_id": ObjectId(meeting_id)}, {"$set": update_fields})
    updated = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
    return serialize_doc(updated)


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: str,
    user: dict = Depends(require_role("secretary", "admin")),
):
    meeting = await verify_meeting_ownership(meeting_id, user)
    if meeting.get("audio_path") and os.path.exists(meeting["audio_path"]):
        os.remove(meeting["audio_path"])
    await meetings_col().delete_one({"_id": ObjectId(meeting_id)})
    return {"status": "deleted"}


# ── Audio upload ───────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/upload")
async def upload_audio(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(require_role("secretary", "clerk", "admin")),
):
    if file.content_type and file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=415, detail="Format audio neacceptat")

    await verify_meeting_ownership(meeting_id, user)

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "webm"
    allowed_exts = {"mp3", "wav", "m4a", "mp4", "ogg", "webm", "aac", "3gpp"}
    if ext not in allowed_exts:
        ext = "webm"

    # Namespace uploads by tenant to prevent collisions
    tenant_upload_dir = settings.UPLOAD_DIR / str(user["tenant_id"])
    tenant_upload_dir.mkdir(parents=True, exist_ok=True)
    audio_filename = f"{meeting_id}.{ext}"
    audio_path = str(tenant_upload_dir / audio_filename)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"Fișierul depășește limita de {settings.MAX_UPLOAD_SIZE_MB}MB")

    async with aiofiles.open(audio_path, "wb") as f:
        await f.write(content)

    file_size = os.path.getsize(audio_path)

    await meetings_col().update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {
            "audio_path": audio_path,
            "audio_url": f"/api/meetings/{meeting_id}/audio",
            "status": "uploading",
            "file_size": file_size,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    background_tasks.add_task(process_meeting, meeting_id)
    updated = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
    return serialize_doc(updated)


@router.get("/{meeting_id}/audio")
async def get_audio(meeting_id: str, request: Request, user: dict = Depends(get_current_user)):
    meeting = await verify_meeting_ownership(meeting_id, user)
    if not meeting.get("audio_path"):
        raise HTTPException(status_code=404, detail="Audio nu a fost găsit")

    audio_path = meeting["audio_path"]
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Fișier audio lipsă")

    ext = audio_path.split(".")[-1]
    media_types = {"webm": "audio/webm", "mp3": "audio/mpeg", "wav": "audio/wav",
                   "m4a": "audio/mp4", "ogg": "audio/ogg"}
    media_type = media_types.get(ext, "audio/webm")
    file_size = os.path.getsize(audio_path)
    range_header = request.headers.get("range")

    if range_header:
        try:
            parts = range_header.replace("bytes=", "").split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        except (ValueError, IndexError):
            start, end = 0, file_size - 1
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        content_length = end - start + 1

        async def range_gen():
            async with aiofiles.open(audio_path, "rb") as f:
                await f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk = await f.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(range_gen(), status_code=206, media_type=media_type,
                                  headers={"Content-Range": f"bytes {start}-{end}/{file_size}",
                                           "Accept-Ranges": "bytes",
                                           "Content-Length": str(content_length)})
    else:
        async def full_gen():
            async with aiofiles.open(audio_path, "rb") as f:
                while chunk := await f.read(65536):
                    yield chunk
        return StreamingResponse(full_gen(), media_type=media_type,
                                  headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)})


# ── AI actions ─────────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/regenerate")
async def regenerate_meeting(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role("secretary", "admin")),
):
    meeting = await verify_meeting_ownership(meeting_id, user)
    if not meeting.get("transcript") and not meeting.get("audio_path"):
        raise HTTPException(status_code=400, detail="Nu există transcriere sau audio pentru procesare")

    await meetings_col().update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {"status": "processing", "error": None, "updated_at": datetime.now(timezone.utc)}},
    )
    if meeting.get("transcript"):
        background_tasks.add_task(reprocess_transcript, meeting_id)
    else:
        background_tasks.add_task(process_meeting, meeting_id)
    return {"status": "regenerating"}


@router.post("/{meeting_id}/correct-transcript")
async def correct_transcript(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role("secretary", "admin")),
):
    meeting = await verify_meeting_ownership(meeting_id, user)
    if not meeting.get("transcript"):
        raise HTTPException(status_code=400, detail="Nu există transcriere de corectat")

    original = meeting.get("transcript_original") or meeting.get("transcript")
    await meetings_col().update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {"transcript_original": original, "status": "processing",
                  "error": None, "updated_at": datetime.now(timezone.utc)}},
    )
    background_tasks.add_task(correct_and_reprocess, meeting_id)
    return {"status": "correcting"}


# ── Speaker onboarding ────────────────────────────────────────────────────────

class SpeakerOnboardResponse(BaseModel):
    participant_id: str
    name: Optional[str] = None
    role: Optional[str] = None
    transcribed_text: Optional[str] = None
    has_embedding: bool = False


@router.post("/{meeting_id}/speakers/onboard", response_model=SpeakerOnboardResponse)
async def onboard_speaker(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: Optional[str] = None,
    role: Optional[str] = None,
    user: dict = Depends(require_role("secretary", "clerk", "admin")),
):
    """
    Upload a short voice sample (5–10s) for a participant.
    Backend transcribes it and extracts a speaker embedding for later diarization.
    Voice files are stored temporarily and deleted at session end (GDPR).
    """
    await verify_meeting_ownership(meeting_id, user)

    # Save the voice sample audio
    tenant_dir = settings.UPLOAD_DIR / str(user["tenant_id"]) / "onboarding"
    tenant_dir.mkdir(parents=True, exist_ok=True)
    participant_id = str(uuid.uuid4())
    ext = (file.filename or "sample").rsplit(".", 1)[-1].lower()
    if ext not in {"webm", "wav", "mp3", "ogg", "m4a", "mp4"}:
        ext = "webm"
    sample_path = str(tenant_dir / f"{meeting_id}_{participant_id}.{ext}")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:   # 20 MB cap on voice samples
        raise HTTPException(status_code=413, detail="Eșantionul vocal depășește 20MB")

    import aiofiles as _aiofiles
    async with _aiofiles.open(sample_path, "wb") as f_out:
        await f_out.write(content)

    # Transcribe + embed in background, store result on meeting document
    background_tasks.add_task(
        _process_voice_sample,
        meeting_id, participant_id, sample_path,
        name, role,
    )

    return SpeakerOnboardResponse(
        participant_id=participant_id,
        name=name,
        role=role,
    )


async def _process_voice_sample(
    meeting_id: str,
    participant_id: str,
    audio_path: str,
    provided_name: Optional[str],
    provided_role: Optional[str],
):
    """Background: transcribe voice sample, extract embedding, store in meeting."""
    from ai.diarization import transcribe_voice_sample, extract_embedding, embedding_to_b64

    try:
        info = await transcribe_voice_sample(audio_path)
        name = provided_name or info.get("name") or f"Participant {participant_id[:4]}"
        role = provided_role or info.get("role") or ""

        emb_b64 = None
        emb = await extract_embedding(audio_path)
        if emb is not None:
            emb_b64 = embedding_to_b64(emb)

        profile = {
            "participant_id": participant_id,
            "name": name,
            "role": role,
            "audio_path": audio_path,
            "transcribed_text": info.get("text", ""),
            "embedding": emb_b64,
        }

        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$push": {"voice_profiles": profile},
             "$set": {"updated_at": datetime.now(timezone.utc)}},
        )
        print(f"[Onboarding] Stored profile for '{name}' in meeting {meeting_id}.")
    except Exception as exc:
        print(f"[Onboarding] _process_voice_sample failed: {exc}")


@router.get("/{meeting_id}/speakers")
async def list_speakers(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    """List onboarded speaker profiles for a meeting (names/roles only — no embeddings)."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    profiles = meeting.get("voice_profiles", [])
    # Strip embedding vectors before returning (large binary data, not needed by UI)
    safe = [
        {k: v for k, v in p.items() if k != "embedding"}
        for p in profiles
    ]
    return {"speakers": safe, "count": len(safe)}


@router.delete("/{meeting_id}/speakers")
async def delete_speakers(
    meeting_id: str,
    user: dict = Depends(require_role("secretary", "admin")),
):
    """
    GDPR cleanup: delete all voice sample files and wipe voice_profiles from the meeting.
    Call this when the session ends.
    """
    meeting = await verify_meeting_ownership(meeting_id, user)
    profiles = meeting.get("voice_profiles", [])
    deleted_files = 0
    for profile in profiles:
        audio_path = profile.get("audio_path", "")
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                deleted_files += 1
            except OSError:
                pass

    await meetings_col().update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {"voice_profiles": [], "updated_at": datetime.now(timezone.utc)}},
    )
    return {"status": "deleted", "files_removed": deleted_files}


# ── Report generation ──────────────────────────────────────────────────────────

@router.post("/{meeting_id}/generate-report")
async def generate_report(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role("secretary", "admin")),
):
    """
    Trigger LLM structuring pipeline to produce a Proces Verbal JSON.
    The meeting must have a transcript (status='done').
    Poll GET /{meeting_id} and check report_status ('generating'|'done'|'error').
    """
    meeting = await verify_meeting_ownership(meeting_id, user)
    if not meeting.get("transcript"):
        raise HTTPException(
            status_code=400,
            detail="Nu există transcriere. Procesați mai întâi înregistrarea audio.",
        )
    if meeting.get("report_status") == "generating":
        return {"status": "already_generating"}

    await meetings_col().update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {
            "report_status": "generating",
            "report_error":  None,
            "updated_at":    datetime.now(timezone.utc),
        }},
    )
    background_tasks.add_task(run_generate_report, meeting_id)
    return {"status": "generating"}


@router.get("/{meeting_id}/report")
async def get_report(
    meeting_id: str,
    user: dict = Depends(get_current_user),
):
    """Return the structured Proces Verbal JSON for a meeting."""
    meeting = await verify_meeting_ownership(meeting_id, user)
    report_status = meeting.get("report_status")
    if not report_status:
        raise HTTPException(
            status_code=404,
            detail="Raportul nu a fost generat. Apelați POST /generate-report mai întâi.",
        )
    return {
        "report_status": report_status,
        "report_error":  meeting.get("report_error"),
        "proces_verbal": meeting.get("proces_verbal"),
    }


# ── Action items ───────────────────────────────────────────────────────────────

@router.patch("/{meeting_id}/actions/{action_id}")
async def toggle_action(
    meeting_id: str,
    action_id: str,
    user: dict = Depends(require_role("secretary", "clerk", "admin")),
):
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

    await meetings_col().update_one(
        {"_id": ObjectId(meeting_id)},
        {"$set": {"actions": actions, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
    return serialize_doc(updated)


# ── Localities ─────────────────────────────────────────────────────────────────

from fastapi import APIRouter as _AR
localities_router = _AR(prefix="/api/localities", tags=["localities"])


class LocalityCreate(BaseModel):
    name: str


class LocalityRename(BaseModel):
    new_name: str


@localities_router.get("")
async def list_localities(user: dict = Depends(get_current_user)):
    all_loc: dict = {}
    async for doc in localities_col().find({"tenant_id": user["tenant_id"]}).sort("name", 1):
        all_loc[doc["name"]] = {"name": doc["name"], "count": 0, "is_default": doc.get("is_default", False)}

    pipeline = [
        {"$match": {"tenant_id": user["tenant_id"], "locality": {"$ne": None, "$exists": True}}},
        {"$group": {"_id": "$locality", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    async for doc in meetings_col().aggregate(pipeline):
        name = doc["_id"]
        if not name:
            continue
        if name in all_loc:
            all_loc[name]["count"] = doc["count"]
        else:
            all_loc[name] = {"name": name, "count": doc["count"], "is_default": False}

    return {"localities": sorted(all_loc.values(), key=lambda x: x["name"] or "")}


@localities_router.post("")
async def create_locality(
    data: LocalityCreate,
    user: dict = Depends(require_role("secretary", "admin")),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Numele localității nu poate fi gol")
    existing = await localities_col().find_one({"name": name, "tenant_id": user["tenant_id"]})
    if existing:
        raise HTTPException(status_code=409, detail="Localitate deja existentă")
    await localities_col().insert_one({
        "name": name, "tenant_id": user["tenant_id"],
        "created_at": datetime.now(timezone.utc), "is_default": False,
    })
    return {"name": name, "count": 0, "is_default": False}


@localities_router.patch("/{locality_name}")
async def rename_locality(
    locality_name: str,
    data: LocalityRename,
    user: dict = Depends(require_role("secretary", "admin")),
):
    new_name = data.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Numele nou nu poate fi gol")
    existing = await localities_col().find_one({"name": locality_name, "tenant_id": user["tenant_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Localitatea nu a fost găsită")
    if new_name != locality_name:
        target = await localities_col().find_one({"name": new_name, "tenant_id": user["tenant_id"]})
        if target:
            raise HTTPException(status_code=409, detail="O localitate cu acest nume există deja")
    await localities_col().update_one(
        {"name": locality_name, "tenant_id": user["tenant_id"]},
        {"$set": {"name": new_name, "updated_at": datetime.now(timezone.utc)}},
    )
    result = await meetings_col().update_many(
        {"locality": locality_name, "tenant_id": user["tenant_id"]},
        {"$set": {"locality": new_name}},
    )
    return {"old_name": locality_name, "new_name": new_name, "meetings_updated": result.modified_count}


@localities_router.delete("/{locality_name}")
async def delete_locality(
    locality_name: str,
    user: dict = Depends(require_role("secretary", "admin")),
):
    await localities_col().delete_one({"name": locality_name, "tenant_id": user["tenant_id"]})
    await meetings_col().update_many(
        {"locality": locality_name, "tenant_id": user["tenant_id"]},
        {"$set": {"locality": None}},
    )
    return {"status": "deleted", "name": locality_name}


# ── Background AI tasks ────────────────────────────────────────────────────────

async def process_meeting(meeting_id: str):
    from ai.transcriber import transcribe_audio
    from ai.llm_client import extract_meeting_data
    try:
        meeting = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
        if not meeting:
            return

        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc)}},
        )

        audio_path = meeting.get("audio_path")
        if not audio_path or not os.path.exists(audio_path):
            await meetings_col().update_one(
                {"_id": ObjectId(meeting_id)},
                {"$set": {"status": "error", "error": "Fișier audio lipsă",
                           "updated_at": datetime.now(timezone.utc)}},
            )
            return

        print(f"[AI] Transcribing {meeting_id}...")
        transcription = await transcribe_audio(audio_path)

        # Speaker diarization (if voice profiles were onboarded)
        voice_profiles = meeting.get("voice_profiles", [])
        diarized_segments = []
        try:
            from ai.diarization import get_diarized_transcript
            diarized_segments = await get_diarized_transcript(
                audio_path,
                transcription["segments"],
                voice_profiles,
            )
        except Exception as diar_exc:
            print(f"[AI] Diarization failed (non-fatal): {diar_exc}")

        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "transcript":        transcription["text"],
                "segments":          transcription["segments"],
                "diarized_segments": diarized_segments,
                "updated_at":        datetime.now(timezone.utc),
            }},
        )

        vertical_type = meeting.get("vertical_type", "GAL")
        tenant_id = meeting.get("tenant_id")
        print(f"[AI] Extracting data for {meeting_id} (vertical={vertical_type})...")
        extracted = await extract_meeting_data(transcription["text"], vertical_type, tenant_id=tenant_id)

        locality = extracted.get("locality") or extracted.get("loc_desfasurare") or "Necunoscut"
        created_at = meeting.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        title = f"{created_at.strftime('%d.%m.%Y')} | {locality}"

        update_data = {
            "title": title, "locality": locality,
            "vertical_config": extracted,
            "status": "done", "error": None,
            "updated_at": datetime.now(timezone.utc),
        }
        for field in ["data_desfasurare", "format_intalnire", "loc_desfasurare",
                       "mod_promovare", "obiectiv", "tematica", "scurta_descriere",
                       "numar_participanti", "concluzia"]:
            if field in extracted:
                update_data[field] = extracted[field]

        await meetings_col().update_one({"_id": ObjectId(meeting_id)}, {"$set": update_data})

        if locality and locality != "Necunoscut" and tenant_id:
            await localities_col().update_one(
                {"name": locality, "tenant_id": tenant_id},
                {"$setOnInsert": {"name": locality, "tenant_id": tenant_id,
                                  "created_at": datetime.now(timezone.utc)},
                 "$inc": {"count": 1}},
                upsert=True,
            )
        print(f"[AI] Meeting {meeting_id} done.")
    except Exception as e:
        import traceback; traceback.print_exc()
        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"status": "error", "error": str(e), "updated_at": datetime.now(timezone.utc)}},
        )


async def reprocess_transcript(meeting_id: str):
    from ai.llm_client import extract_meeting_data
    try:
        meeting = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
        if not meeting or not meeting.get("transcript"):
            return
        vertical_type = meeting.get("vertical_type", "GAL")
        tenant_id = meeting.get("tenant_id")
        extracted = await extract_meeting_data(meeting["transcript"], vertical_type, tenant_id=tenant_id)
        locality = extracted.get("locality") or meeting.get("locality") or "Necunoscut"
        created_at = meeting.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        title = f"{created_at.strftime('%d.%m.%Y')} | {locality}"
        update = {"title": title, "locality": locality, "vertical_config": extracted,
                   "status": "done", "error": None, "updated_at": datetime.now(timezone.utc)}
        for f in ["data_desfasurare","format_intalnire","loc_desfasurare","mod_promovare",
                   "obiectiv","tematica","scurta_descriere","numar_participanti","concluzia"]:
            if f in extracted:
                update[f] = extracted[f]
        await meetings_col().update_one({"_id": ObjectId(meeting_id)}, {"$set": update})
    except Exception as e:
        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"status": "error", "error": str(e), "updated_at": datetime.now(timezone.utc)}},
        )


async def run_generate_report(meeting_id: str):
    """Background task: LLM structuring into Proces Verbal JSON."""
    from ai.llm_client import generate_proces_verbal_report
    try:
        meeting = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
        if not meeting:
            return

        transcript = meeting.get("transcript", "")
        diarized   = meeting.get("diarized_segments", [])
        from config import settings as _s
        institution = _s.INSTITUTION_NAME

        print(f"[Report] Generating Proces Verbal for {meeting_id}...")
        report = await generate_proces_verbal_report(transcript, diarized, institution)

        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "proces_verbal":  report,
                "report_status":  "done",
                "report_error":   None,
                "updated_at":     datetime.now(timezone.utc),
            }},
        )
        print(f"[Report] Proces Verbal done for {meeting_id}.")
    except Exception as exc:
        import traceback; traceback.print_exc()
        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "report_status": "error",
                "report_error":  str(exc),
                "updated_at":    datetime.now(timezone.utc),
            }},
        )


async def correct_and_reprocess(meeting_id: str):
    from ai.llm_client import correct_transcript_text, extract_meeting_data
    try:
        meeting = await meetings_col().find_one({"_id": ObjectId(meeting_id)})
        if not meeting or not meeting.get("transcript"):
            return
        corrected = await correct_transcript_text(meeting["transcript"])
        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"transcript": corrected,
                       "transcript_corrected_at": datetime.now(timezone.utc),
                       "updated_at": datetime.now(timezone.utc)}},
        )
        vertical_type = meeting.get("vertical_type", "GAL")
        tenant_id = meeting.get("tenant_id")
        extracted = await extract_meeting_data(corrected, vertical_type, tenant_id=tenant_id)
        locality = extracted.get("locality") or meeting.get("locality") or "Necunoscut"
        created_at = meeting.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        title = f"{created_at.strftime('%d.%m.%Y')} | {locality}"
        update = {"title": title, "locality": locality, "vertical_config": extracted,
                   "status": "done", "error": None, "updated_at": datetime.now(timezone.utc)}
        for f in ["data_desfasurare","format_intalnire","loc_desfasurare","mod_promovare",
                   "obiectiv","tematica","scurta_descriere","numar_participanti","concluzia"]:
            if f in extracted:
                update[f] = extracted[f]
        await meetings_col().update_one({"_id": ObjectId(meeting_id)}, {"$set": update})
    except Exception as e:
        await meetings_col().update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"status": "error", "error": str(e), "updated_at": datetime.now(timezone.utc)}},
        )
