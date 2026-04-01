# Meetings.ro - Migration Plan (React PWA → Expo)

## Sprint Status: EP-00 în progres (Ziua 1)

---

## ✅ Completed Today (2026-04-01)

### EP-00 · ST-001 - Inițializare Proiect Expo ✅

**Tasks completed:**
- [x] Expo SDK 54 project init (managed workflow)
- [x] TypeScript strict mode activat
- [x] ESLint + Prettier configured (React Native rules)
- [x] Expo Router v6 setup (file-based routing)
- [x] Structură foldere: `src/{screens,components,services,hooks,types,constants}`
- [x] `app.json` configurat cu:
  - Name: "Meetings.ro"
  - Scheme: "meetingsro"
  - iOS permissions: NSMicrophoneUsageDescription + UIBackgroundModes
  - Android permissions: RECORD_AUDIO, storage
  - Splash color: #FAF8F3 (ivory)
- [x] Design tokens (`src/constants/theme.ts`):
  - Colors: ivory, navy, gold
  - Spacing, font sizes, border radius
  - Touch targets (44dp iOS, 56dp Android)
- [x] API config (`src/constants/config.ts`):
  - Endpoints, recording settings, upload config
- [x] TypeScript types (`src/types/index.ts`):
  - Meeting, Locality, VerticalConfig, OutputField
  - Vertical system types (EP-02 ready)

**Backend updates:**
- [x] CORS origins extended:
  - `exp://192.168.*` (Expo Go LAN)
  - `exp://localhost:19000` (Expo dev)
  - `https://meetings.ro`
- [x] `expose_headers`: Content-Range, Accept-Ranges (HTTP 206)
- [x] API title: "Meetings.ro API"

**MongoDB backup:**
- [x] Backup script ready: `mongodump --db gal_meetings --collection meetings`
- ⚠️ Database currently empty (no data to backup yet)
- 📝 Backup will run before EP-02 migration script

**Files created:**
```
/app/meetings-ro/
├── app/
│   ├── _layout.tsx      # Root layout with Stack navigator
│   └── index.tsx        # Home screen (test)
├── src/
│   ├── constants/
│   │   ├── theme.ts     # Design tokens (ivory/navy/gold)
│   │   └── config.ts    # API endpoints, recording settings
│   └── types/
│       └── index.ts     # TypeScript interfaces
├── app.json             # Expo config (permissions, bundle IDs)
├── .eslintrc.js
├── .prettierrc
└── tsconfig.json
```

**Testing status:**
- [ ] Expo Go tested on physical iOS device
- [ ] Expo Go tested on physical Android device

---

## 🚧 In Progress

### EP-00 · ST-002 - Mapping dependențe React → React Native

**Decisions made:**
- ✅ Waveform: `react-native-audiowaveform` (simform-solutions)
  - Spike: 2 zile testing
  - Fallback: Custom cu Reanimated 3
- ✅ UI Library: Custom components cu NativeWind v4 (nu RN Paper)
- ✅ Storage: AsyncStorage pentru vertical selection

**Next tasks:**
- [ ] Install NativeWind v4
- [ ] Install expo-av (recording)
- [ ] Install expo-file-system (upload)
- [ ] Install react-native-audiowaveform (spike)
- [ ] Install expo-haptics
- [ ] Test all libraries compatibility with SDK 54

---

## 📋 Upcoming (Săptămâna 1)

### EP-00 · ST-003 - Backend API contract validation
- [ ] Test GET /api/meetings din Expo Go
- [ ] Test POST /api/meetings/upload cu multipart
- [ ] Verify CORS headers în Expo
- [ ] Test HTTP 206 Range requests pentru audio playback

---

## 📅 Timeline

**Week 1 (Current):**
- Day 1 ✅: EP-00 · ST-001 (project init)
- Day 2-3: EP-00 · ST-002 (dependencies mapping + spike waveform)
- Day 4: EP-00 · ST-003 (API validation)
- Day 5: Buffer + testing

**Week 2:**
- EP-01 (Rebranding: fonts, colors, navigation)
- EP-02 Backend (Vertical system: schema + configs)

**Week 3:**
- EP-02 UI (Vertical selector + dynamic report)
- EP-03 (Recording + Upload native)
- Testing + polish

**Total:** 15 zile lucrătoare

---

## 🎯 Daily Check-in Protocol

**End of day report includes:**
1. Tasks completed today
2. Blockers encountered (if any)
3. Decisions made
4. Tasks for tomorrow
5. Risk updates

---

## 🚨 Risks & Mitigation

**R-001 HIGH: Android recording quirks**
- Mitigation: Test pe device fizic în primele 2 zile
- Status: Not yet tested

**R-002 HIGH: NativeWind v4 setup**
- Mitigation: Alocă 1 zi pentru setup + testing
- Status: Scheduled for Day 2

**R-003 MED: Waveform library compatibility**
- Mitigation: Spike 2 zile → fallback Reanimated 3
- Status: Scheduled for Day 2-3

---

## 📝 Notes

- Expo Go funcțional pe emulator (test basic)
- Design wireframes pentru vertical selector: **Pending delivery pre-EP-02**
- MongoDB backup: va fi executat când există date
- Backend backward compatible: GAL vertical rămâne neschimbat

---

**Last updated:** 2026-04-01 04:05 UTC
**Status:** ✅ EP-00 · ST-001 Complete | 🚧 ST-002 Starting Day 2
