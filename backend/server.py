import os
import json
import uuid
import re
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from io import BytesIO
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import aiofiles

load_dotenv()

# ==================== CONFIG ====================
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gal_meetings")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

UPLOAD_DIR = Path("/tmp/gal_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ==================== APP ====================
app = FastAPI(title="GAL Meetings API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.on_event("startup")
async def startup():
    await ensure_indexes()
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


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    locality: Optional[str] = None


# ==================== AI PROCESSING ====================
async def transcribe_audio(file_path: str) -> dict:
    """Transcribe audio using OpenAI Whisper via Emergent."""
    from emergentintegrations.llm.openai import OpenAISpeechToText
    
    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    
    with open(file_path, "rb") as audio_file:
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
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


async def extract_meeting_data(transcript: str) -> dict:
    """Extract structured data from transcript using Claude."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    system_prompt = """Ești un asistent care extrage informații structurate din transcrierile ședințelor în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Fii concis și precis
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

FORMAT OUTPUT (JSON strict):
{
  "title": "Titlul scurt al ședinței",
  "locality": "Numele localității principale sau null",
  "summary": ["punct 1", "punct 2"],
  "key_points": ["punct cheie 1", "punct cheie 2"],
  "actions": [
    {
      "text": "Descrierea acțiunii",
      "owner": "Persoana responsabilă sau null",
      "deadline": "Termenul limită sau null"
    }
  ]
}"""
    
    session_id = f"extract-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    
    user_message = UserMessage(
        text=f"Extrage informațiile structurate din această transcriere de ședință:\n\n{transcript}"
    )
    
    response = await chat.send_message(user_message)
    
    # Parse JSON from response
    try:
        result = json.loads(response)
    except json.JSONDecodeError:
        # Try to extract JSON block
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(1))
        else:
            start = response.find('{')
            end = response.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(response[start:end])
            else:
                raise ValueError(f"Could not parse JSON from response")
    
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
        
        # Step 2: Extract structured data
        print(f"[GAL] Extracting data for meeting {meeting_id}...")
        extracted = await extract_meeting_data(transcription["text"])
        
        # Build action items with IDs
        actions = []
        for action in extracted.get("actions", []):
            actions.append({
                "id": str(uuid.uuid4()),
                "text": action.get("text", ""),
                "owner": action.get("owner"),
                "deadline": action.get("deadline"),
                "completed": False
            })
        
        # Determine locality
        locality = extracted.get("locality") or "Necunoscut"
        title = extracted.get("title") or meeting.get("title") or "Ședință fără titlu"
        
        # Update meeting with all extracted data
        update_data = {
            "title": title,
            "locality": locality,
            "summary": extracted.get("summary", []),
            "key_points": extracted.get("key_points", []),
            "actions": actions,
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

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "GAL Meetings API"}


# ---- MEETINGS CRUD ----

@app.post("/api/meetings")
async def create_meeting(data: MeetingCreate = None):
    """Create a new meeting placeholder."""
    now = datetime.now(timezone.utc)
    meeting = {
        "title": (data.title if data and data.title else None),
        "locality": (data.locality if data and data.locality else None),
        "date": now.isoformat(),
        "audio_path": None,
        "audio_url": None,
        "transcript": None,
        "segments": [],
        "summary": [],
        "key_points": [],
        "actions": [],
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
async def get_audio(meeting_id: str):
    """Stream audio file for playback."""
    from fastapi.responses import FileResponse
    
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
    
    return FileResponse(
        audio_path,
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(os.path.getsize(audio_path))
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
        
        actions = []
        for action in extracted.get("actions", []):
            actions.append({
                "id": str(uuid.uuid4()),
                "text": action.get("text", ""),
                "owner": action.get("owner"),
                "deadline": action.get("deadline"),
                "completed": False
            })
        
        locality = extracted.get("locality") or meeting.get("locality") or "Necunoscut"
        title = extracted.get("title") or meeting.get("title") or "Ședință fără titlu"
        
        await meetings_col.update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {
                "title": title,
                "locality": locality,
                "summary": extracted.get("summary", []),
                "key_points": extracted.get("key_points", []),
                "actions": actions,
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

@app.get("/api/localities")
async def list_localities():
    """List all localities with meeting counts."""
    # Get distinct localities from meetings
    pipeline = [
        {"$match": {"locality": {"$ne": None, "$ne": ""}}},
        {"$group": {"_id": "$locality", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    cursor = meetings_col.aggregate(pipeline)
    localities = []
    async for doc in cursor:
        localities.append({
            "name": doc["_id"],
            "count": doc["count"]
        })
    
    return {"localities": localities}


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
