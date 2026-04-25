"""
Startups Vertical Configuration
"""
from .base import VerticalConfig, OutputField


STARTUPS_CONFIG = VerticalConfig(
    name="STARTUPS",
    display_name_ro="Startups & Tech",
    icon="🚀",
    description_ro="Board meetings, pitch-uri, sprint reviews și ședințe de echipă pentru startup-uri",
    prompt_template="""Ești un asistent care extrage informații din ședințe de startup și tech în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Identifică decizii de produs, KPI-uri și next steps
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

EXTRAGE:
- Decizii de produs luate
- KPI-uri sau metrici menționate
- Blocaje și riscuri identificate
- Action items cu responsabili
- Deadline-uri menționate
- Investiții sau finanțări discutate (dacă există)

FORMAT OUTPUT (JSON):
{
  "product_decisions": ["decizie 1", "decizie 2", ...],
  "kpis_mentioned": ["KPI: valoare", "metric: valoare", ...],
  "blockers": ["blocaj 1", "blocaj 2", ...],
  "action_items": [{"task": "Task descriere", "owner": "Nume responsabil", "deadline": "Data sau null"}],
  "funding_notes": "Detalii investiții/finanțare sau null",
  "next_sprint_goals": ["obiectiv 1", "obiectiv 2", ...]
}""",
    output_fields=[
        OutputField(key="product_decisions", label_ro="Decizii de produs", field_type="list", required=True),
        OutputField(key="kpis_mentioned", label_ro="KPI-uri & Metrici", field_type="list"),
        OutputField(key="blockers", label_ro="Blocaje & Riscuri", field_type="list", required=True),
        OutputField(key="action_items", label_ro="Action Items", field_type="list", required=True),
        OutputField(key="funding_notes", label_ro="Note investiții", field_type="textarea"),
        OutputField(key="next_sprint_goals", label_ro="Obiective sprint următor", field_type="list"),
    ],
    predefined_locations=None,
    color_accent="#7C3AED",
    whisper_prompt=(
        "Ședință de echipă sau pitch în limba română. "
        "Startup, produs, MVP, user, feature, sprint, investitor, funding. "
        "Fondator, developer, designer, investor, advisor."
    ),
    diarization_context=(
        "Meeting de echipă startup sau pitch. Ton informal și dinamic. "
        "Mulți participanți intervin frecvent și scurt. "
        "Poate conține și termeni tehnici în engleză."
    ),
    expected_speakers=(2, 10),
)
