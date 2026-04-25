"""
Personal Legal Vertical Configuration
Covers couples, family disputes, workplace conflicts, and any personal
recording where verbatim accuracy and neutrality are paramount.
Priority: 100% fidelity, zero interpretation, preserve emotion markers.
"""
from .base import VerticalConfig, OutputField


PERSONAL_LEGAL_CONFIG = VerticalConfig(
    name="PERSONAL_LEGAL",
    display_name_ro="Înregistrare personală",
    icon="🔒",
    description_ro="Conversații personale, conflicte, dovezi audio — transcriere 100% fidelă",
    color_accent="#6B21A8",
    whisper_prompt=(
        "Conversație personală în limba română. "
        "Vorbire naturală, emoțională sau conflictuală. "
        "Păstrează toate cuvintele exacte, inclusiv repetiții și ezitări."
    ),
    diarization_context=(
        "Conversație personală între două sau mai multe persoane. "
        "Poate fi emoțională, conflictuală sau intimă. "
        "IMPORTANT: Transcriere 100% fidelă — nu omite, nu rezuma, nu interpretează. "
        "Identifică vorbitorii ca Persoana 1, Persoana 2 etc. "
        "Dacă se folosesc nume, folosește-le. "
        "Marchează suprapunerile de vorbire cu [suprapunere] dacă există."
    ),
    expected_speakers=(1, 4),
    prompt_template=(
        "Ești un transcrietor profesionist neutru. "
        "Transcrie exact ce s-a spus, fără interpretări sau rezumate. "
        "Structurează pe vorbitori. "
        "Nu extrage concluzii. Nu judeca conținutul. "
        "Outputul este o transcriere fidelă, organizată cronologic.\n\n"
        "FORMAT OUTPUT (JSON strict):\n"
        "{\n"
        '  "transcriere_fidela": "Textul complet organizat pe vorbitori",\n'
        '  "vorbitori_identificati": ["Persoana 1", "Persoana 2"],\n'
        '  "durata_estimata": "Durata estimată a înregistrării sau null",\n'
        '  "context_detectat": "Tipul conversației (conflict, discuție, negociere etc.) sau null",\n'
        '  "observatii_tehnice": "Calitate audio, suprapuneri, pauze lungi sau null"\n'
        "}"
    ),
    output_fields=[
        OutputField(key="transcriere_fidela", label_ro="Transcriere fidelă", field_type="textarea", required=True),
        OutputField(key="vorbitori_identificati", label_ro="Vorbitori identificați", field_type="list"),
        OutputField(key="durata_estimata", label_ro="Durată estimată", field_type="text"),
        OutputField(key="context_detectat", label_ro="Context detectat", field_type="text"),
        OutputField(key="observatii_tehnice", label_ro="Observații tehnice", field_type="textarea"),
    ],
)
