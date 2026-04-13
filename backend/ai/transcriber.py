"""
Local speech-to-text using faster-whisper.
Zero external network calls — fully air-gapped.

Model is loaded once at startup and reused across requests.
Falls back to cloud Groq/OpenAI if faster-whisper is not installed
(for backward compatibility during migration).
"""
import asyncio
import os
from functools import lru_cache
from typing import Optional

from config import settings


# ── Model singleton ────────────────────────────────────────────────────────────

_whisper_model = None


def get_whisper_model():
    """Load and cache the Whisper model (CPU/GPU as configured)."""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            print(f"[Whisper] Loading model '{settings.WHISPER_MODEL_SIZE}' on {settings.WHISPER_DEVICE}...")
            _whisper_model = WhisperModel(
                settings.WHISPER_MODEL_SIZE,
                device=settings.WHISPER_DEVICE,
                compute_type=settings.WHISPER_COMPUTE_TYPE,
                download_root=settings.WHISPER_MODEL_PATH,
            )
            print("[Whisper] Model loaded.")
        except ImportError:
            print("[Whisper] faster-whisper not installed — falling back to cloud transcription.")
            _whisper_model = None
    return _whisper_model


# ── Main transcription function ────────────────────────────────────────────────

async def transcribe_audio(file_path: str) -> dict:
    """
    Transcribe an audio file.
    Uses faster-whisper locally if available, otherwise falls back to Groq/OpenAI.
    Returns: {"text": str, "segments": list}
    """
    model = get_whisper_model()

    if model is not None:
        return await _transcribe_local(file_path, model)
    else:
        return await _transcribe_cloud(file_path)


async def _transcribe_local(file_path: str, model) -> dict:
    """Run faster-whisper in a thread pool to not block the event loop."""
    loop = asyncio.get_event_loop()

    def _run():
        segments_iter, info = model.transcribe(
            file_path,
            language="ro",
            beam_size=5,
            vad_filter=True,                    # skip silence segments
            vad_parameters={"min_silence_duration_ms": 500},
            initial_prompt=(
                "Aceasta este o înregistrare a unei ședințe în limba română. "
                "Participanții vorbesc clar și discută subiecte profesionale."
            ),
            word_timestamps=False,
        )
        segments = []
        full_text_parts = []
        for seg in segments_iter:
            segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
            full_text_parts.append(seg.text.strip())

        return {
            "text": " ".join(full_text_parts),
            "segments": segments,
        }

    return await loop.run_in_executor(None, _run)


async def _transcribe_cloud(file_path: str) -> dict:
    """
    Cloud fallback: tries Groq Whisper first, then OpenAI Whisper.
    Used only when faster-whisper is not installed (e.g. dev environment).
    """
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if not groq_key and not openai_key:
        raise RuntimeError(
            "Nicio metodă de transcriere disponibilă. "
            "Instalați faster-whisper sau configurați GROQ_API_KEY/OPENAI_API_KEY."
        )

    from openai import AsyncOpenAI

    if groq_key:
        client = AsyncOpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
        model_name = "whisper-large-v3"
        print("[Whisper] Cloud fallback: Groq")
    else:
        client = AsyncOpenAI(api_key=openai_key)
        model_name = "whisper-1"
        print("[Whisper] Cloud fallback: OpenAI")

    with open(file_path, "rb") as f:
        response = await client.audio.transcriptions.create(
            model=model_name,
            file=f,
            response_format="verbose_json",
            language="ro",
            temperature=0.0,
        )

    transcript_text = response.text
    segments = []
    if hasattr(response, "segments") and response.segments:
        for seg in response.segments:
            if isinstance(seg, dict):
                segments.append(seg)
            else:
                segments.append({
                    "start": getattr(seg, "start", 0),
                    "end": getattr(seg, "end", 0),
                    "text": getattr(seg, "text", ""),
                })

    return {"text": transcript_text, "segments": segments}
