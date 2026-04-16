"""
General Vertical Configuration — Universal meeting format
Works for any domain: business, associations, public institutions, etc.
"""
from .base import VerticalConfig, OutputField


GENERAL_CONFIG = VerticalConfig(
    name="GENERAL",
    display_name_ro="General",
    icon="📋",
    description_ro="Format universal pentru orice tip de ședință sau întâlnire",
    color_accent="#1B2A4A",
    prompt_template="""Ești un asistent profesionist care extrage informații structurate din transcrierile ședințelor în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Fii concis și precis
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

FORMAT OUTPUT (JSON strict):
{
  "titlu": "Titlul sau subiectul principal al ședinței",
  "data_desfasurare": "Data menționată în transcriere sau null",
  "loc_desfasurare": "Locația menționată sau null",
  "participanti": ["Lista persoanelor care au vorbit sau au fost menționate"],
  "subiecte_discutate": ["Lista subiectelor/punctelor discutate"],
  "decizii": ["Deciziile luate în ședință, dacă există"],
  "actiuni_de_urmat": ["Acțiunile/task-urile stabilite, cu responsabil dacă e menționat"],
  "concluzii": "Rezumatul concluziilor ședinței",
  "observatii": "Alte observații relevante sau null"
}

Dacă un câmp nu poate fi extras din transcriere, pune null (pentru string) sau [] (pentru array).
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
