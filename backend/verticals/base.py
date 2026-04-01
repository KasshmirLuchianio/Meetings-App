"""
Vertical Config Base Classes
"""
from pydantic import BaseModel
from typing import List, Optional


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
