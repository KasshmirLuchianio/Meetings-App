"""
Legal Vertical Configuration
"""
from .base import VerticalConfig, OutputField


LEGAL_CONFIG = VerticalConfig(
    name="LEGAL",
    display_name_ro="Legal",
    icon="⚖️",
    description_ro="Consultări juridice și negocieri contractuale cu extragere de clauze",
    prompt_template="""Ești un asistent care extrage informații juridice din consultări și negocieri în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Identifică clauze și obligații specifice
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

EXTRAGE:
- Clauze discutate (puncte juridice specifice)
- Termene menționate
- Obligații ale părților
- Părți implicate în discuție

FORMAT OUTPUT (JSON):
{
  "clauses_discussed": ["clauză 1", "clauză 2", ...],
  "deadlines": ["termen 1: descriere", "termen 2: descriere", ...],
  "obligations": ["obligație 1", "obligație 2", ...],
  "parties_involved": ["parte 1", "parte 2", ...]
}""",
    output_fields=[
        OutputField(key="clauses_discussed", label_ro="Clauze discutate", field_type="list", required=True),
        OutputField(key="deadlines", label_ro="Termene", field_type="list"),
        OutputField(key="obligations", label_ro="Obligații", field_type="list", required=True),
        OutputField(key="parties_involved", label_ro="Părți implicate", field_type="list"),
    ],
    predefined_locations=None,
    color_accent="#8B4513"
)
