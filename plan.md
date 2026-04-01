# plan.md — Meetings.ro (Expo RN SDK 54) / Vertical Engine (FastAPI)

## 1) Obiective
- Menținerea unui **flux core stabil end-to-end**: (înregistrare/fișier audio → upload cu progres real-time → procesare AI via Vertical Engine → raport dinamic).
- Consolidarea unui **V1 utilizabil** în Expo RN (SDK 54) cu:
  - navigare **Drawer** accesibilă din TopBar (hamburger)
  - **workspace (vertical) selector** persistent (AsyncStorage)
  - **audio recording** nativ (m4a/aac) + **waveform live** în timpul înregistrării
  - **audio upload** nativ cu **progres real** (XMLHttpRequest) + retry/backoff
  - ecrane **Browse** și **Calendar** funcționale (listare + filtrare după zi)
- Ridicarea nivelului de calitate pentru **Faza 3 (hardening + features)**: testare pe device, clarificare/afișare status pipeline, export (PDF/DOCX), offline queue.

---

## 2) Pași de implementare (faze)

### Faza 1 — POC (izolat) pentru fluxul core (audio + upload + AI)
> Scop: validare end-to-end cu backend-ul și Vertical Engine.

**Stare curentă:**
- 🟡 Fluxul există și este integrat în aplicația Expo RN, dar necesită **testare sistematică pe device** și/sau un **script POC repetabil**.

**User stories (POC)**
1. Ca utilizator, vreau să pot crea o întâlnire cu `vertical_type` și să primesc un `meeting_id` valid.
2. Ca utilizator, vreau să pot încărca un fișier audio (m4a) și să văd progresul de upload în timp real.
3. Ca utilizator, vreau ca backend-ul să proceseze audio și să atașeze transcript/raport în funcție de workspace.
4. Ca utilizator, vreau să pot deschide detaliile întâlnirii și să văd raportul randat dinamic.
5. Ca utilizator, vreau ca erorile (upload eșuat / AI eșuat) să fie raportate clar și întâlnirea să rămână într-un status coerent.

**Implementare / verificări**
- (Websearch) Confirmare best practices pentru: RN `XMLHttpRequest` + `FormData` upload progress (Android/iOS), timeouts, mime-type.
- Script Python minim (în `/app/backend/scripts/`) (încă de adăugat):
  - `POST /api/meetings` cu `{ vertical_type }`.
  - `POST /api/meetings/{id}/upload` cu multipart audio de test.
  - Poll/GET meeting (sau endpoint existent) până când apare `status=processed` + câmpuri raport.
- Verificare Mongo: `vertical_type` persistă, `vertical_config` (dacă există) e consistent.
- Stabilizare: retry/backoff, limite de fișier, CORS pentru Expo, răspunsuri JSON consistente.

**Output Faza 1**
- POC trece de 3 ori la rând cu fișiere diferite și 2 vertical-uri diferite.

---

### Faza 2 — Dezvoltare V1 App (MVP) în jurul fluxului core
**Stare curentă:** ✅ **COMPLETATĂ** (extinsă cu Browse/Calendar + Waveform)

**User stories (V1)**
1. Ca utilizator, vreau să deschid meniul Drawer din hamburger (TopBar) și să navighez între Acasă/Întâlniri/Calendar/Setări.
2. Ca utilizator, vreau să selectez workspace-ul (GAL/Jurnalism/Juridic/Bancar) și să fie folosit la întâlnirile noi.
3. Ca utilizator, vreau să înregistrez audio nativ (m4a/aac) și să văd un waveform live doar în timpul înregistrării.
4. Ca utilizator, vreau să pot încărca un fișier audio existent și să văd progresul real al upload-ului.
5. Ca utilizator, vreau să deschid ecranul unei întâlniri și să văd raportul dinamic (secțiuni diferite pe vertical).
6. Ca utilizator, vreau să văd lista tuturor întâlnirilor (Browse), grupate pe vertical.
7. Ca utilizator, vreau un calendar lunar care marchează zilele cu întâlniri și îmi filtrează lista pe zi.

**Implementare (realizată)**
- UI/Navigation:
  - ✅ Drawer complet (Expo Router + `expo-router/drawer`) + `CustomDrawer`.
  - ✅ `TopBar` deschide Drawer prin `navigation.openDrawer()` (hook `useNavigation`).
  - ✅ `@react-navigation/native` instalat și folosit în `TopBar`.
  - ✅ TopBar consistent pe ecrane: `index`, `browse`, `calendar`, `onboarding`.
- Workspace:
  - ✅ `VerticalSelector` salvează în AsyncStorage și se reflectă pe Home (record/upload).
- Audio:
  - ✅ `AudioRecorder` (expo-av) produce fișier m4a.
  - ✅ **Waveform live**: implementare custom cu Animated API (32 bare) bazată pe metering.
    - `react-native-audiowaveform` verificată: **nepotrivită pentru Expo Managed** → s-a ales custom.
    - Update interval ~16ms (țintă 60fps); animația de height folosește `useNativeDriver: false` (limitare RN).
  - ✅ `AudioUploader` folosește XHR + progres real-time + retry/backoff.
- Browse:
  - ✅ `/app/browse.tsx` implementat complet:
    - GET `/api/meetings` (limit 100)
    - grupare pe `vertical_type`
    - item: titlu (DD.MM.YYYY | Localitatea), status badge, vertical badge
    - tap → `/meeting/[id]`
    - pull-to-refresh (RefreshControl)
    - empty state: „Nicio întâlnire încă”
- Calendar:
  - ✅ `react-native-calendars@1.1314.0` instalat.
  - ✅ `/app/calendar.tsx` implementat complet:
    - zile marcate cu dot navy via GET `/api/meetings/calendar-dates?year&month`
    - tap pe zi → listă filtrată via GET `/api/meetings/calendar-by-date?date=YYYY-MM-DD`
    - empty state: „Nicio întâlnire în această zi”
- Meeting detail:
  - ✅ `DynamicReportView` consumă backend și randează raportul conform `vertical_config`.

**Fișiere modificate (cheie)**
- ✅ `/app/meetings-ro/app/browse.tsx` — rewrite complet
- ✅ `/app/meetings-ro/app/calendar.tsx` — rewrite complet
- ✅ `/app/meetings-ro/src/components/AudioRecorder.tsx` — rewrite complet cu waveform
- ✅ `/app/meetings-ro/package.json` — adăugat `react-native-calendars`

**Artefacte livrate**
- ✅ Bundle disponibil pentru download:
  - `https://gal-transcribe.preview.emergentagent.com/download/meetings-ro.zip`
- ✅ Bundle actualizat local:
  - `/tmp/meetings-ro.zip` (~184KB)
- ✅ Documentație:
  - `/tmp/DRAWER_NAVIGATION_COMPLETE.md`

**Concluzie fază**
- V1 UI este complet (Drawer + Browse + Calendar + Workspace + Record/Upload + Report). Urmează testarea reală pe device și hardening.

---

### Faza 3 — Extindere funcționalități + hardening
**Stare curentă:** 🔜 **ÎN DESFĂȘURARE (prioritate P0: testare pe device)**

**User stories (Hardening/Features)**
1. Ca utilizator, vreau ca upload-urile întrerupte să poată fi reluate (reselect + retry) fără a pierde întâlnirea.
2. Ca utilizator, vreau să văd status clar: „în curs”, „upload”, „transcriere”, „analiză”, „gata”, „eșuat”.
3. Ca utilizator, vreau să pot lista întâlnirile în Browse și să reiau o întâlnire din listă (deja implementat; urmează polish + paginare).
4. Ca utilizator, vreau export (PDF/DOCX) via share sheet (când e disponibil).
5. Ca utilizator, vreau ca aplicația să funcționeze bine offline (înregistrare + coadă upload).
6. Ca utilizator, vreau ca waveform-ul să fie stabil pe device (performanță, consum, sampling corect metering).

**Implementare (actualizată)**
- Testare pe device fizic (P0):
  - iOS + Android: validare Drawer, Browse, Calendar, recording + waveform, upload XHR cu fișiere mari (50–100MB), backgrounding.
- Browse real (P0/P1):
  - deja implementat; adăugări: paginare, search, filtre (locality/status/vertical), caching.
- Calendar view (P0/P1):
  - deja implementat; adăugări: schimbare lună mai robustă, indicator count, optimizări request.
- Status pipeline (P0):
  - aliniere backend↔frontend pe status-uri; afișare status în listă + detalii.
- Offline queue (P1/P2):
  - stocare draft-uri + fișiere, retry la reconectare.
- Export P1:
  - PDF/DOCX export cu `expo-file-system` + `expo-sharing`.
- Waveform hardening (P0/P1):
  - confirmare metering availability pe iOS/Android;
  - dacă metering lipsește: fallback vizual controlat + sampling mai rar (ex. 33ms) pentru consum;
  - eventual migrare la `expo-audio` când e disponibil/stabil pentru SDK 54+.

**Concluzie fază**
- 1 rundă de test end-to-end: scenarii offline/online + listare + redeschidere meeting + calendar.

---

### Faza 4 — Testare completă & stabilizare release
**User stories (QA/Release)**
1. Ca utilizator, vreau ca înregistrarea să nu se corupă între sesiuni și fișierele să fie gestionate sigur.
2. Ca utilizator, vreau ca progresul de upload să fie corect pentru fișiere mari (ex. 50–100MB).
3. Ca utilizator, vreau ca rapoartele să fie consistente pe toate vertical-urile.
4. Ca utilizator, vreau ca app-ul să nu crape la permisiuni (microfon/storage) și să primesc explicații.
5. Ca utilizator, vreau performanță bună: listă întâlniri rapidă, calendar fluid, meeting detail fără lag.

**Implementare**
- Testare pe device fizic, regresii UI (NativeWind), permisiuni, backgrounding.
- Observabilitate minimă: log-uri backend + coduri de eroare coerente.
- Stabilizare dependențe/lockfiles:
  - decizie și aliniere pe un singur package manager (npm sau yarn) + cleanup (evitat mix `yarn.lock`/`package-lock.json`).

---

## 3) Next Actions (imediat)
1. **Testare pe device fizic** (P0): Drawer + Browse + Calendar + waveform + înregistrare + upload XHR cu progres.
2. Adaug **script Python POC** pentru backend (create meeting + upload + poll status) și rulez cu 2 vertical-uri.
3. Ajustez contractul de status (și UI badges) pentru consistență (frontend ↔ backend).
4. Implementare P0: **Browse polish** (paginare, search, filtre) + empty/error handling.
5. Implementare P0/P1: **Calendar polish** (optimizați request-urile, handle month navigation edge cases).
6. Export P1: design UI + integrare `expo-sharing` pentru PDF/DOCX.
7. Curăț lockfiles: aleg un manager (recomandat în Expo: **npm**) și elimin inconsistențe.

---

## 4) Criterii de succes
- POC: 3 rulări consecutive reușite (2 vertical-uri) pentru fluxul create→upload→processed→report.
- Mobile:
  - ✅ Drawer accesibil din TopBar pe toate ecranele relevante.
  - ✅ Browse: listare întâlniri grupate pe vertical + pull-to-refresh + navigare la detalii.
  - ✅ Calendar: zile marcate cu dot navy + filtrare întâlniri pe zi + empty state.
- Upload: ✅ progres real-time (bytes) funcțional și corect; retry/backoff funcționează.
- Audio:
  - ✅ Înregistrare m4a/aac funcțională.
  - ✅ Waveform live (custom) vizibil doar în timpul înregistrării; reset la stop.
- Raport: ✅ `DynamicReportView` afișează conținut specific vertical-ului fără erori.
- Date: `vertical_type` persistă în Mongo pentru toate întâlnirile noi; migrarea e completă.
- QA: funcționare stabilă pe device fizic pentru fișiere mari + backgrounding + permisiuni + performanță (calendar/listă/waveform).
