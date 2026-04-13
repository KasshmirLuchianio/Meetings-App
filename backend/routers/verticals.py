"""
Verticals router — /api/v1/verticals
Supports per-tenant config overrides stored in the tenant document.
"""
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.rbac import get_current_user, require_role
from db.collections import tenants_col

router = APIRouter(prefix="/api/v1/verticals", tags=["verticals"])


@router.get("")
async def list_verticals(user: dict = Depends(get_current_user)):
    """List all available verticals, merging tenant-level overrides."""
    from verticals import list_verticals as _list, VERTICALS
    base = _list()

    # Apply tenant overrides if any
    tenant = await tenants_col().find_one({"_id": user["tenant_id"]})
    tenant_overrides = {}
    if tenant:
        tenant_overrides = tenant.get("config", {}).get("verticals", {})

    # Which verticals are enabled for this tenant (default: all)
    enabled = tenant.get("config", {}).get("enabled_verticals") if tenant else None

    result = []
    for v in base:
        name = v["name"]
        if enabled and name not in enabled:
            continue  # tenant has restricted verticals
        override = tenant_overrides.get(name, {})
        merged = {**v, **override}
        result.append(merged)

    return {"verticals": result}


@router.get("/{vertical_type}")
async def get_vertical(vertical_type: str, user: dict = Depends(get_current_user)):
    """Get config for a specific vertical, with tenant overrides applied."""
    from verticals import get_vertical_config, VERTICALS
    if vertical_type not in VERTICALS:
        raise HTTPException(status_code=404, detail=f"Vertical '{vertical_type}' negăsit")

    config = get_vertical_config(vertical_type)
    tenant = await tenants_col().find_one({"_id": user["tenant_id"]})
    tenant_overrides = {}
    if tenant:
        tenant_overrides = tenant.get("config", {}).get("verticals", {}).get(vertical_type, {})

    result = {
        "name": config.name,
        "display_name_ro": config.display_name_ro,
        "icon": config.icon,
        "description_ro": config.description_ro,
        "color_accent": config.color_accent,
        "output_fields": [
            {"key": f.key, "label_ro": f.label_ro, "field_type": f.field_type,
             "required": f.required}
            for f in config.output_fields
        ],
        "predefined_locations": config.predefined_locations,
    }
    # Apply tenant overrides (e.g. custom predefined_locations for the institution's villages)
    result.update(tenant_overrides)
    return result


# ── Admin: configure per-tenant vertical overrides ────────────────────────────

class VerticalOverride(BaseModel):
    predefined_locations: Optional[list] = None
    custom_prompt_suffix: Optional[str] = None   # appended to default prompt
    enabled: Optional[bool] = None


@router.patch("/{vertical_type}/config")
async def configure_vertical(
    vertical_type: str,
    data: VerticalOverride,
    admin: dict = Depends(require_role("admin")),
):
    """
    Store per-tenant configuration for a vertical.
    Example: customize predefined_locations to match local village names.
    """
    from verticals import VERTICALS
    if vertical_type not in VERTICALS:
        raise HTTPException(status_code=404, detail=f"Vertical '{vertical_type}' negăsit")

    override: dict = {}
    if data.predefined_locations is not None:
        override["predefined_locations"] = data.predefined_locations
    if data.custom_prompt_suffix is not None:
        override["custom_prompt_suffix"] = data.custom_prompt_suffix

    # Handle enabled_verticals list
    if data.enabled is not None:
        tenant = await tenants_col().find_one({"_id": admin["tenant_id"]})
        current_config = tenant.get("config", {}) if tenant else {}
        enabled_list = current_config.get("enabled_verticals", list(VERTICALS.keys()))
        if data.enabled and vertical_type not in enabled_list:
            enabled_list.append(vertical_type)
        elif not data.enabled and vertical_type in enabled_list:
            enabled_list.remove(vertical_type)
        await tenants_col().update_one(
            {"_id": admin["tenant_id"]},
            {"$set": {f"config.enabled_verticals": enabled_list}},
        )

    if override:
        await tenants_col().update_one(
            {"_id": admin["tenant_id"]},
            {"$set": {f"config.verticals.{vertical_type}": override}},
        )

    return {"status": "updated", "vertical": vertical_type, "override": override}
