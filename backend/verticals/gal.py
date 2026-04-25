"""
GAL Vertical Configuration - Backward Compatible
"""
from .base import VerticalConfig, OutputField


GAL_CONFIG = VerticalConfig(
    name="GAL",
    display_name_ro="Grupuri de Acțiune Locală",
    icon="🏛️",
    description_ro="Ședințe și rapoarte pentru Grupuri de Acțiune Locală din zonele rurale",
    prompt_template="""Ești un asistent care extrage informații structurate din transcrierile ședințelor GAL în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Fii concis și precis
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

LOCALITĂȚI CUNOSCUTE (verifică dacă apare vreuna în transcriere):
- Chilia Veche
- Crișan
- C.A.Rosetti
- Maliuc
- Beștepe

Dacă în transcriere apare una din aceste localități (sau variații ale numelui), folosește exact numele din lista de mai sus.

FORMAT OUTPUT (JSON strict - structura raport GAL):
{
  "locality": "Numele localității principale din lista de mai sus sau null dacă nu apare niciuna",
  "data_desfasurare": "Data menționată în ședință sau null (format: DD.MM.YYYY)",
  "format_intalnire": "Tipul întâlnirii: fizică/online/hibrid sau null",
  "loc_desfasurare": "Locul exact unde s-a desfășurat (ex: Primărie, Cămin Cultural) sau null",
  "mod_promovare": "Cum a fost promovată întâlnirea (ex: afișe, Facebook, email) sau null",
  "obiectiv": "Obiectivul principal al ședinței în 1-2 propoziții sau null",
  "tematica": "Tema principală discutată în 1-2 propoziții sau null",
  "scurta_descriere": "Rezumat scurt al discuțiilor în 2-4 propoziții sau null",
  "numar_participanti": "Numărul de participanți menționat sau null",
  "concluzia": "Concluzia principală sau următorii pași în 1-2 propoziții sau null"
}""",
    output_fields=[
        OutputField(key="data_desfasurare", label_ro="Data desfășurare", field_type="text"),
        OutputField(key="format_intalnire", label_ro="Format întâlnire", field_type="text"),
        OutputField(key="loc_desfasurare", label_ro="Loc desfășurare", field_type="text"),
        OutputField(key="mod_promovare", label_ro="Mod promovare", field_type="text"),
        OutputField(key="obiectiv", label_ro="Obiectiv", field_type="textarea", required=True),
        OutputField(key="tematica", label_ro="Tematica", field_type="textarea", required=True),
        OutputField(key="scurta_descriere", label_ro="Scurtă descriere", field_type="textarea"),
        OutputField(key="numar_participanti", label_ro="Număr participanți", field_type="text"),
        OutputField(key="concluzia", label_ro="Concluzia", field_type="textarea"),
    ],
    predefined_locations=["Chilia Veche", "Crișan", "C.A.Rosetti", "Maliuc", "Beștepe"],
    color_accent="#1B2A4A",
    whisper_prompt=(
        "Ședință oficială în limba română. Consiliu local, primărie. "
        "Ordinea de zi, proiect de hotărâre, vot pentru, abținere, împotrivă. "
        "Domnul primar, doamna consilier, secretar general, proces verbal."
    ),
    diarization_context=(
        "Ședință de consiliu local sau primărie. Protocol formal strict. "
        "Un președinte conduce, un secretar citește, consilieri intervin scurt. "
        "Fraze cheie: 'Supun la vot', 'Cine este pentru', 'Declar deschisă ședința'."
    ),
    expected_speakers=(2, 20),
)
