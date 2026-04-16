"""
Verticals Registry
"""
from .general import GENERAL_CONFIG
from .gal import GAL_CONFIG
from .journalism import JOURNALISM_CONFIG
from .legal import LEGAL_CONFIG
from .banking import BANKING_CONFIG
from .healthcare import HEALTHCARE_CONFIG
from .startups import STARTUPS_CONFIG
from .base import VerticalConfig


VERTICALS = {
    "GENERAL": GENERAL_CONFIG,
    "GAL": GAL_CONFIG,
    "JOURNALISM": JOURNALISM_CONFIG,
    "LEGAL": LEGAL_CONFIG,
    "BANKING": BANKING_CONFIG,
    "HEALTHCARE": HEALTHCARE_CONFIG,
    "STARTUPS": STARTUPS_CONFIG,
}


def get_vertical_config(vertical_type: str) -> VerticalConfig:
    """Get config for a vertical type, default to GENERAL"""
    return VERTICALS.get(vertical_type, GENERAL_CONFIG)


def list_verticals() -> list:
    """List all available verticals"""
    return [
        {
            "name": config.name,
            "display_name_ro": config.display_name_ro,
            "icon": config.icon,
            "description_ro": config.description_ro,
            "color_accent": config.color_accent,
            "has_predefined_locations": config.predefined_locations is not None,
        }
        for config in VERTICALS.values()
    ]
