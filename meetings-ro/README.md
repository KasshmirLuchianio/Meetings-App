# Meetings.ro - Mobile App (Expo)

> Aplicație mobile cross-platform pentru transcriere automată și raportare AI a întâlnirilor profesionale.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app pe telefon (iOS/Android)

### Installation

```bash
cd /app/meetings-ro
npm install

# Start development server
npx expo start
```

Scanează QR code cu:
- **iOS:** Camera app
- **Android:** Expo Go app

---

## 📱 Tech Stack

**Frontend:**
- Expo SDK 54 (managed workflow)
- React Native 0.81
- Expo Router v6 (file-based routing)
- TypeScript (strict mode)
- NativeWind v4 (Tailwind pentru RN) - Coming in Day 2

**Backend:**
- FastAPI (Python)
- MongoDB
- OpenAI Whisper (transcription)
- Anthropic Claude 3.5 Sonnet (AI extraction)

---

## 🎨 Design Tokens

**Brand Colors:**
- Ivory: `#FAF8F3` (background)
- Navy: `#1B2A4A` (primary)
- Gold: `#B8962E` (accent)

**Typography:**
- Heading: Playfair Display (coming)
- Body: DM Sans 16sp minimum (45-50+ demographic)

**Touch Targets:**
- iOS: 44pt minimum
- Android: 56dp optimal

---

## 📂 Project Structure

```
/app/meetings-ro/
├── app/                    # Expo Router (file-based routing)
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Home screen
│   ├── browse.tsx         # Browse meetings (coming)
│   ├── calendar.tsx       # Calendar view (coming)
│   └── meeting/[id].tsx   # Meeting detail (coming)
│
├── src/
│   ├── components/        # Reusable components
│   ├── screens/           # Full screens (if not using file-based routing)
│   ├── services/          # API calls, storage
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript interfaces
│   ├── constants/         # Theme, config
│   └── utils/             # Helper functions
│
├── assets/                # Images, fonts
├── app.json               # Expo configuration
└── MIGRATION_PLAN.md      # Development roadmap
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` file:

```bash
EXPO_PUBLIC_API_URL=https://gal-transcribe.preview.emergentagent.com
```

### iOS Permissions (app.json)

```json
"NSMicrophoneUsageDescription": "Meetings.ro necesită acces la microfon pentru a înregistra întâlnirile.",
"UIBackgroundModes": ["audio"]
```

### Android Permissions

```json
"permissions": [
  "RECORD_AUDIO",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE"
]
```

---

## 📋 Development Roadmap

### ✅ EP-00: Migration Foundation (Week 1)
- [x] Expo project init (SDK 54)
- [x] TypeScript + ESLint configured
- [x] Design tokens defined
- [x] Backend CORS updated
- [ ] Dependencies mapping (Day 2-3)
- [ ] API contract validation (Day 4)

### 🚧 EP-01: Rebranding (Week 2)
- [ ] NativeWind v4 setup
- [ ] Playfair Display + DM Sans fonts
- [ ] Navigation bar native
- [ ] String replacement (GAL → Meetings.ro)

### 📝 EP-02: Vertical Engine (Week 2-3)
- [ ] MongoDB schema extension
- [ ] Vertical configs (GAL, Journalism, Legal, Banking)
- [ ] Dynamic report view
- [ ] Vertical selector UI

### 🎙️ EP-03: Features Migrate (Week 3)
- [ ] Recording cu expo-av
- [ ] Waveform cu react-native-audiowaveform
- [ ] Upload cu progress bar
- [ ] Audio playback cu HTTP 206

---

## 🧪 Testing

### Run on Physical Device

```bash
# iOS (requires macOS)
npx expo run:ios

# Android
npx expo run:android

# Or use Expo Go for quick testing
npx expo start
```

### Device Requirements
- **iOS:** 13.0+ (iPhone 8 or newer recommended)
- **Android:** 8.0+ (API 26+)

---

## 🚨 Known Issues & Risks

**R-001 HIGH:** Android recording quirks
- **Mitigation:** Test pe Samsung Galaxy + Pixel în primele 2 zile

**R-002 HIGH:** NativeWind v4 breaking changes
- **Mitigation:** 1 zi setup + documentation study

**R-003 MED:** Waveform library compatibility
- **Spike:** 2 zile testing react-native-audiowaveform
- **Fallback:** Custom implementation cu Reanimated 3

---

## 📝 Daily Check-ins

**Protocol:**
1. Tasks completed
2. Blockers encountered
3. Decisions made
4. Next day tasks
5. Risk updates

**Current Status:** Day 1 ✅ Complete | Day 2 🚧 Starting

---

## 📚 Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [NativeWind v4](https://nativewind.dev/v4)
- [React Native](https://reactnative.dev/)
- [Migration Plan](./MIGRATION_PLAN.md)

---

## 🤝 Contributing

**Git Workflow:**

```bash
main (production)
├── develop (staging)
    ├── feature/ep-00-migration-foundation
    ├── feature/ep-01-rebranding
    ├── feature/ep-02-vertical-engine
    └── feature/ep-03-features-migrate
```

**Commit Convention:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Testing
- `chore:` Tooling, dependencies

---

## 📄 License

Proprietary - Meetings.ro © 2026

---

**Last updated:** 2026-04-01
**Version:** 1.0.0-alpha
**Status:** 🚧 In Development (Day 1/15)
