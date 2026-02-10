# iOS Build & TestFlight – Setup Guide

## GitHub Secrets som behövs

Lägg till dessa under **Settings > Secrets and variables > Actions** i GitHub-repot.

### Signing secrets

| Secret | Beskrivning |
|---|---|
| `APPLE_CERTIFICATE_P12` | Base64-kodat distribution-certifikat (.p12) |
| `APPLE_CERTIFICATE_PASSWORD` | Lösenordet du satte vid p12-exporten |
| `APPLE_PROVISIONING_PROFILE` | Base64-kodad provisioning profile (.mobileprovision) |
| `APPLE_TEAM_ID` | Ditt Apple Developer Team ID (10 tecken, t.ex. `A1B2C3D4E5`) |
| `PROVISIONING_PROFILE_NAME` | Namnet på profilen exakt som i Apple Developer Portal |

### App Store Connect API

| Secret | Beskrivning |
|---|---|
| `ASC_KEY_ID` | API Key ID (10 tecken, t.ex. `ABC1234DEF`) |
| `ASC_ISSUER_ID` | Issuer ID (UUID-format) |
| `ASC_API_KEY_P8` | Innehållet i .p8-filen (inkl. `-----BEGIN PRIVATE KEY-----`) |

### Env-variabler (redan konfigurerade lokalt)

| Secret | Beskrivning |
|---|---|
| `VITE_SUPABASE_URL` | Supabase projekt-URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_AGORA_APP_ID` | Agora App ID |
| `VITE_GIPHY_API_KEY` | Giphy API key |
| `VITE_REVENUECAT_IOS_KEY` | RevenueCat iOS API key |
| `VITE_REVENUECAT_ANDROID_KEY` | RevenueCat Android API key |

---

## Steg 1: Skapa Apple Distribution Certificate

### 1.1 Generera Certificate Signing Request (CSR)

På din Mac:

```bash
# Öppna Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority
# Eller via terminal:
openssl req -new -newkey rsa:2048 -nodes \
  -keyout zemichat_dist.key \
  -out zemichat_dist.csr \
  -subj "/emailAddress=erik@bjorkhagen.se/CN=Zemichat Distribution/C=SE"
```

### 1.2 Skapa certifikatet i Apple Developer Portal

1. Gå till [Apple Developer – Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Klicka **"+"** (Create a New Certificate)
3. Välj **"Apple Distribution"** (fungerar för både App Store och Ad Hoc)
4. Klicka **Continue**
5. Ladda upp din CSR-fil (`zemichat_dist.csr`)
6. Klicka **Continue** och sedan **Download** (`distribution.cer`)

### 1.3 Exportera som .p12

```bash
# Konvertera .cer till .pem
openssl x509 -inform DER -in distribution.cer -out distribution.pem

# Skapa .p12 (du blir ombedd att sätta ett lösenord)
openssl pkcs12 -export \
  -inkey zemichat_dist.key \
  -in distribution.pem \
  -out zemichat_dist.p12 \
  -name "Zemichat Distribution"
```

**Alternativt via Keychain Access:**
1. Dubbelklicka `distribution.cer` — det installeras i Keychain
2. Högerklicka certifikatet i Keychain Access > **Export**
3. Välj .p12-format och sätt ett lösenord

### 1.4 Base64-koda och lägg i GitHub

```bash
# Koda certifikatet
base64 -i zemichat_dist.p12 | pbcopy
# Klistra in som APPLE_CERTIFICATE_P12 i GitHub Secrets

# Lösenordet du valde → APPLE_CERTIFICATE_PASSWORD
```

---

## Steg 2: Skapa Provisioning Profile

### 2.1 Registrera App ID

1. Gå till [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Klicka **"+"** > **App IDs** > **App**
3. Fyll i:
   - **Description:** `Zemichat`
   - **Bundle ID (Explicit):** `com.zemichat.app`
4. Aktivera capabilities:
   - **Push Notifications**
   - **Associated Domains** (om du använder universal links)
   - **In-App Purchase** (för RevenueCat)
5. Klicka **Continue** > **Register**

### 2.2 Skapa Provisioning Profile

1. Gå till [Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Klicka **"+"**
3. Välj **"App Store Connect"** (under Distribution)
4. Klicka **Continue**
5. Välj App ID: **com.zemichat.app**
6. Välj ditt distribution-certifikat (skapat i Steg 1)
7. Namnge profilen: `Zemichat AppStore Distribution`
8. Klicka **Generate** > **Download** (`Zemichat_AppStore_Distribution.mobileprovision`)

### 2.3 Base64-koda och lägg i GitHub

```bash
base64 -i Zemichat_AppStore_Distribution.mobileprovision | pbcopy
# Klistra in som APPLE_PROVISIONING_PROFILE i GitHub Secrets

# Profilnamnet "Zemichat AppStore Distribution" → PROVISIONING_PROFILE_NAME
```

---

## Steg 3: Skapa App Store Connect API Key

### 3.1 Skapa nyckeln

1. Gå till [App Store Connect – Users and Access – Integrations – App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. Klicka **"+"** (Generate API Key)
3. **Name:** `Zemichat CI`
4. **Access:** `App Manager` (minst — behövs för TestFlight-upload)
5. Klicka **Generate**
6. **Ladda ner .p8-filen** (kan bara laddas ner EN gång!)
7. Notera:
   - **Key ID** (visas i listan)
   - **Issuer ID** (visas högst upp på sidan)

### 3.2 Lägg i GitHub Secrets

```bash
# Key ID (10 tecken) → ASC_KEY_ID
# Issuer ID (UUID) → ASC_ISSUER_ID

# Innehållet i .p8-filen → ASC_API_KEY_P8
cat AuthKey_XXXXXXXXXX.p8 | pbcopy
```

---

## Steg 4: Hitta ditt Team ID

1. Gå till [Apple Developer – Membership](https://developer.apple.com/account#MembershipDetailsCard)
2. Kopiera **Team ID** (10 tecken)
3. Lägg in som `APPLE_TEAM_ID` i GitHub Secrets

---

## Verifiera setup

Kör workflowen manuellt:

1. Gå till **Actions** i GitHub-repot
2. Välj **"iOS Build & TestFlight"**
3. Klicka **"Run workflow"** > **"Run workflow"**

### Vanliga fel

| Fel | Lösning |
|---|---|
| `No signing certificate "iOS Distribution" found` | `APPLE_CERTIFICATE_P12` är fel eller lösenordet matchar inte |
| `No provisioning profile matching` | Bundle ID i profilen matchar inte `com.zemichat.app` |
| `Unable to authenticate with App Store Connect` | Kontrollera att ASC_KEY_ID, ASC_ISSUER_ID och ASC_API_KEY_P8 stämmer |
| `pod install` fails | Kör `npx cap add ios` lokalt först och pusha `ios/` mappen |

### Första gången

iOS-projektet genereras automatiskt av workflowen via `npx cap add ios`. Men det rekommenderas att köra detta lokalt en gång först för att verifiera att allt fungerar:

```bash
npx cap add ios
npx cap sync ios
cd ios/App && pod install
```

Pusha sedan `ios/`-mappen till repot så slipper CI generera den varje gång.
