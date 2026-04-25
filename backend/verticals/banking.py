"""
Banking Vertical Configuration
"""
from .base import VerticalConfig, OutputField


BANKING_CONFIG = VerticalConfig(
    name="BANKING",
    display_name_ro="Banking",
    icon="🏦",
    description_ro="Ședințe bancare și financiare cu focus pe compliance și decizii",
    prompt_template="""Ești un asistent care extrage informații din ședințe bancare și financiare în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Identifică puncte de compliance și riscuri
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

EXTRAGE:
- Puncte de compliance discutate
- Acțiuni concrete (action items)
- Flag-uri de risc identificate
- Decizia finală (dacă există)

FORMAT OUTPUT (JSON):
{
  "compliance_points": ["punct compliance 1", "punct compliance 2", ...],
  "action_items": ["acțiune 1", "acțiune 2", ...],
  "risk_flags": ["risc 1", "risc 2", ...],
  "final_decision": "Decizia finală în 1-2 propoziții sau null"
}""",
    output_fields=[
        OutputField(key="compliance_points", label_ro="Puncte Compliance", field_type="list", required=True),
        OutputField(key="action_items", label_ro="Action Items", field_type="list", required=True),
        OutputField(key="risk_flags", label_ro="Flag-uri Risc", field_type="list"),
        OutputField(key="final_decision", label_ro="Decizie finală", field_type="textarea"),
    ],
    predefined_locations=None,
    color_accent="#2C5F2D",
    whisper_prompt=(
        "Ședință corporativă sau bancară în limba română. "
        "Raport financiar, buget, forecast, KPI, board, acționari. "
        "Director general, CFO, manager, client, consultant."
    ),
    diarization_context=(
        "Meeting corporativ semi-formal. Un moderator conduce agenda. "
        "Participanții raportează pe rând sau dezbat. "
        "Ton profesional, termeni financiari și de business frecvenți."
    ),
    expected_speakers=(2, 12),
)
