"""
Journalism Vertical Configuration
"""
from .base import VerticalConfig, OutputField


JOURNALISM_CONFIG = VerticalConfig(
    name="JOURNALISM",
    display_name_ro="Jurnalism",
    icon="📰",
    description_ro="Interviuri, declarații și materiale jurnalistice cu extragere de quote-uri",
    prompt_template="""Ești un asistent care extrage informații jurnalistice din interviuri și declarații în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Extrage quote-uri EXACTE (cu ghilimele)
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

EXTRAGE:
- Quote-uri directe (maxim 5 cele mai relevante)
- Persoane citate (nume + funcție/rol)
- Unghi editorial principal
- Subiect principal

FORMAT OUTPUT (JSON):
{
  "quotes": ["citat exact 1", "citat exact 2", ...],
  "people_quoted": [{"name": "Nume Prenume", "role": "Funcție/Rol"}, ...],
  "editorial_angle": "Unghiul editorial în 1-2 propoziții",
  "main_subject": "Subiectul principal în 1 propoziție"
}""",
    output_fields=[
        OutputField(key="quotes", label_ro="Quote-uri cheie", field_type="list", required=True),
        OutputField(key="people_quoted", label_ro="Persoane citate", field_type="list"),
        OutputField(key="editorial_angle", label_ro="Unghi editorial", field_type="textarea", required=True),
        OutputField(key="main_subject", label_ro="Subiect principal", field_type="text", required=True),
    ],
    predefined_locations=None,
    color_accent="#B8962E",
    whisper_prompt=(
        "Interviu sau podcast în limba română. "
        "Jurnalist, invitat, moderator, reporter. "
        "Conversație fluentă, întrebări și răspunsuri, opinii, narațiuni."
    ),
    diarization_context=(
        "Interviu sau podcast. De obicei 2 vorbitori: un moderator și un invitat. "
        "Moderatorul pune întrebări scurte, invitatul răspunde amplu. "
        "Dacă e panel: mai mulți invitați, moderatorul distribuie cuvântul."
    ),
    expected_speakers=(2, 6),
)
