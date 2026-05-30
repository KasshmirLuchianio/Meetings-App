"""
GAL Vertical Configuration - Backward Compatible
"""
from .base import VerticalConfig, OutputField


GAL_CONFIG = VerticalConfig(
    name="GAL",
    display_name_ro="Grupuri de Acțiune Locală",
    icon="🏛️",
    description_ro="Ședințe și rapoarte pentru Grupuri de Acțiune Locală din zonele rurale",
    prompt_template="""Ești un asistent care extrage informații structurate din transcrierile ședințelor autorităților locale (consilii locale, primării, GAL-uri) în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Fii concis și precis
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown
- Dacă o informație nu apare în transcriere, folosește null pentru câmpuri simple sau [] pentru liste
- Pentru nume de persoane, extrage numele complet așa cum apare în transcriere

FORMAT OUTPUT (JSON strict — structură proces-verbal consiliu local):
{
  "judet": "Numele județului menționat în ședință (ex: Bacău, Tulcea) sau null",
  "comuna": "Numele comunei/orașului menționat sau null",
  "institutia": "Denumirea completă a instituției (ex: CONSILIUL LOCAL AL COMUNEI SASCUT, PRIMĂRIA COMUNEI X) sau null",
  "tip_sedinta": "Tipul ședinței: 'ordinară' sau 'extraordinară' sau null",
  "data_desfasurare": "Data menționată în ședință sau null (format: DD.MM.YYYY)",
  "format_intalnire": "Tipul întâlnirii: fizică/online/hibrid sau null",
  "loc_desfasurare": "Locul exact unde s-a desfășurat (ex: Primărie, Cămin Cultural, sediul Consiliului Local) sau null",
  "mod_promovare": "Cum a fost promovată/anunțată întâlnirea sau null",
  "obiectiv": "Obiectivul principal al ședinței în 1-2 propoziții sau null",
  "tematica": "Tema principală discutată în 1-2 propoziții sau null",
  "scurta_descriere": "Rezumat scurt al discuțiilor în 2-4 propoziții sau null",
  "consilieri_in_functie": "Numărul total de consilieri în funcție (doar cifra) sau null",
  "consilieri_prezenti": ["Lista consilierilor prezenți, cu nume și funcție dacă sunt menționate (ex: 'Bortun Aurel - viceprimar', 'Popescu Ion')"],
  "consilieri_absenti": ["Lista consilierilor absenți (doar numele)"],
  "primar": "Numele complet al primarului sau null",
  "secretar": "Numele complet al secretarului/common sau null",
  "administrator_public": "Numele administratorului public sau null",
  "presedinte_sedinta": "Numele președintelui de ședință sau null",
  "numar_participanti": "Numărul total de participanți menționat sau null (doar cifre)",
  "concluzia": "Concluzia principală sau următorii pași în 1-2 propoziții sau null",
  "participanti": ["Lista numelor tuturor participanților menționați în transcriere"],
  "ordine_de_zi": ["Lista punctelor de pe ordinea de zi, extrase exact cum apar în transcriere"],
  "decizii": ["Lista hotărârilor/deciziilor luate, extrase exact cum apar"],
  "actiuni": [{"text": "Descriere acțiune", "owner": "Responsabil", "deadline": "Termen"}],
  "observatii": ["Observații suplimentare menționate"]
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
