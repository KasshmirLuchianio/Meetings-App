# plan.md — GAL MEETINGS (Mobile-first PWA)

## 1) Objectives
- Deliver a mobile-first **PWA** that reliably records meetings, **never loses audio**, and reduces post-meeting work to <5 minutes.
- Romanian-first workflow: **Înregistrare → Transcriere (Whisper) → Rezumat/Acțiuni (Claude) → Organizare pe localitate → Export PDF/DOCX**.
- Offline-first: recordings saved locally + upload queue + clear statuses (pending/processing/done/error).

---

## 2) Implementation Steps

### Phase 1 — Core Workflow POC (Isolation: Audio → Whisper → Claude → JSON)
**Goal:** Prove the hardest chain works end-to-end with real Romanian audio + stable structured outputs.

**User stories (POC)**
1. As a user, I can upload a short Romanian audio file and get a transcript back.
2. As a user, I receive a Romanian summary (<=10 bullets) and action items from the transcript.
3. As a user, the system detects a locality from the transcript with a confidence score.
4. As a user, I see a clear error when transcription/AI fails and can retry.
5. As a user, the AI output is valid JSON that the app can render without manual cleanup.

**Steps**
- Websearch best practices:
  - Whisper: audio formats, file size limits, chunking strategy.
  - Claude: JSON-mode prompting / tool-use patterns + validation.
- Create minimal Python scripts (no app UI):
  - `poc_whisper.py`: send audio → get transcript (+ optionally segments/timestamps).
  - `poc_claude.py`: send transcript → get strict JSON `{title, locality, summary[], key_points[], actions[]}`.
  - `poc_chain.py`: run both + validate JSON schema; persist sample result to a local JSON file.
- Iterate prompts until:
  - Locality extraction is consistent.
  - Actions are sensible (owner/deadline optional).
  - Output always parses.
- Define the “contract” JSON schema used by backend + frontend.

**Exit criteria**
- 3 Romanian samples processed successfully; JSON validated; retry logic proven.

---

### Phase 2 — V1 App Development (MVP PWA + FastAPI + MongoDB)
**Goal:** Build the full app around the proven core chain.

**User stories (V1)**
1. As a user, I can start/stop recording with one large button and see a timer.
2. As a user, my recording is saved locally immediately so I don’t lose it if the network drops.
3. As a user, once online, the app uploads and shows status (În așteptare / Se procesează / Gata / Eroare).
4. As a user, I can browse meetings grouped by **Localitate** and override the locality if needed.
5. As a user, I can open a meeting, play audio, read rezumat/acțiuni/transcriere, and export PDF/DOCX.

**Backend (FastAPI)**
- Data model in MongoDB:
  - `meetings`: title, locality, date, audio_url/path, transcript, timestamps(optional), summary[], key_points[], actions[], status, error, created_at.
  - `localities`: derived collection or computed distinct from meetings (store when first seen).
- API endpoints (MVP):
  - `POST /api/meetings` (create placeholder + status=pending)
  - `POST /api/meetings/{id}/audio` (upload audio; store; enqueue processing)
  - `POST /api/meetings/{id}/process` (transcribe + summarize; set status)
  - `GET /api/meetings?locality=&q=&page=` (list)
  - `GET /api/meetings/{id}` (detail)
  - `PATCH /api/meetings/{id}` (title/locality override; action complete toggle)
  - `GET /api/localities` (list)
  - `GET /api/meetings/{id}/export.pdf` and `/export.docx`
- Processing strategy (MVP):
  - Synchronous for short audios; for longer, background task (FastAPI BackgroundTasks) + polling.
  - Robust retries + store `error` field.

**Frontend (React PWA)**
- PWA setup: manifest + service worker for caching shell; offline indicator.
- Screens:
  - Home/Recorder: big Start/Stop, timer, waveform (lightweight), “Salvează local” queue.
  - Processing view: progress + status; retry.
  - Browse: left drawer/localities (All + dynamic list), meeting list sorted by date, search.
  - Meeting detail: tabs (Rezumat / Acțiuni / Transcriere), audio playback, export buttons.
- Offline-first queue:
  - Store recordings + pending meeting metadata in IndexedDB.
  - Background sync: when `navigator.onLine` becomes true, upload queued items.

**Exports**
- PDF: server-side generation (clean template: title, date, locality, summary, actions, key points, transcript optional).
- DOCX: server-side generation with same structure.

**End of Phase 2: Testing (1 full round)**
- Run E2E: record 30–90s sample → upload → done → browse by locality → open → export PDF/DOCX.
- Validate offline scenario: record in airplane mode → later upload.

---

### Phase 3 — Reliability + UX Hardening (post-V1)
**User stories (Hardening)**
1. As a user, I can see upload progress and remaining time for large files.
2. As a user, I can regenerate rezumat/acțiuni if the first result is weak.
3. As a user, I can search within a transcript and highlight matches.
4. As a user, I can mark action items complete and the state persists.
5. As a user, I can edit meeting title/locality and export reflects my edits.

**Steps**
- Add chunked upload (if needed) + server-side size limits + format normalization.
- Add pagination + lazy-load transcript.
- Add “Regenerare AI” endpoint + UI.
- Improve locality detection:
  - heuristic + Claude confirmation; allow “Necunoscut” fallback.
- Add consistent dark/light theming + large touch targets audit.
- Add basic analytics counters (meetings per locality, processing success rate).

**End of Phase 3: Testing (1 full round)**
- Stress test: 10+ meetings, mixed connectivity, ensure queue + statuses remain correct.

---

### Phase 4 — Enterprise Features (optional)
**User stories (Enterprise)**
1. As a user, I can do full-text search across all transcripts.
2. As a user, I can filter by date range and locality.
3. As a user, I can export a batch of meetings for a locality.
4. As a user, I can add tags (ex: “infrastructură”, “turism”) and filter.
5. As a user, I can share a read-only export link.

- Mongo text indexes for transcript search.
- Batch export.
- Tagging.
- Share links (no-auth but random token URLs).

---

## 3) Next Actions
1. Implement Phase 1 POC scripts (Whisper + Claude) using Emergent LLM Key.
2. Lock the JSON schema + prompts (Romanian) and validate on 3 real samples.
3. Build Phase 2 MVP endpoints + Mongo models.
4. Build Phase 2 mobile-first PWA UI + IndexedDB queue.
5. Run 1 full E2E test round; fix until stable.

---

## 4) Success Criteria
- Core flow works: **Record → Transcript (RO) → Rezumat/Acțiuni → Localitate → Export**.
- Offline-first: recordings captured offline and later uploaded without loss.
- Processing reliability: clear statuses; retry works; <5% failure in test set.
- Output quality: summary <=10 bullets; action items are actionable; locality is correct or safely “Necunoscut”.
- Usability: one-tap recording, large buttons, Romanian UI, dark/light mode, fast browsing by locality.