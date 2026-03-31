# plan.md — GAL MEETINGS (Mobile-first PWA)

## 1) Objectives (Current)
- ✅ Deliver a mobile-first **PWA** that reliably records meetings and reduces post-meeting work to <5 minutes.
- ✅ Romanian-first workflow: **Înregistrare → Transcriere (Whisper) → Rezumat/Acțiuni (Claude) → Organizare pe localitate → Export PDF/DOCX**.
- ✅ Core meeting lifecycle with statuses: **pending / uploading / processing / done / error**.
- ✅ Dark / light mode and mobile-first UI with large touch targets.
- ⏭️ Next objective (Phase 3): harden reliability + offline-first queue + improved export fidelity and scalability.

---

## 2) Implementation Steps

### Phase 1 — Core Workflow POC (Isolation: Audio → Whisper → Claude → JSON) — ✅ COMPLETED
**Goal:** Prove the hardest chain works end-to-end with real Romanian audio + stable structured outputs.

**Delivered (POC outcomes)**
- ✅ Whisper Romanian transcription works (`whisper-1`) including timestamp segments.
- ✅ Claude structured extraction works (Anthropic Claude) returning valid JSON:
  - `title`, `locality`, `summary[]`, `key_points[]`, `actions[]`.
- ✅ Full chain proven: **Audio → Transcript → Summary/Actions/Locality**.

**Exit criteria (met)**
- ✅ Multiple Romanian samples processed successfully; JSON validated; retry/error handling verified in POC runs.

---

### Phase 2 — V1 App Development (MVP PWA + FastAPI + MongoDB) — ✅ COMPLETED
**Goal:** Build the full app around the proven core chain.

**Delivered (V1 features)**

**Backend (FastAPI + MongoDB)**
- ✅ MongoDB collections and indexes for meetings + locality aggregation.
- ✅ Implemented endpoints (as shipped):
  - `GET /api/health`
  - `POST /api/meetings` (create placeholder)
  - `POST /api/meetings/{id}/upload` (upload audio; background processing)
  - `GET /api/meetings/{id}/audio` (audio playback, proper headers)
  - `GET /api/meetings` (list with filters, text search)
  - `GET /api/meetings/{id}` (detail)
  - `PATCH /api/meetings/{id}` (update title/locality)
  - `DELETE /api/meetings/{id}`
  - `PATCH /api/meetings/{id}/actions/{action_id}` (toggle completion)
  - `POST /api/meetings/{id}/regenerate` (re-run AI)
  - `GET /api/localities` (dynamic list + counts)
  - `GET /api/meetings/{id}/export/pdf`
  - `GET /api/meetings/{id}/export/docx`
- ✅ AI processing pipeline:
  - Whisper (`whisper-1`) Romanian transcription
  - Claude structured extraction for summaries/actions/locality
- ✅ Exports working:
  - PDF export hardened (avoid Romanian filename encoding issues and layout edge cases)
  - DOCX export working

**Frontend (React mobile-first PWA)**
- ✅ Romanian UI throughout.
- ✅ Home/Recorder screen:
  - One-tap record toggle, timer, waveform visualization.
- ✅ Browse screen:
  - Search, locality chips, meeting cards with status.
- ✅ Meeting detail screen:
  - Tabs: **Rezumat / Acțiuni / Transcriere**
  - Action checkboxes toggle + persistence
  - Export buttons (PDF/DOCX)
  - Audio playback
- ✅ Navigation + drawer with dynamic localities.
- ✅ Dark/light mode toggle.

**Testing (V1 verification)**
- ✅ Comprehensive tests passed:
  - Backend: **100%** of requested endpoint tests
  - Frontend: **95%** (minor non-blocking UI edge cases)
- ✅ E2E verification performed using a real processed meeting: browse → detail → action toggle → export.

---

### Phase 3 — Reliability + UX Hardening (post-V1) — ⏭️ READY / NOT STARTED
**Goal:** Make the app more resilient in field conditions (poor connectivity, longer recordings), and improve operational polish.

**User stories (Hardening)**
1. As a user, I can record offline and the app queues uploads automatically when back online (no lost audio).
2. As a user, I can see upload progress and estimated time for large files.
3. As a user, I can regenerate rezumat/acțiuni if the first result is weak.
4. As a user, I can search within a transcript and highlight matches.
5. As a user, exports reflect any edited title/locality and include richer formatting.

**Planned steps**
- Offline-first queue (IndexedDB):
  - Persist recordings locally immediately
  - Upload queue with retry + backoff
  - Clear UI states: queued / uploading / processing / done / error
- Improve large-file handling:
  - Enforce size limits, show friendly errors
  - Optional chunking / resumable uploads if needed
  - Optional audio normalization/format conversion server-side
- Processing hardening:
  - Better error messages + retry controls
  - Background task robustness (idempotent processing)
- UX polish:
  - Better audio duration/metadata behavior across formats
  - More consistent skeleton/loading states
  - Optional meeting title edit UI
- Export fidelity:
  - Improve PDF typography (Unicode font embedding if required)
  - Option to include transcript or exclude for shorter exports

**End of Phase 3: Testing**
- Stress test: 10+ meetings, mixed connectivity, ensure queue + statuses stable.

---

### Phase 4 — Enterprise Features (optional) — ⏭️ BACKLOG
**User stories (Enterprise)**
1. As a user, I can do full-text search across all transcripts (fast at scale).
2. As a user, I can filter by date range and locality.
3. As a user, I can export a batch of meetings per locality.
4. As a user, I can tag meetings (ex: „infrastructură”, „turism”) and filter.
5. As a user, I can share a read-only export link (no-auth, tokenized).

**Planned steps**
- MongoDB text indexes (already in place) + improved query UX.
- Batch export.
- Tagging.
- Share links with random tokens.

---

## 3) Next Actions (Updated)
1. ✅ Phase 1 complete — keep prompts/schema stable and version them.
2. ✅ Phase 2 complete — monitor production-like usage and gather field feedback.
3. ⏭️ If you want Phase 3:
   - Implement offline recording queue (IndexedDB)
   - Add upload progress + retry UI
   - Harden exports (optional Unicode fonts in PDF)
   - Add longer-audio strategy (chunking/resumable)

---

## 4) Success Criteria (Updated)
- ✅ Core flow works: **Record → Transcript (RO) → Rezumat/Acțiuni → Localitate → Export**.
- ✅ Processing reliability: clear statuses, regeneration available.
- ✅ Output quality: summary <=10 bullets, action items actionable, locality detected or “Necunoscut”.
- ✅ Usability: one-tap recording, large buttons, Romanian UI, dark/light mode, fast browsing by locality.
- ⏭️ Phase 3 success: offline queue guarantees zero data loss under intermittent connectivity; large-file experience remains smooth and understandable.
