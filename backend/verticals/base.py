"""
Vertical Config Base Classes
"""
from pydantic import BaseModel
from typing import List, Optional, Tuple


class OutputField(BaseModel):
    key: str
    label_ro: str
    field_type: str  # "text" | "textarea" | "list" | "number"
    required: bool = False


class VerticalConfig(BaseModel):
    name: str
    display_name_ro: str
    icon: str
    description_ro: str
    prompt_template: str
    output_fields: List[OutputField]
    predefined_locations: Optional[List[str]] = None
    color_accent: str = "#1B2A4A"
    # ── Pipeline-aware fields ─────────────────────────────────────────
    # Initial prompt for Whisper API — domain vocabulary improves WER
    whisper_prompt: Optional[str] = None
    # Context hints injected into Claude diarization system prompt
    diarization_context: Optional[str] = None
    # Expected speaker count range (min, max) for this vertical
    expected_speakers: Optional[Tuple[int, int]] = (1, 20)
