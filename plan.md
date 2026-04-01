# plan.md — Meetings.ro (Expo RN SDK 54) / Vertical Engine (FastAPI)

## 1) Obiective
- Menținerea unui **flux core stabil end-to-end**: (înregistrare/fișier audio → upload cu progres real-time → procesare AI via Vertical Engine → raport dinamic).
- Consolidarea unui **V1 utilizabil** în Expo RN (SDK 54) cu:
  - navigare **Drawer** accesibilă din TopBar (hamburger)
  - **workspace (vertical) selector** persistent (AsyncStorage)
  - **audio recording** nativ (m4a/aac)
  - **audio upload** nativ cu **progres real** (XMLHttpRequest) + retry/backoff
- Ridicarea nivelului de calitate pentru **Faza 3 (hardening + features)**: listare întâlniri, status pipeline clar, export și testare pe device.

---

## 2) Pași de implementare (faze)

### Faza 1 — POC (izolat) pentru fluxul core (audio + upload + AI)
> Scop: validare end-to-end cu backend-ul și Vertical Engine.

**Stare curentă:**
- 🟡 POC funcțional la nivel de aplicație (componentele există și sunt integrate), dar necesită **testare sistematică pe device** și/sau script POC pentru repetabilitate.

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
**Stare curentă:** ✅ **COMPLETATĂ**

**User stories (V1)**
1. Ca utilizator, vreau să deschid meniul Drawer din hamburger (TopBar) și să navighez între Acasă/Întâlniri/Calendar/Setări.
2. Ca utilizator, vreau să selectez workspace-ul (GAL/Jurnalism/Juridic/Bancar) și să fie folosit la întâlnirile noi.
3. Ca utilizator, vreau să înregistrez audio nativ (m4a/aac) și să inițiez upload către backend.
4. Ca utilizator, vreau să pot încărca un fișier audio existent și să văd progresul real al upload-ului.
5. Ca utilizator, vreau să deschid ecranul unei întâlniri și să văd raportul dinamic (secțiuni diferite pe vertical).

**Implementare (realizată)**
- UI/Navigation:
  - ✅ Drawer complet (Expo Router + `expo-router/drawer`) + `CustomDrawer`.
  - ✅ `TopBar` deschide Drawer prin `navigation.openDrawer()` (hook `useNavigation`).
  - ✅ `@react-navigation/native` instalat și folosit în `TopBar`.
  - ✅ TopBar consistent pe ecrane: `index`, `browse`, `calendar`, `onboarding`.
- Workspace:
  - ✅ `VerticalSelector` salvează în AsyncStorage și se reflectă pe Home (record/upload).
- Audio:
  - ✅ `AudioRecorder` (expo-av) produce fișier m4a și declanșează upload (flow existent pe Home).
  - ✅ `AudioUploader` folosește XHR + progres real-time + retry/backoff.
- Meeting detail:
  - ✅ `DynamicReportView` consumă backend și randează raportul conform `vertical_config`.

**Artefacte livrate**
- ✅ Bundle v1.1 disponibil pentru download:
  - `https://gal-transcribe.preview.emergentagent.com/download/meetings-ro.zip`
- ✅ Documentație completă:
  - `/tmp/DRAWER_NAVIGATION_COMPLETE.md`

**Concluzie fază**
- Urmează execuția testelor end-to-end pe device (parte din Faza 3).

---

### Faza 3 — Extindere funcționalități + hardening
**Stare curentă:** 🔜 **URMĂTOAREA FAZĂ (începe acum)**

**User stories (Hardening/Features)**
1. Ca utilizator, vreau ca upload-urile întrerupte să poată fi reluate (reselect + retry) fără a pierde întâlnirea.
2. Ca utilizator, vreau să văd status clar: „în curs”, „upload”, „transcriere”, „analiză”, „gata”, „eșuat”.
3. Ca utilizator, vreau să pot lista întâlnirile în Browse și să reiau o întâlnire din listă.
4. Ca utilizator, vreau export (PDF/DOCX) via share sheet (când e disponibil).
5. Ca utilizator, vreau ca aplicația să funcționeze bine offline (înregistrare + coadă upload).

**Implementare (actualizată)**
- Testare pe device fizic (P0):
  - iOS + Android: validare Drawer, recording, upload XHR cu fișiere mari (50–100MB), backgrounding.
- Browse real (P0/P1):
  - implementare listare întâlniri din backend (paginare minimă, refresh, tap → `/meeting/[id]`).
- Calendar view (P1):
  - grouping întâlniri pe dată + UI calendar/listă.
- Status pipeline (P0):
  - clarificare contract backend (status-uri + timestamps), afișare în UI.
- Offline queue (P1/P2):
  - stocare metadate fișier + meeting draft + retry la reconectare.
- Export P1:
  - PDF/DOCX export cu `expo-file-system` + `expo-sharing`.

**Concluzie fază**
- 1 rundă de test end-to-end: scenarii offline/online + listare + redeschidere meeting.

---

### Faza 4 — Testare completă & stabilizare release
**User stories (QA/Release)**
1. Ca utilizator, vreau ca înregistrarea să nu se corupă între sesiuni și fișierele să fie gestionate sigur.
2. Ca utilizator, vreau ca progresul de upload să fie corect pentru fișiere mari (ex. 50–100MB).
3. Ca utilizator, vreau ca rapoartele să fie consistente pe toate vertical-urile.
4. Ca utilizator, vreau ca app-ul să nu crape la permisiuni (microfon/storage) și să primesc explicații.
5. Ca utilizator, vreau performanță bună: listă întâlniri rapidă și ecran meeting fără lag.

**Implementare**
- Testare pe device fizic, regresii UI (NativeWind), permisiuni, backgrounding.
- Observabilitate minimă: log-uri backend + coduri de eroare coerente.
- Stabilizare dependențe/lockfiles:
  - decizie și aliniere pe un singur package manager (npm sau yarn) + cleanup (evitat mix yarn.lock/package-lock).

---

## 3) Next Actions (imediat)
1. **Testare pe device fizic** (iOS + Android): Drawer + TopBar hamburger + înregistrare + upload XHR cu progres.
2. Adaug **script Python POC** pentru backend (create meeting + upload + poll status) și rulez cu 2 vertical-uri.
3. Confirm/completez contract endpoint-uri pentru „get meeting”/status (dacă lipsește, îl adaug).
4. Implementare **Browse screen real** (listare întâlniri) + navigare la meeting detail.
5. Încep **Calendar view** (grouping după dată) ca placeholder util, apoi UI complet.
6. Export P1: design API/flow pentru PDF/DOCX + integrare `expo-sharing`.
7. Curăț lockfiles: aleg un manager (recomandat în Expo: **npm**) și elimin inconsistențe.

---

## 4) Criterii de succes
- POC: 3 rulări consecutive reușite (2 vertical-uri) pentru fluxul create→upload→processed→report.
- Mobile: ✅ Drawer accesibil din TopBar pe toate ecranele relevante.
- Upload: ✅ progres real-time (bytes) funcțional și corect; retry/backoff funcționează.
- Raport: ✅ `DynamicReportView` afișează conținut specific vertical-ului fără erori.
- Date: `vertical_type` persistă în Mongo pentru toate întâlnirile noi; migrarea e completă.
- QA: funcționare stabilă pe device fizic pentru fișiere mari + backgrounding + permisiuni.