# Zemichat

Familje-chattapp med transparensmodell. Team Owners har insyn i sina Texters kommunikation — ansvar genom transparens.

## Tech Stack

| Lager | Teknik |
|-------|--------|
| Frontend | Ionic + Capacitor (React 19, TypeScript) |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Storage) |
| Samtal | Agora SDK |
| Betalningar | RevenueCat |
| Push | Firebase Cloud Messaging / APNs |
| CI/CD | Codemagic (auto-trigger vid push till master) |
| Hosting (web) | Vercel |

## Kom igang

### Forutsattningar

- Node.js 22+ (CI kör 22, lokalt fungerar 24)
- npm
- Supabase CLI (`npm install -g supabase`)
- Android Studio (för Android-byggen)
- Xcode (för iOS-byggen, kräver macOS)

### 1. Klona och installera

```bash
git clone https://github.com/BjorkhagenIngenjorsbyra/Zemichatv2.git
cd Zemichatv2
npm install
```

### 2. Miljövariabler

Kopiera `.env.example` till `.env` och fyll i värdena:

```bash
cp .env.example .env
```

| Variabel | Beskrivning |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase-projektets URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_GIPHY_API_KEY` | Giphy API-nyckel (GIF-sökning) |
| `VITE_AGORA_APP_ID` | Agora App ID (röst-/videosamtal) |
| `VITE_REVENUECAT_ANDROID_KEY` | RevenueCat Android API-nyckel |
| `VITE_REVENUECAT_IOS_KEY` | RevenueCat iOS API-nyckel |

Kontakta Erik för produktionsvärden.

### 3. Starta utvecklingsservern

```bash
npm run dev
```

Öppna http://localhost:5173 i webbläsaren (Chrome med mobilvy rekommenderas).

### 4. Bygga för mobil

```bash
# Bygga webbappen
npm run build

# Synka till nativa projekt
npx cap sync

# Öppna i Android Studio
npx cap open android

# Öppna i Xcode (macOS)
npx cap open ios
```

## Projektstruktur

```
src/
  components/     Återanvändbara UI-komponenter
  contexts/       React context providers
  hooks/          Custom React hooks
  i18n/           Internationalisering (sv, en, da, fi, no)
  pages/          Ionic-sidor (routes)
  services/       API-anrop, Supabase-klient
  stores/         State management
  types/          TypeScript-definitioner
  utils/          Hjälpfunktioner
  tests/          Tester

supabase/
  migrations/     Databasmigreringar
  functions/      Edge Functions (push-notiser m.m.)

docs/
  PRD.md          Produktspecifikation
  SCHEMA.md       Databasschema
  DESIGN.md       Designriktlinjer
```

## Roller

Appen har tre roller med olika behörighetsnivåer:

- **Team Owner** — Full insyn i Texters chattar. Godkänner vänförfrågningar. Kan stänga av funktioner.
- **Super** — Har privacy från Owner (så länge ingen Texter deltar). Hanterar egna vänförfrågningar.
- **Texter** — Owner ser allt. Vänförfrågningar kräver Owner-godkännande.

Se [PRD.md](./docs/PRD.md) för fullständig specifikation.

## Tester

```bash
# Unit-tester
npm run test.unit

# E2E-tester (Playwright)
npm run test.e2e:pw

# RLS-tester (kräver lokal Supabase)
npm run test.rls
```

## CI/CD

Codemagic bygger automatiskt vid push till `master`:
- **iOS** — Bygger IPA, laddar upp till App Store Connect (TestFlight)
- **Android** — Bygger AAB, laddar upp till Google Play Console

Konfiguration finns i `codemagic.yaml`.

## Git-workflow

```bash
# Branch-namn
feature/mitt-feature
fix/min-buggfix

# Commit-format
feat(chat): add swipe-to-reply gesture
fix(call): improve error diagnostics
test(e2e): add automated setup script
```

Se [CLAUDE.md](./CLAUDE.md) för fullständig kodstandard och utvecklingsprinciper.

## Dokumentation

| Dokument | Innehåll |
|----------|----------|
| [CLAUDE.md](./CLAUDE.md) | Kodstandard, arbetsflöde, utvecklingsprinciper |
| [docs/PRD.md](./docs/PRD.md) | Produktspecifikation |
| [docs/SCHEMA.md](./docs/SCHEMA.md) | Databasschema |
| [docs/DESIGN.md](./docs/DESIGN.md) | Designriktlinjer |
| [docs/IOS_BUILD_SETUP.md](./docs/IOS_BUILD_SETUP.md) | iOS-bygginstruktioner |
| [docs/FIREBASE_SETUP.md](./docs/FIREBASE_SETUP.md) | Firebase/push-setup |

## Kontakt

- **Erik Holmgren** — Bolag, försäljning, arkitektur (erik@ingenjorsbyran.com)
- **Victor Engvall** — Apputveckling (victor@engvalls.nu)
