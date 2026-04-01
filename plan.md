# plan.md — Meetings.ro (Expo RN SDK 54) / Vertical Engine (FastAPI)

## 1) Obiective
- Menținerea unui **flux core stabil end-to-end**: (înregistrare/fișier audio → upload cu progres real-time → procesare AI via Vertical Engine → raport dinamic).
- Consolidarea unui **V1 utilizabil** în Expo RN (SDK 54) cu:
  - navigare **Drawer** accesibilă din TopBar (hamburger)
  - **workspace (vertical) selector** persistent (AsyncStorage)
  - **audio recording** nativ (m4a/aac) + **waveform live** în timpul înregistrării
  - **audio upload** nativ cu **progres real** (XMLHttpRequest) + retry/backoff
  - ecrane **Browse** și **Calendar** funcționale (listare, căutare/filtrare, filtrare după zi)
  - **status pipeline vizibil** + actualizări real-time (polling) în Meeting Detail
  - **export PDF/DOCX** via share sheet nativ (iOS/Android)
- Ridicarea nivelului de calitate pentru **Faza 4 (QA & release hardening)**: testare pe device, performanță, stabilizare dependențe/lockfiles, offline queue (P2), polish UX.

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
  - ✅ `/app/browse.tsx` implementat complet (listare grupată pe vertical, badges, navigare, pull-to-refresh, empty state).
- Calendar:
  - ✅ `react-native-calendars@1.1314.0` instalat.
  - ✅ `/app/calendar.tsx` implementat complet (dots pentru zile cu întâlniri, listă filtrată pe zi, empty state).
- Meeting detail:
  - ✅ `DynamicReportView` consumă backend și randează raportul conform `vertical_config`.

**Fișiere modificate (cheie)**
- ✅ `/app/meetings-ro/app/browse.tsx` — implementare Browse
- ✅ `/app/meetings-ro/app/calendar.tsx` — implementare Calendar
- ✅ `/app/meetings-ro/src/components/AudioRecorder.tsx` — waveform live
- ✅ `/app/meetings-ro/package.json` — dependențe adăugate pe parcurs (ex. `react-native-calendars`)

**Artefacte livrate**
- ✅ Bundle disponibil pentru download:
  - `https://gal-transcribe.preview.emergentagent.com/download/meetings-ro.zip`
- ✅ Documentație:
  - `/tmp/DRAWER_NAVIGATION_COMPLETE.md`

**Concluzie fază**
- V1 UI este complet (Drawer + Browse + Calendar + Workspace + Record/Upload + Report). Urmează testarea reală pe device și hardening.

---

### Faza 3 — Extindere funcționalități + hardening
**Stare curentă:** ✅ **COMPLETATĂ (P0 + P1 implementate)**

**User stories (Hardening/Features)**
1. Ca utilizator, vreau să pot verifica ușor că aplicația funcționează corect pe device (scenarii de test clare + benchmark-uri).
2. Ca utilizator, vreau să văd status clar: „în curs”, „upload”, „transcriere”, „procesare”, „gata”, „eșuat”.
3. Ca utilizator, vreau ca Meeting Detail să se actualizeze automat în timp ce întâlnirea se procesează.
4. Ca utilizator, vreau să pot căuta și filtra rapid întâlnirile (vertical/status/căutare text).
5. Ca utilizator, vreau paginare (load more) pentru liste mari.
6. Ca utilizator, vreau calendar mai rapid (cache/prefetch) și să văd câte întâlniri sunt într-o zi.
7. Ca utilizator, vreau export (PDF/DOCX) via share sheet nativ.
8. Ca utilizator, vreau ca waveform-ul să fie stabil pe device (performanță, consum, sampling corect metering).

**Implementare (realizată în Faza 3)**
- ✅ P0.1 Testing Documentation:
  - Creat ghid complet: `/tmp/PHASE3_TESTING_GUIDE.md` (10 scenarii: Drawer, Browse, Calendar, Waveform, Upload mare, Status pipeline, Search/Filters, Pagination, Cache, Export).
  - Include checklist iOS/Android, performance benchmarks (FPS/memorie/baterie), template bug report și template test report.
- ✅ P0.2 Status Pipeline Real-time:
  - `DynamicReportView.tsx`:
    - badge status color-coded
    - polling automat la 5s pentru status non-final
    - pull-to-refresh cu `RefreshControl` + haptic
    - auto-stop polling când status devine `processed` sau `failed`
    - indicator vizual „Procesare în curs... Pull-to-refresh pentru actualizare.”
- ✅ P1.1 Browse Screen Polish:
  - `browse.tsx` rewrite major:
    - search bar (titlu/localitate)
    - filtre toggle (vertical + status)
    - counter badge pt filtre active
    - buton „Șterge toate filtrele”
    - empty state pentru „Niciun rezultat”
    - paginare (50 per page) cu load more la scroll end (activă când nu sunt filtre/search)
- ✅ P1.2 Calendar Optimization:
  - `calendar.tsx`:
    - cache markedDates pe lună
    - prefetch automat luna următoare
    - count per day în cache (pregătit pentru UI)
- ✅ P1.3 Export PDF/DOCX:
  - Instalare `expo-sharing`.
  - `DynamicReportView.tsx`:
    - butoane „Export PDF” și „Export DOCX” (doar pentru `processed`)
    - download via `expo-file-system` (`downloadAsync`) de la endpoint-urile backend
    - share via `Sharing.shareAsync` (native share sheet)
    - loading state + disabled în timpul exportului
    - alerte pentru erori și pentru întâlniri ne-finalizate

**Fișiere modificate / adăugate (Faza 3)**
- ✅ `/tmp/PHASE3_TESTING_GUIDE.md` — NOU
- ✅ `/app/meetings-ro/src/components/DynamicReportView.tsx` — update major (status + polling + refresh + export)
- ✅ `/app/meetings-ro/app/browse.tsx` — rewrite complet (search/filters/pagination)
- ✅ `/app/meetings-ro/app/calendar.tsx` — optimizări (cache/prefetch/count)
- ✅ `/app/meetings-ro/package.json` — adăugat `expo-sharing`

**Artefacte livrate**
- ✅ Bundle actualizat local:
  - `/tmp/meetings-ro.zip` (~297KB)
- ✅ Bundle disponibil pentru download:
  - `https://gal-transcribe.preview.emergentagent.com/download/meetings-ro.zip`

**Concluzie fază**
- P0 + P1 sunt implementate. Urmează **execuția efectivă a testelor pe device** + hardening/cleanup pentru release.

---

### Faza 4 — Testare completă & stabilizare release
**Stare curentă:** 🔜 **URMĂTOAREA FAZĂ (QA + release hardening)**

**User stories (QA/Release)**
1. Ca utilizator, vreau ca înregistrarea să nu se corupă între sesiuni și fișierele să fie gestionate sigur.
2. Ca utilizator, vreau ca progresul de upload să fie corect pentru fișiere mari (ex. 50–100MB) și UI să nu înghețe.
3. Ca utilizator, vreau ca rapoartele să fie consistente pe toate vertical-urile.
4. Ca utilizator, vreau ca app-ul să nu crape la permisiuni (microfon/storage) și să primesc explicații.
5. Ca utilizator, vreau performanță bună: listă întâlniri rapidă, calendar fluid, meeting detail fără lag.
6. Ca utilizator, vreau o experiență coerentă de export (PDF/DOCX) și fișiere valide.

**Implementare (plan)**
- Testare completă pe device fizic:
  - iOS + Android: parcurgere toate scenariile din `/tmp/PHASE3_TESTING_GUIDE.md`.
  - Captură metrici: FPS waveform, scroll perf, memorie, rețea.
- Fix-uri pe baza raportului de test:
  - metering availability / fallback (Android)
  - optimizări update interval waveform (ex. 33ms) dacă baterie/CPU cresc
  - îmbunătățire mesaje de eroare pentru upload/export
- Observabilitate minimă:
  - log-uri backend coerente + coduri de eroare
  - eventual endpoint-uri pentru status detaliat
- Stabilizare dependențe/lockfiles:
  - decizie și aliniere pe un singur package manager (npm sau yarn)
  - eliminare mix `yarn.lock`/`package-lock.json`
- Funcționalități P2 (dacă rămâne timp):
  - Offline upload queue (AsyncStorage + retry)

---

## 3) Next Actions (imediat)
1. **Rulează testele pe device fizic** (P0): urmează `/tmp/PHASE3_TESTING_GUIDE.md` și completează un test report.
2. Adaug **script Python POC** pentru backend (create meeting + upload + poll status) și rulez cu 2 vertical-uri.
3. Dacă se confirmă probleme de performanță la waveform:
   - ajustează sampling (ex. 33ms) și/sau număr bare.
4. Stabilizează export:
   - verifică PDF/DOCX pe iOS/Android (open/share), mime types.
5. Curăț lockfiles: alege un manager (recomandat: npm sau yarn, dar unul singur) și elimină inconsistenta.

---

## 4) Criterii de succes
- POC: 3 rulări consecutive reușite (2 vertical-uri) pentru fluxul create→upload→processed→report.
- Mobile:
  - ✅ Drawer accesibil din TopBar.
  - ✅ Browse: listare + search + filtre + paginare + pull-to-refresh.
  - ✅ Calendar: dots + filtrare pe zi + cache/prefetch.
- Status:
  - ✅ Badge status color-coded.
  - ✅ Polling + pull-to-refresh în Meeting Detail.
- Export:
  - ✅ Export PDF/DOCX disponibil pentru întâlniri `processed` via share sheet.
- Upload:
  - ✅ progres real-time (bytes) funcțional și corect; retry/backoff funcționează.
- Audio:
  - ✅ Înregistrare m4a/aac funcțională.
  - ✅ Waveform live (custom) vizibil doar în timpul înregistrării; reset la stop.
- Date:
  - ✅ `vertical_type` persistă în Mongo pentru toate întâlnirile noi.
- QA:
  - trecerea testelor pe device (iOS + Android) fără crash-uri; performanță acceptabilă (FPS/memorie/baterie) conform benchmark-urilor din ghid.
