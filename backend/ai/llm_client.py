"""
Local LLM client — Ollama with Llama3/Mistral.
Uses Ollama's OpenAI-compatible endpoint so the same call structure
works as with Anthropic Claude (no prompt changes needed).

Falls back to Anthropic Claude if Ollama is not reachable
(for backward compatibility during migration / dev environment).
"""
import json
import re
from typing import Optional

from config import settings


# ── Main extraction function ───────────────────────────────────────────────────

async def extract_meeting_data(
    transcript: str,
    vertical_type: str = "GAL",
    tenant_id=None,
) -> dict:
    """
    Extract structured meeting data from a transcript.
    Uses the vertical's prompt_template, applies tenant overrides if any.
    Returns a dict matching the vertical's output_fields schema.
    """
    from verticals import get_vertical_config

    config = get_vertical_config(vertical_type)
    prompt = config.prompt_template

    # Apply tenant-level prompt suffix override
    if tenant_id:
        try:
            from db.collections import tenants_col
            from bson import ObjectId
            tenant = await tenants_col().find_one({"_id": ObjectId(str(tenant_id))})
            if tenant:
                override = tenant.get("config", {}).get("verticals", {}).get(vertical_type, {})
                suffix = override.get("custom_prompt_suffix")
                if suffix:
                    prompt = prompt + "\n\n" + suffix
                # Override predefined_locations in the prompt
                custom_locations = override.get("predefined_locations")
                if custom_locations and config.predefined_locations:
                    old_list = "\n- ".join(config.predefined_locations)
                    new_list = "\n- ".join(custom_locations)
                    prompt = prompt.replace(old_list, new_list)
        except Exception as e:
            print(f"[LLM] Could not load tenant overrides: {e}")

    user_message = f"Extrage informațiile structurate din această transcriere:\n\n{transcript}"

    # Try local Ollama first
    try:
        result = await _call_ollama(prompt, user_message)
        return result
    except Exception as e:
        print(f"[LLM] Ollama failed: {e}. Trying Anthropic fallback...")

    # Fallback to Anthropic Claude
    try:
        result = await _call_anthropic(prompt, user_message)
        return result
    except Exception as e:
        print(f"[LLM] Anthropic fallback also failed: {e}")
        raise RuntimeError(f"Toate metodele LLM au eșuat: {e}")


async def correct_transcript_text(transcript: str) -> str:
    """Correct grammar/transcription errors using local LLM or Anthropic fallback."""
    system = (
        "Ești un editor profesionist de transcrieri în limba română. "
        "Corectează erorile gramaticale, de ortografie și de transcriere. "
        "Păstrează sensul original și structura textului. "
        "NU adăuga, nu șterge și nu reformula conținutul — doar corectează greșelile. "
        "Returnează DOAR textul corectat, fără explicații."
    )
    user_message = f"Corectează următoarea transcriere:\n\n{transcript}"

    try:
        corrected = await _call_ollama_raw(system, user_message)
        return corrected.strip()
    except Exception:
        pass

    try:
        corrected = await _call_anthropic_raw(system, user_message)
        return corrected.strip()
    except Exception as e:
        raise RuntimeError(f"Corectarea transcrierii a eșuat: {e}")


# ── Ollama ─────────────────────────────────────────────────────────────────────

async def _call_ollama(system: str, user_message: str) -> dict:
    """Call Ollama via its OpenAI-compatible /v1/chat/completions endpoint."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        base_url=f"{settings.OLLAMA_BASE_URL}/v1",
        api_key="ollama",   # Ollama ignores the key but the SDK requires it
    )

    # Enforce JSON output with schema reminder
    enforced_system = (
        system
        + "\n\nIMPORTANT: Returnează EXCLUSIV un obiect JSON valid. "
        "Niciun text înainte sau după JSON. Niciun markdown. Niciun comentariu."
    )

    response = await client.chat.completions.create(
        model=settings.OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": enforced_system},
            {"role": "user", "content": user_message},
        ],
        temperature=0.0,
        max_tokens=2000,
    )

    text = response.choices[0].message.content
    return _parse_json_response(text)


async def _call_ollama_raw(system: str, user_message: str) -> str:
    """Call Ollama and return raw text (for transcript correction)."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(base_url=f"{settings.OLLAMA_BASE_URL}/v1", api_key="ollama")
    response = await client.chat.completions.create(
        model=settings.OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
        temperature=0.1,
        max_tokens=8000,
    )
    return response.choices[0].message.content


# ── Anthropic fallback ─────────────────────────────────────────────────────────

async def _call_anthropic(system: str, user_message: str) -> dict:
    import os
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )
    text = response.content[0].text
    return _parse_json_response(text)


async def _call_anthropic_raw(system: str, user_message: str) -> str:
    import os
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=8000,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text


# ── JSON parsing ───────────────────────────────────────────────────────────────

def _parse_json_response(text: str) -> dict:
    """Robustly extract a JSON object from LLM output."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to extract from markdown code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Try to find raw JSON object
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Nu s-a putut parsa JSON din răspunsul LLM: {text[:200]}")
