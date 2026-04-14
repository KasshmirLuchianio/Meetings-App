"""
Speaker diarization via pyannote/speaker-diarization-3.1.
Fully local — no audio or text leaves the server.

Requirements (optional — graceful fallback if not installed):
    pip install pyannote.audio torch

Also requires PYANNOTE_AUTH_TOKEN env var (free HuggingFace account;
accept model terms at huggingface.co/pyannote/speaker-diarization-3.1).

Pipeline:
  1. Onboarding  — each participant records ~8s voice sample.
       transcribe_voice_sample()  → extract name/role via regex
       extract_embedding()        → speaker fingerprint (numpy vector)
  2. Main audio  — diarize_audio()  → SPEAKER_00, SPEAKER_01 ... segments
  3. Matching    — match_speakers() → map labels → real names via cosine sim
  4. Merge       — merge_transcript_with_diarization() → final labelled segments

Falls back gracefully at every step if pyannote is not installed or the
auth token is missing.
"""
import asyncio
import base64
import io
import os
from typing import Dict, List, Optional, Tuple

import numpy as np

from config import settings


# ── Singleton models ────────────────────────────────────────────────────────────

_diarize_pipeline = None
_embed_inference = None


def _get_diarize_pipeline():
    global _diarize_pipeline
    if _diarize_pipeline is None:
        token = getattr(settings, "PYANNOTE_AUTH_TOKEN", "")
        if not token:
            return None
        try:
            from pyannote.audio import Pipeline
            _diarize_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=token,
            )
            try:
                import torch
                if torch.cuda.is_available():
                    _diarize_pipeline.to(torch.device("cuda"))
                    print("[Diarization] Pipeline loaded on GPU.")
                else:
                    print("[Diarization] Pipeline loaded on CPU.")
            except ImportError:
                print("[Diarization] Pipeline loaded (no torch GPU check).")
        except ImportError:
            print("[Diarization] pyannote.audio not installed — diarization disabled.")
            _diarize_pipeline = None
        except Exception as exc:
            print(f"[Diarization] Pipeline init failed: {exc}")
            _diarize_pipeline = None
    return _diarize_pipeline


def _get_embed_inference():
    global _embed_inference
    if _embed_inference is None:
        token = getattr(settings, "PYANNOTE_AUTH_TOKEN", "")
        if not token:
            return None
        try:
            from pyannote.audio import Inference
            _embed_inference = Inference(
                "pyannote/embedding",
                window="whole",
                use_auth_token=token,
            )
            print("[Diarization] Embedding model loaded.")
        except Exception as exc:
            print(f"[Diarization] Embedding model failed to load: {exc}")
            _embed_inference = None
    return _embed_inference


# ── Embedding serialisation ─────────────────────────────────────────────────────

def embedding_to_b64(emb: np.ndarray) -> str:
    """Serialize a numpy embedding to a base64 string for MongoDB storage."""
    buf = io.BytesIO()
    np.save(buf, emb)
    return base64.b64encode(buf.getvalue()).decode()


def b64_to_embedding(b64str: str) -> np.ndarray:
    """Deserialize a base64 string back to a numpy embedding."""
    buf = io.BytesIO(base64.b64decode(b64str))
    return np.load(buf)


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ── Core diarization ────────────────────────────────────────────────────────────

async def diarize_audio(audio_path: str) -> List[dict]:
    """
    Run speaker diarization on an audio file.
    Returns list of {speaker_label, start, end} dicts.
    Returns empty list if pyannote is not available.
    """
    pipeline = _get_diarize_pipeline()
    if pipeline is None:
        return []

    loop = asyncio.get_event_loop()

    def _run():
        diarization = pipeline(audio_path)
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "speaker_label": speaker,
                "start": round(turn.start, 2),
                "end": round(turn.end, 2),
            })
        return segments

    try:
        return await loop.run_in_executor(None, _run)
    except Exception as exc:
        print(f"[Diarization] diarize_audio failed: {exc}")
        return []


# ── Voice profile (onboarding) ──────────────────────────────────────────────────

async def extract_embedding(audio_path: str) -> Optional[np.ndarray]:
    """
    Extract a speaker embedding vector from a short audio clip.
    Returns None if the embedding model is unavailable.
    """
    inference = _get_embed_inference()
    if inference is None:
        return None

    loop = asyncio.get_event_loop()

    def _run():
        emb = inference(audio_path)
        arr = emb.data.squeeze() if hasattr(emb, "data") else np.array(emb).squeeze()
        return arr

    try:
        return await loop.run_in_executor(None, _run)
    except Exception as exc:
        print(f"[Diarization] extract_embedding failed: {exc}")
        return None


async def transcribe_voice_sample(audio_path: str) -> dict:
    """
    Transcribe a short onboarding voice sample (~8s).
    The participant is expected to say their name and role.
    Returns {text, name, role}.
    """
    from ai.transcriber import transcribe_audio
    result = await transcribe_audio(audio_path)
    text = result.get("text", "").strip()
    name, role = _extract_name_role_from_text(text)
    return {"text": text, "name": name, "role": role}


def _extract_name_role_from_text(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Regex extraction of name/role from a Romanian onboarding phrase.
    e.g. 'Numele meu este Ion Popescu și sunt secretarul consiliului'
    """
    import re
    name = None
    role = None

    # Name patterns
    name_match = re.search(
        r"(?:numele meu este|mă numesc|sunt|eu sunt)\s+"
        r"([A-ZĂÎȘȚÂ][a-zăîșțâ]+"
        r"(?:\s+[A-ZĂÎȘȚÂ][a-zăîșțâ]+){1,3})",
        text, re.IGNORECASE,
    )
    if name_match:
        name = name_match.group(1).strip()

    # Role patterns — capture known institutional roles
    role_match = re.search(
        r"(?:sunt|în calitate de|ca)\s+"
        r"((?:secretar|primar|viceprimar|consilier|referent|director|contabil|"
        r"administrator|preşedinte|vicepresedinte|clerk)[a-zăîșțâ\- ]*)",
        text, re.IGNORECASE,
    )
    if role_match:
        role = role_match.group(1).strip().rstrip(".,;")

    return name, role


# ── Speaker matching ────────────────────────────────────────────────────────────

def match_speakers_sync(
    diarized_segments: List[dict],
    voice_profiles: List[dict],
    audio_path: Optional[str] = None,
) -> Dict[str, dict]:
    """
    Map diarized speaker labels (SPEAKER_00...) to real participant info.

    Strategy:
      - If embeddings are available in profiles AND inference model is loaded:
        extract per-label embeddings from main audio, compare with cosine sim.
      - Otherwise: assign profiles in order of first appearance (sequential fallback).

    Returns: {speaker_label: {"name": str, "role": str}}
    """
    if not diarized_segments:
        return {}

    # Collect unique labels in order of first appearance
    unique_labels: List[str] = []
    for seg in diarized_segments:
        lbl = seg["speaker_label"]
        if lbl not in unique_labels:
            unique_labels.append(lbl)

    inference = _get_embed_inference()
    has_profile_embeddings = any(p.get("embedding") for p in voice_profiles)

    # ── Fallback: sequential assignment ────────────────────────────────────────
    if not inference or not has_profile_embeddings or not audio_path:
        mapping: Dict[str, dict] = {}
        for i, lbl in enumerate(unique_labels):
            if i < len(voice_profiles):
                p = voice_profiles[i]
                mapping[lbl] = {
                    "name": p.get("name") or f"Participant {i + 1}",
                    "role": p.get("role", ""),
                }
            else:
                n = i + 1
                mapping[lbl] = {"name": f"Participant {n}", "role": ""}
        return mapping

    # ── Embedding-based matching ────────────────────────────────────────────────
    from pyannote.core import Segment as PaSegment

    # Group segments by label and pick longest chunks up to 30s
    label_segs: Dict[str, List[dict]] = {}
    for seg in diarized_segments:
        label_segs.setdefault(seg["speaker_label"], []).append(seg)

    label_embeddings: Dict[str, np.ndarray] = {}
    for lbl, segs in label_segs.items():
        # Prefer longer segments, cap at 30s total
        sorted_segs = sorted(segs, key=lambda s: s["end"] - s["start"], reverse=True)
        embeddings = []
        total_dur = 0.0
        for s in sorted_segs:
            dur = s["end"] - s["start"]
            if dur < 0.5 or total_dur + dur > 30.0:
                continue
            try:
                emb = inference(
                    {"audio": audio_path},
                    excerpt=PaSegment(s["start"], s["end"]),
                )
                arr = emb.data.squeeze() if hasattr(emb, "data") else np.array(emb).squeeze()
                embeddings.append(arr)
                total_dur += dur
            except Exception:
                continue
        if embeddings:
            label_embeddings[lbl] = np.mean(embeddings, axis=0)

    # Load profile embeddings
    profile_data: List[Tuple[dict, Optional[np.ndarray]]] = []
    for p in voice_profiles:
        emb_b64 = p.get("embedding")
        if emb_b64:
            try:
                profile_data.append((p, b64_to_embedding(emb_b64)))
            except Exception:
                profile_data.append((p, None))
        else:
            profile_data.append((p, None))

    # Greedy cosine-similarity matching
    mapping = {}
    used: set = set()
    for lbl in unique_labels:
        lbl_emb = label_embeddings.get(lbl)
        if lbl_emb is None:
            n = int(lbl.replace("SPEAKER_", "")) + 1 if lbl.startswith("SPEAKER_") else 1
            mapping[lbl] = {"name": f"Participant {n}", "role": ""}
            continue

        best_score, best_profile, best_idx = -1.0, None, None
        for idx, (profile, prof_emb) in enumerate(profile_data):
            if idx in used or prof_emb is None:
                continue
            score = _cosine_similarity(lbl_emb, prof_emb)
            if score > best_score:
                best_score, best_profile, best_idx = score, profile, idx

        # Threshold 0.5 — below that, speaker is unidentified
        if best_profile is not None and best_score >= 0.5:
            mapping[lbl] = {
                "name": best_profile.get("name", ""),
                "role": best_profile.get("role", ""),
            }
            used.add(best_idx)
        else:
            n = int(lbl.replace("SPEAKER_", "")) + 1 if lbl.startswith("SPEAKER_") else 1
            mapping[lbl] = {"name": f"Participant {n}", "role": ""}

    return mapping


# ── Transcript + diarization merge ─────────────────────────────────────────────

def merge_transcript_with_diarization(
    whisper_segments: List[dict],
    diarized_segments: List[dict],
    speaker_mapping: Dict[str, dict],
) -> List[dict]:
    """
    Combine Whisper text segments with diarization speaker labels.

    For each Whisper segment, find the diarized speaker with maximum time
    overlap, then look up the real name in speaker_mapping.

    Returns list of {speaker, role, timestamp, text, start, end}
    """
    if not diarized_segments:
        return [
            {
                "speaker": "Vorbitor necunoscut",
                "role": "",
                "timestamp": _fmt_ts(seg.get("start", 0)),
                "text": seg.get("text", "").strip(),
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
            }
            for seg in whisper_segments
            if seg.get("text", "").strip()
        ]

    result = []
    for wseg in whisper_segments:
        wstart = wseg.get("start", 0)
        wend = wseg.get("end", wstart + 1)
        wtext = wseg.get("text", "").strip()
        if not wtext:
            continue

        best_overlap = 0.0
        best_label: Optional[str] = None
        for dseg in diarized_segments:
            overlap = max(0.0, min(wend, dseg["end"]) - max(wstart, dseg["start"]))
            if overlap > best_overlap:
                best_overlap = overlap
                best_label = dseg["speaker_label"]

        info = speaker_mapping.get(best_label, {}) if best_label else {}
        result.append({
            "speaker": info.get("name") or best_label or "Vorbitor necunoscut",
            "role": info.get("role", ""),
            "timestamp": _fmt_ts(wstart),
            "text": wtext,
            "start": wstart,
            "end": wend,
        })

    return result


def _fmt_ts(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


# ── Full pipeline entry point ───────────────────────────────────────────────────

async def get_diarized_transcript(
    audio_path: str,
    whisper_segments: List[dict],
    voice_profiles: List[dict],
) -> List[dict]:
    """
    Run the complete diarization pipeline:
      1. Diarize audio → per-second speaker labels
      2. Match speaker labels → participant names (via embeddings or fallback)
      3. Merge with Whisper segments → {speaker, role, timestamp, text}

    Args:
        audio_path:       path to the main meeting audio file
        whisper_segments: [{start, end, text}] from faster-whisper
        voice_profiles:   onboarded participants [{name, role, embedding?, ...}]

    Returns:
        [{speaker, role, timestamp, text, start, end}]
    """
    print(f"[Diarization] Starting for {os.path.basename(audio_path)}...")
    diarized = await diarize_audio(audio_path)

    if not diarized:
        print("[Diarization] No diarization output — using plain Whisper segments.")
        # Still apply sequential speaker assignment if profiles exist
        if voice_profiles:
            mapping = match_speakers_sync([], voice_profiles)
        return merge_transcript_with_diarization(whisper_segments, [], {})

    n_speakers = len({s["speaker_label"] for s in diarized})
    print(f"[Diarization] Found {n_speakers} speaker(s).")

    loop = asyncio.get_event_loop()
    speaker_mapping = await loop.run_in_executor(
        None,
        match_speakers_sync,
        diarized,
        voice_profiles,
        audio_path,
    )

    return merge_transcript_with_diarization(whisper_segments, diarized, speaker_mapping)
