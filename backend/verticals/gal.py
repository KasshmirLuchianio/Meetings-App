"""
GAL Vertical Configuration - Backward Compatible
"""
from .base import VerticalConfig, OutputField


GAL_CONFIG = VerticalConfig(
    name="GAL",
    display_name_ro="Grupuri de Acțiune Locală",
    icon="🏛️",
    description_ro="Ședințe și procese-verbale pentru instituții publice sau private (consilii locale, primării, GAL-uri, asociații, firme)",
    prompt_template="""Ești un asistent care extrage informații structurate din transcrierile ședințelor oficiale în limba română — indiferent de tipul instituției (consiliu local, primărie, GAL, firmă, asociație, cabinet, bancă, spital etc.).

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Fii concis și precis
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown
- Dacă o informație nu apare în transcriere, folosește null pentru câmpuri simple sau [] pentru liste
- Pentru nume de persoane, extrage numele complet așa cum apare în transcriere
- Nu presupune tipul instituției — extrage exact ce se aude în transcriere

FORMAT OUTPUT (JSON strict):
{
  "judet": "Numele județului menționat sau null",
  "localitate": "Numele localității (comună, oraș, municipiu) menționate sau null",
  "institutia": "Denumirea completă a instituției (ex: PRIMĂRIA COMUNEI X, GAL Y, CONSILIUL LOCAL Z, SC ALFA SRL, CABINET AVOCAT W) sau null",
  "tip_sedinta": "Tipul ședinței: 'ordinară', 'extraordinară', 'de lucru', 'anuală', 'de bilanț' etc. sau null",
  "data_desfasurare": "Data menționată în ședință sau null (format: DD.MM.YYYY)",
  "format_intalnire": "Tipul întâlnirii: fizică/online/hibrid sau null",
  "loc_desfasurare": "Locul exact unde s-a desfășurat sau null",
  "mod_promovare": "Cum a fost promovată/anunțată întâlnirea sau null",
  "obiectiv": "Obiectivul principal al ședinței în 1-2 propoziții sau null",
  "tematica": "Tema principală discutată în 1-2 propoziții sau null",
  "scurta_descriere": "Rezumat scurt al discuțiilor în 2-4 propoziții sau null",
  "membri_total": "Numărul total de membri (consilieri, acționari, asociați etc.) sau null (doar cifra)",
  "membri_prezenti": ["Lista membrilor prezenți, cu nume și funcție/calitate dacă sunt menționate"],
  "membri_absenti": ["Lista membrilor absenți (doar numele) sau []"],
  "oficiali": [{"nume": "Numele persoanei", "functie": "Funcția/calitatea (ex: primar, secretar, director, președinte, administrator)"}],
  "presedinte_sedinta": "Numele persoanei care conduce ședința sau null",
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
        "Ședință oficială în limba română. "
        "Vocabular instituțional: ședință ordinară, extraordinară, consiliu local, "
        "primărie, primar, viceprimar, secretar general, consilier, consiliul județean, "
        "președinte de ședință, ordine de zi, proces-verbal, hotărâre, proiect de hotărâre, "
        "amendament, vot, voturi pentru, împotrivă, abținere, abțineri, "
        "aviz, comisie, comitet, cvorum, deliberare, dezbatere, "
        "aprobare, respingere, unanimitate, majoritate, validare. "
        "Fraze: declar deschisă ședința, se constată prezența, "
        "supun la vot, dau citire ordinii de zi, se aprobă, se respinge, "
        "procesul verbal al ședinței, încheierea ședinței, grup de acțiune locală."
    ),
    diarization_context=(
        "Ședință formală. Protocol instituțional. "
        "Un președinte/primar conduce ~60% din timp — revine constant, "
        "NU crea vorbitori noi pentru aceeași persoană. "
        "Un secretar citește documente. Membrii/consilierii intervin punctual. "
        "Fraze cheie: 'Supun la vot', 'Cine este pentru', "
        "'Declar deschisă ședința', 'Se constată prezența', "
        "'Dau citire ordinii de zi'. "
        "ATENȚIE: Gap-urile între segmente NU înseamnă schimbare de vorbitor. "
        "Președintele vorbește, face o pauză, apoi continuă — rămâne același speaker."
    ),
    expected_speakers=(2, 20),
)
