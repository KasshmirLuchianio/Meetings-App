"""
Healthcare Vertical Configuration
"""
from .base import VerticalConfig, OutputField


HEALTHCARE_CONFIG = VerticalConfig(
    name="HEALTHCARE",
    display_name_ro="Sănătate",
    icon="🏥",
    description_ro="Consultații medicale, rapoarte clinice și ședințe de echipă medicală",
    prompt_template="""Ești un asistent care extrage informații din consultații și ședințe medicale în limba română.

REGULI:
- NU inventa informații care nu sunt în transcriere
- Folosește DOAR informațiile din transcriere
- Identifică diagnostice, tratamente și recomandări
- Respectă confidențialitatea pacientului
- Răspunde DOAR în limba română
- Returnează DOAR JSON valid, fără alt text sau markdown

EXTRAGE:
- Simptome raportate de pacient
- Diagnosticul discutat (dacă există)
- Tratamentul recomandat (medicamente, proceduri)
- Recomandări și indicații pentru pacient
- Data programării următoare (dacă este menționată)
- Persoanele implicate (medic, pacient, asistentă)

FORMAT OUTPUT (JSON):
{
  "symptoms": ["simptom 1", "simptom 2", ...],
  "diagnosis": "Diagnosticul discutat sau null",
  "treatment": ["tratament/medicament 1", "tratament/medicament 2", ...],
  "recommendations": ["recomandare 1", "recomandare 2", ...],
  "next_appointment": "Data/detalii programare următoare sau null",
  "medical_team": [{"name": "Nume", "role": "Rol/Specialitate"}]
}""",
    output_fields=[
        OutputField(key="symptoms", label_ro="Simptome raportate", field_type="list", required=True),
        OutputField(key="diagnosis", label_ro="Diagnostic", field_type="textarea", required=True),
        OutputField(key="treatment", label_ro="Tratament recomandat", field_type="list", required=True),
        OutputField(key="recommendations", label_ro="Recomandări", field_type="list"),
        OutputField(key="next_appointment", label_ro="Programare următoare", field_type="text"),
        OutputField(key="medical_team", label_ro="Echipa medicală", field_type="list"),
    ],
    predefined_locations=None,
    color_accent="#DC2626",
    whisper_prompt=(
        "Consultație medicală sau ședință medicală în limba română. "
        "Diagnostic, tratament, simptome, analize, rețetă, protocol medical. "
        "Doctor, pacient, asistentă, medic specialist."
    ),
    diarization_context=(
        "Consultație sau ședință medicală. Medicul pune întrebări și explică. "
        "Pacientul sau familia descrie simptome. "
        "Dacă e ședință de secție: un medic șef prezintă, colectivul intervine."
    ),
    expected_speakers=(2, 10),
)
