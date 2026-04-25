"""
General Vertical Configuration — Universal format for any context.
Covers personal recordings, informal conversations, family discussions,
solo readings, and any context that doesn't fit a specialist vertical.
"""
from .base import VerticalConfig, OutputField


GENERAL_CONFIG = VerticalConfig(
    name="GENERAL",
    display_name_ro="General",
    icon="📋",
    description_ro="Format universal pentru orice tip de înregistrare sau conversație",
    color_accent="#1B2A4A",
    whisper_prompt=(
        "Înregistrare audio în limba română. "
        "Vorbire naturală, conversație, lectură sau monolog. "
        "Orice context personal sau profesional."
    ),
    diarization_context=(
        "Înregistrare generală. Poate fi: o singură persoană care citește sau vorbește, "
        "o conversație între două persoane, o discuție în familie sau între prieteni, "
        "un meeting informal. Identifică vorbitorii fără a presupune roluri formale. "
        "Nu folosi titluri instituționale dacă nu sunt menționate explicit. "
        "Dacă e o singură persoană: un singur vorbitor, fără diviziuni artificiale."
    ),
    expected_speakers=(1, 6),
    prompt_template="""Ești un asistent profesionist care extrage informații structurate din transcrierile în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Fii concis și precis
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

FORMAT OUTPUT (JSON strict):
{
  "titlu": "Titlul sau subiectul principal",
  "data_desfasurare": "Data menționată sau null",
  "loc_desfasurare": "Locația menționată sau null",
  "participanti": ["Lista persoanelor care au vorbit sau au fost menționate"],
  "subiecte_discutate": ["Lista subiectelor/punctelor discutate"],
  "decizii": ["Deciziile luate, dacă există"],
  "actiuni_de_urmat": ["Acțiunile/task-urile stabilite, cu responsabil dacă e menționat"],
  "concluzii": "Rezumatul concluziilor",
  "observatii": "Alte observații relevante sau null"
}

Dacă un câmp nu poate fi extras, pune null (string) sau [] (array).
Extrage cât mai multe detalii concrete din conversație.""",
    output_fields=[
        OutputField(key="titlu", label_ro="Titlu", field_type="text", required=True),
        OutputField(key="data_desfasurare", label_ro="Data desfășurare", field_type="text"),
        OutputField(key="loc_desfasurare", label_ro="Loc desfășurare", field_type="text"),
        OutputField(key="participanti", label_ro="Participanți", field_type="list"),
        OutputField(key="subiecte_discutate", label_ro="Subiecte discutate", field_type="list"),
        OutputField(key="decizii", label_ro="Decizii", field_type="list"),
        OutputField(key="actiuni_de_urmat", label_ro="Acțiuni de urmat", field_type="list"),
        OutputField(key="concluzii", label_ro="Concluzii", field_type="textarea"),
        OutputField(key="observatii", label_ro="Observații", field_type="textarea"),
    ],
)
