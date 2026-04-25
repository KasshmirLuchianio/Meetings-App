"""
Solo Reading Vertical Configuration
Covers reading texts aloud, dictation, personal notes, monologues, lectures.
Priority: clean text output, paragraph detection, minimal speaker logic.
Diarization is bypassed entirely for this vertical in the pipeline.
"""
from .base import VerticalConfig, OutputField


SOLO_READING_CONFIG = VerticalConfig(
    name="SOLO_READING",
    display_name_ro="Lectură / Dictare",
    icon="📖",
    description_ro="Lectură cu voce tare, dictare, monolog sau prezentare — un singur vorbitor",
    color_accent="#0369A1",
    whisper_prompt=(
        "Lectură cu voce tare sau dictare în limba română. "
        "Text literar, documentar sau personal. "
        "Un singur vorbitor, vorbire clară și continuă."
    ),
    diarization_context=(
        "O singură persoană citește sau dictează. "
        "NU fragmenta în mai mulți vorbitori. "
        "Grupează în paragrafe logice bazate pe pauze și schimbări de subiect. "
        "Outputul trebuie să fie text curat, gata de redactat."
    ),
    expected_speakers=(1, 1),
    prompt_template=(
        "Primești o transcriere a unei lecturi sau dictări. "
        "Sarcina ta: redactează textul ca un document coerent. "
        "Împarte în paragrafe logice. "
        "Corectează eventualele erori de transcriere evidente. "
        "Păstrează conținutul original — nu adăuga, nu elimina idei. "
        "Outputul este textul redactat, gata de citit sau salvat.\n\n"
        "FORMAT OUTPUT (JSON strict):\n"
        "{\n"
        '  "text_redactat": "Textul complet, împărțit în paragrafe",\n'
        '  "numar_paragrafe": 0,\n'
        '  "subiect_principal": "Subiectul sau tema textului în 1 propoziție",\n'
        '  "tip_continut": "lectură / dictare / prezentare / altul",\n'
        '  "observatii": "Observații despre calitatea transcrierii sau null"\n'
        "}"
    ),
    output_fields=[
        OutputField(key="text_redactat", label_ro="Text redactat", field_type="textarea", required=True),
        OutputField(key="numar_paragrafe", label_ro="Număr paragrafe", field_type="number"),
        OutputField(key="subiect_principal", label_ro="Subiect principal", field_type="text"),
        OutputField(key="tip_continut", label_ro="Tip conținut", field_type="text"),
        OutputField(key="observatii", label_ro="Observații", field_type="textarea"),
    ],
)
