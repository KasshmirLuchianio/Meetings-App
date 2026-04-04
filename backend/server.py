import os
import json
import uuid
import re
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from io import BytesIO
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import aiofiles
import stripe
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

load_dotenv()

# ==================== CONFIG ====================
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gal_meetings")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# ==================== STRIPE ====================
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICES = {
    "pro_monthly": "price_1TIOnGHa4KY3ww8wNuZfnCvN",
    "pro_yearly": "price_1TIOneHa4KY3ww8wkmyVhjDP",
    "enterprise_monthly": "price_1TIOnuHa4KY3ww8wYMLsIRIw",
    "enterprise_yearly": "price_1TIOoCHa4KY3ww8wjDYteZ14",
}

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
app = FastAPI(title="Meetings.ro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production to CORS_ALLOWED_ORIGINS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges"],  # HTTP 206 Range support
)

# ==================== DATABASE ====================
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
meetings_col = db["meetings"]
localities_col = db["localities"]


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


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed_default_localities()
    print("[GAL] Server started. Indexes ensured.")


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


# ==================== AI CLIENTS ====================
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


# ==================== AI PROCESSING ====================
async def transcribe_audio(file_path: str) -> dict:
    """Transcribe audio using OpenAI Whisper SDK."""
    with open(file_path, "rb") as audio_file:
        response = await openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            language="ro",
            prompt="Aceasta este o ședință de lucru despre proiecte de infrastructură în Delta Dunării. Localități: Crișan, Maliuc, Sulina, Tulcea, Chilia Veche, Letea.",
            temperature=0.0,
            timestamp_granularities=["segment"]
        )

    transcript_text = response.text
    segments = []
    if hasattr(response, 'segments') and response.segments:
        for seg in response.segments:
            if isinstance(seg, dict):
                segments.append(seg)
            else:
                segments.append({
                    "start": getattr(seg, 'start', 0),
                    "end": getattr(seg, 'end', 0),
                    "text": getattr(seg, 'text', '')
                })

    return {"text": transcript_text, "segments": segments}


async def extract_meeting_data(transcript: str, vertical_type: str = "GAL") -> dict:
    """Extract structured data from transcript using Anthropic Claude SDK."""
    from verticals import get_vertical_config

    vertical_config = get_vertical_config(vertical_type)

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2000,
        system=vertical_config.prompt_template,
        messages=[{
            "role": "user",
            "content": f"Extrage informațiile structurate din această transcriere:\n\n{transcript}"
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
        
        # Step 1: Transcribe
        print(f"[GAL] Transcribing meeting {meeting_id}...")
        transcription = await transcribe_audio(audio_path)
        
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "transcript": transcription["text"],
                "segments": transcription["segments"],
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Step 2: Extract structured data (GAL format)
        print(f"[Meetings.ro] Extracting data for meeting {meeting_id}...")
        vertical_type = meeting.get("vertical_type", "GAL")
        extracted = await extract_meeting_data(transcription["text"], vertical_type)
        
        # Determine locality
        locality = extracted.get("locality") or "Necunoscut"
        
        # Generate title: DD.MM.YYYY | Localitatea
        created_at = meeting.get("created_at", datetime.now(timezone.utc))
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        title = f"{created_at.strftime('%d.%m.%Y')} | {locality}"
        
        # Update meeting with GAL structured data
        update_data = {
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
        }
        
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": update_data}
        )
        
        # Ensure locality exists in localities collection
        if locality and locality != "Necunoscut":
            await localities_col.update_one(
                {"name": locality},
                {"$setOnInsert": {"name": locality, "created_at": datetime.now(timezone.utc)}, "$inc": {"count": 1}},
                upsert=True
            )
        
        print(f"[GAL] Meeting {meeting_id} processed successfully!")
        
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
    """Get all available vertical configurations."""
    from verticals import list_verticals
    return {"verticals": list_verticals()}


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


# ---- MEETINGS CRUD ----

@app.post("/api/meetings")
async def create_meeting(data: MeetingCreate = None):
    """Create a new meeting placeholder."""
    now = datetime.now(timezone.utc)
    
    # Get vertical_type from request or default to GAL
    vertical_type = data.vertical_type if data and hasattr(data, 'vertical_type') else "GAL"
    
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
        "status": "pending",
        "error": None,
        "duration": 0,
        "created_at": now,
        "updated_at": now
    }
    result = await meetings_col.insert_one(meeting)
    meeting["_id"] = result.inserted_id
    return serialize_doc(meeting)


@app.post("/api/meetings/{meeting_id}/upload")
async def upload_audio(meeting_id: str, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload audio file for a meeting and start processing."""
    # Validate meeting exists
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    
    # Save audio file
    ext = file.filename.split(".")[-1] if "." in file.filename else "webm"
    audio_filename = f"{meeting_id}.{ext}"
    audio_path = str(UPLOAD_DIR / audio_filename)
    
    async with aiofiles.open(audio_path, "wb") as f:
        content = await file.read()
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
async def get_audio(meeting_id: str, request: Request = None):
    """Stream audio file with HTTP Range request support for mobile playback."""
    from starlette.requests import Request as _Req
    
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting or not meeting.get("audio_path"):
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
    limit: int = Query(50, ge=1, le=100)
):
    """List meetings with optional filters."""
    query = {}
    
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
    month: int = Query(...)
):
    """Get dates that have meetings for a given month (for calendar highlighting)."""
    from calendar import monthrange
    
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    _, last_day = monthrange(year, month)
    end_date = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
    
    pipeline = [
        {"$match": {
            "created_at": {"$gte": start_date, "$lte": end_date}
        }},
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
    date: str = Query(...)
):
    """Get meetings for a specific date (YYYY-MM-DD)."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format dată invalid. Folosiți YYYY-MM-DD")
    
    next_date = target_date.replace(hour=23, minute=59, second=59)
    
    query = {
        "created_at": {"$gte": target_date, "$lte": next_date}
    }
    
    cursor = meetings_col.find(query).sort("created_at", -1)
    meetings = []
    async for doc in cursor:
        meetings.append(serialize_doc(doc))
    
    return {"meetings": meetings, "date": date, "count": len(meetings)}


@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    """Get single meeting detail."""
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    return serialize_doc(meeting)


@app.patch("/api/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, data: MeetingUpdate):
    """Update meeting title or locality."""
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    
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
async def delete_meeting(meeting_id: str):
    """Delete a meeting."""
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    
    # Delete audio file if exists
    if meeting.get("audio_path") and os.path.exists(meeting["audio_path"]):
        os.remove(meeting["audio_path"])
    
    await meetings_col.delete_one({"_id": ObjectId(meeting_id)})
    return {"status": "deleted"}


# ---- ACTION ITEMS ----

@app.patch("/api/meetings/{meeting_id}/actions/{action_id}")
async def toggle_action(meeting_id: str, action_id: str):
    """Toggle action item completion."""
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    
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
async def regenerate_meeting(meeting_id: str, background_tasks: BackgroundTasks):
    """Regenerate AI processing for a meeting."""
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    
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
async def list_localities():
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
async def create_locality(data: LocalityCreate):
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
async def rename_locality(locality_name: str, data: LocalityRename):
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
async def delete_locality(locality_name: str):
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
async def export_pdf(meeting_id: str):
    """Export meeting as PDF."""
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    
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
async def export_docx(meeting_id: str):
    """Export meeting as DOCX."""
    meeting = await meetings_col.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    
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
    filename = f"GAL_{safe_title}.docx"
    
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
async def get_meeting_status(meeting_id: str):
    """Quick status check for polling."""
    meeting = await meetings_col.find_one(
        {"_id": ObjectId(meeting_id)},
        {"status": 1, "error": 1, "title": 1, "locality": 1}
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Ședința nu a fost găsită")
    return serialize_doc(meeting)


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
async def create_checkout_session(req: CheckoutRequest):
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

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

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

