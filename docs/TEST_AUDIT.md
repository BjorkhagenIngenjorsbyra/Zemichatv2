# Zemichat E2E Test Audit

> Genererad: 2026-02-11
> Totalt antal E2E-tester: **307**
> Testfiler: 5 st (`comprehensive.spec.ts`, `roles-interactions.spec.ts`, `chat-functions.spec.ts`, `advanced-integration.spec.ts`, `app.spec.ts`)

---

## Sammanfattning

| Kategori | Antal | Andel |
|----------|-------|-------|
| **AVANCERAD** (full E2E, multi-user, DB-verifiering) | 14 | 4.6% |
| **MEDEL** (interaktion + verifiering, men fallbacks/svag assertion) | 101 | 32.9% |
| **YTLIG** (element finns / sida laddar / grundsel.) | 192 | 62.5% |

### Per testfil

| Fil | Totalt | AVANCERAD | MEDEL | YTLIG |
|-----|--------|-----------|-------|-------|
| `comprehensive.spec.ts` | 150 | 6 | 72 | 72 |
| `roles-interactions.spec.ts` | 65 | 1 | 17 | 47 |
| `chat-functions.spec.ts` | 55 | 9 | 17 | 29 |
| `advanced-integration.spec.ts` | 10 | 5 | 4 | 1 |
| `app.spec.ts` | 27 | 0 | 8 | 19 |

---

## 1. AVANCERADE tester (14 st)

Dessa tester kör riktiga flöden mellan flera användare, verifierar data i databas, och har inga fallbacks.

| # | Fil | Test | Vad den testar |
|---|-----|------|----------------|
| 1 | advanced-integration | T01 – Owner stänger av bildskickning | Owner togglar `can_send_images` OFF, Texter ser permission-toast. i18n-verifiering i 5 språk. |
| 2 | advanced-integration | T05 – SOS-larm med GPS | Texter skickar SOS med geolokation -> DB-verifiering med location -> Owner ser alert-card -> Acknowledge -> DB uppdaterad |
| 3 | advanced-integration | T08 – Deaktiverad Texter blockeras | Owner deaktiverar -> login misslyckas -> reaktivering -> login lyckas. DB-verifiering av `is_active`. |
| 4 | advanced-integration | T09 – Raderat meddelande synligt för Owner | Texter skickar + raderar meddelande -> DB visar `deleted_at` -> Owner ser innehållet via oversight (transparens). |
| 5 | advanced-integration | T10 – Text, bild, GIF, poll | Owner skickar text+bild, Texter verifierar+svarar, GIF i gruppchatt, poll i gruppchatt. Multi-context. |
| 6 | comprehensive | C04 – Skicka textmeddelande (Owner) | Skickar unikt meddelande, väntar på att det dyker upp i chatten. |
| 7 | comprehensive | C12 – Enter skickar meddelande | Skriver text, trycker Enter, verifierar meddelande visas. |
| 8 | comprehensive | C13 – Input töms efter skickning | Skickar meddelande via Enter, verifierar input-fält tomt. |
| 9 | comprehensive | H04 – Texter skickar meddelande | Texter-auth, öppnar chatt, skickar unikt meddelande, väntar. |
| 10 | comprehensive | I03 – Super skickar meddelande | Super-auth, öppnar chatt, skickar unikt meddelande, väntar. |
| 11 | chat-functions | T05 – Skicka flera meddelanden i rad | Skickar 2 meddelanden, verifierar antal ökade. |
| 12 | chat-functions | T07 – Auto-scroll till senaste | Skickar meddelande, verifierar auto-scroll. |
| 13 | chat-functions | T12 – Preview i chattlistan | Skickar meddelande, går tillbaka, verifierar `.last-message` visar skickat meddelande. |
| 14 | chat-functions | T14 – Specialtecken renderar korrekt | Skickar meddelande med `<>&"'`, verifierar rendering. |

---

## 2. MEDEL-tester (101 st)

Dessa tester navigerar och interagerar, men har ofta fallback-logik, svaga assertions, eller testar inte hela flödet.

### comprehensive.spec.ts (59 MEDEL)

| # | Test | Svaghet |
|---|------|---------|
| 1 | A07 – Felaktigt lösenord | Verifierar `.auth-error` synlig men inte felmeddelandets text |
| 2 | A08 – Korrekt login | Verifierar redirect till `/chats` |
| 3 | A09 – Ny ägare redirect | Skippar om auth-fil saknas |
| 4 | B04 – Ny chatt-knapp nav | Klickar FAB, väntar på `/new-chat` |
| 5 | B14 – Settings profilinfo | Kontrollerar ZEMI-nummer i profil-kort |
| 6 | B17 – Språkbyte engelska | Klickar English, verifierar engelsk text i body |
| 7 | C01 – Öppna chatt | Öppnar chatt, kollar messages-container ELLER input |
| 8 | C03 – Send-knapp vid text | Skriver text, kollar send-button synlig |
| 9 | C07 – Högerställt meddelande | Kollar justify-content: flex-end på egna meddelanden |
| 10 | C08 – Vänsterställt meddelande | Kollar justify-content: flex-start på andras |
| 11 | C10 – Header titel | Kollar header har text (inte tomt) |
| 12 | D04 – Zemi-nummer på vänkort | Kollar `.friend-zemi` innehåller "ZEMI-" |
| 13 | D06 – Add friend nav | Klickar FAB, väntar på `/add-friend` |
| 14 | D14 – Klick till texter-detalj | Klickar texter-item, väntar på `/texter/` |
| 15 | E03 – Nav till /settings | Navigerar, kollar URL + profil-card |
| 16 | E05 – Tillbaka från chatt | Öppnar chatt, klickar back, väntar på `/chats` |
| 17-31 | F01–F15 – i18n raw keys | 15 tester som kollar att inga råa i18n-nycklar syns per språk/sida |
| 32 | G05 – Inga JS-konsolfel | Filtrerar console.error (ignorerar favicon/net/Capacitor) |
| 33 | G07 – Avatar-placeholder | Kollar placeholder-text matchar `[A-Z?]` |
| 34 | G10 – Responsiv 375px | Sätter viewport, kollar container-bredd ≤375 |
| 35 | H03 – Texter öppnar chatt | Öppnar chatt, kollar message-input synlig |
| 36 | H06 – Texter ej Dashboard | Kollar dashboard-link count === 0 |
| 37 | H07 – Texter ej Delete Account | Kollar danger-card count === 0 |
| 38 | H09 – Texter profil-info | Kollar profile-card + "ZEMI-" |
| 39 | H11 – Texter ej team-sektion | Kollar team-section count === 0 |
| 40 | H12 – Texter ny chatt nav | Klickar FAB, väntar på `/new-chat` |
| 41 | I02 – Super öppnar chatt | Öppnar chatt, kollar message-input |
| 42 | I04 – Super ej Dashboard | Kollar dashboard-link count === 0 |
| 43 | I05 – Super Delete Account | Kollar danger-card synlig |
| 44 | I06 – Super profil-info | Kollar profile-card + "ZEMI-" |
| 45 | I08 – Super ej team-sektion | Kollar team-section count === 0 |
| 46 | I09 – Super ej SOS | Kollar SOS-knapp count === 0 |
| 47-48 | I11–I12 – Super i18n | Kollar råa nycklar per språk/sida |
| 49 | J01 – Knappar har label | Loopar 10 knappar, kollar text/aria-label/icon |
| 50 | J02 – Sidan laddar <5s | Mäter laddtid (egentligen 15s timeout) |
| 51 | J03 – Settings-formulär | Kollar profile-card + language-grid + ≥5 options |
| 52 | J04 – Inga broken images | Kollar naturalWidth > 0 på alla bilder |
| 53 | J10 – Inga duplicerade ID | evaluate() letar duplicerade DOM-ID |

### roles-interactions.spec.ts (17 MEDEL)

| # | Test | Svaghet |
|---|------|---------|
| 1 | K05 – Owner öppnar oversight-chatt | Klickar chatt, verifierar message-bubbles |
| 2 | K07 – Texter-detalj via dashboard | Navigerar till `/texter/{id}`, kollar container |
| 3 | K08 – Profilkort i texter-detalj | Kollar profile-card + namn |
| 4 | K09 – Zemi-nummer i detalj | Kollar `.profile-zemi` har "ZEMI-" |
| 5 | K10 – Kapabilitetstogglingar | Kollar ≥5 ion-toggle i toggle-list |
| 6 | K15 – Quiet Hours text | Söker text "quiet/tysta/lugn" i content |
| 7 | L06 – Super i team-sektion | Kollar role-badges "super"/"texter" |
| 8 | L08 – Dashboard → invite-super | Klickar 4:e action-item (fragilt index!) |
| 9 | L09 – Dashboard → oversight | Klickar 3:e action-item |
| 10 | L10 – Dashboard → approvals | Klickar 1:a action-item |
| 11 | M09 – Quick-message-bar | Kollar `.quick-message-bar` count ≥0 (alltid pass!) |
| 12 | O01–O03 – Roller ser chattar | Kollar ≥1 .chat-item per roll |
| 13 | O06 – Ej radera andras | Right-click, kollar delete-knapp |
| 14 | O08 – Oversight filter | Klickar segment, kollar chats ≥0 |
| 15 | O09 – Texter profilinfo | Kollar profile-card + "Texter" |
| 16 | O10 – Super profilinfo | Kollar profile-card + "Super" |
| 17 | P04 – Dashboard → texter-detalj | Klickar member-item med "texter" text |

### chat-functions.spec.ts (17 MEDEL)

| # | Test | Svaghet |
|---|------|---------|
| 1 | Q04 – Ogiltigt Zemi-nummer | Fyller "INVALID", kollar felmeddelande ELLER stannar kvar |
| 2 | Q05 – Redan-vän sökning | Söker seed-data, kollar resultat/status/ZEMI |
| 3 | Q08 – Back-knapp navigerar | Friends → add-friend → back → friends |
| 4 | R04 – Kontakt öppnar chatt | Klickar contact-item, väntar på `/chat/` |
| 5 | R06 – Sökning filtrerar | Söker "zzzznotexist", kollar count minskar |
| 6 | R09 – FAB → new-chat | Klickar FAB, väntar på `/new-chat` |
| 7 | S02 – FAQ-sektion | Kollar accordion med ≥3 items |
| 8 | S03 – FAQ expanderar | Klickar accordion, kollar .faq-answer |
| 9 | S05 – Feedback typ-val | Klickar typ-pill, kollar `.active` |
| 10 | S09 – Kontaktsektion | Regex: kontakt/contact/email |
| 11 | T01 – Meddelanden per tid | Kollar flera `.message-time` labels |
| 12 | T02 – Eget meddelande färg | Kollar `.message-bubble.own` bakgrund ej transparent |
| 13 | T03 – Andras meddelande färg | Kollar `.message-bubble.other` bakgrund |
| 14 | T04 – Bubbla padding | Kollar non-zero padding |
| 15 | T06 – Send-knapp dold utan text | Kollar send-knapp ej synlig |
| 16 | T08 – Header kontaktnamn | Kollar header har text |
| 17 | T09/T10 – GIF/Sticker picker | Klickar knapp, väntar på picker |

### advanced-integration.spec.ts (4 MEDEL)

| # | Test | Svaghet |
|---|------|---------|
| 1 | T02 – Friend request approval | Godkänner via knapp-click + DB-check, men UI-verifieingen kunde vara starkare |
| 2 | T03 – Tysta timmar toggle | Togglar ON, kollar dagknappar + DB, men verifierar inte att tysta timmar faktiskt blockerar |
| 3 | T04 – Quick messages | Skapar 3 meddelanden + Texter använder dem, viss fallback-logik |
| 4 | T07 – Oversight read-only | Verifierar oversight-sida + read-only, alternativa selektorer |

### app.spec.ts (8 MEDEL)

| # | Test | Svaghet |
|---|------|---------|
| 1 | Signup validation (kort lösenord) | Fyller kort lösenord, kollar `.auth-error` |
| 2 | Signup validation (mismatch) | Fyller olika lösenord, kollar `.auth-error` |
| 3 | Svenska locale aktiveras | Sätter localStorage, kollar "Logga in" |
| 4 | Engelska locale aktiveras | Sätter localStorage, kollar "Log in" |
| 5 | Alla 5 locales har kritiska nycklar | Evaluerar i18n-store, kollar 15 nycklar × 5 språk |
| 6 | quickMessages.suggestions array | Evaluerar i18n-store, kollar array × 5 språk |
| 7 | Login ↔ Signup navigation | Klickar signup-länk, verifierar landing |
| 8 | Login ↔ Texter login navigation | Klickar texter-login-länk, verifierar landing |

---

## 3. YTLIGA tester (192 st)

Tester som bara kollar att ett element finns, en sida laddar, eller en URL matchar. Ger minimal confidence.

### Vanligaste mönster i ytliga tester

| Mönster | Antal | Exempel |
|---------|-------|---------|
| `element.toBeVisible()` utan interaktion | ~80 | "B06 – Dashboard nås" kollar bara att testid finns |
| `locator.count() > 0` / `>= 0` | ~35 | "P05 – Dashboard refresher" kollar `count >= 0` (alltid true!) |
| URL-check efter navigation | ~25 | "E02 – Nav till /friends" navigerar + kollar URL |
| Element har text-content | ~20 | "B15 – Settings dashboard-länk" kollar element synligt |
| CSS-property check | ~15 | "G01 – Dark mode kontrast" kollar bakgrundsfärg |
| Räknar element (count ≥ N) | ~17 | "A02 – Signup-formulär" kollar ≥4 inputs |

### Tester med meningslösa assertions (alltid true)

| Test | Fil | Problem |
|------|-----|---------|
| O07 – Alla roller navigation footer | roles-interactions | `ion-content.count() >= 1` (alltid sant) |
| N01 – Super ej dashboard actions | roles-interactions | Kollar bara body.toBeTruthy() |
| M04 – Texter kan inte skapa inbjudan | roles-interactions | Kollar bara URL truthy |
| P05 – Dashboard refresher | roles-interactions | `count >= 0` (alltid sant) |
| M09 – Quick-message-bar | roles-interactions | `count >= 0` (alltid sant) |
| H05 – Texter SOS-knapp | comprehensive | `count >= 0` (alltid sant) |
| H13 – Texter SOS i chatt | comprehensive | `count >= 0` (alltid sant) |
| G08 – Skeleton loaders | comprehensive | `count >= 0` (alltid sant) |

---

## 4. Saknad testning (Gap Analysis)

Baserat på app-kartläggning av alla 30 sidor och 50+ komponenter finns följande luckor:

### Helt otestat

| Område | Sidor/funktioner |
|--------|-----------------|
| **Signup-flöde** | Komplett registrering (fylla i + skicka + verifiering) |
| **Create Team** | `/create-team` formulär + team skapas i DB |
| **Choose Plan** | `/choose-plan` planval + trial-aktivering |
| **Email Verification** | `/verify-email` sida + resend-funktion |
| **MFA Setup** | `/mfa-setup` QR-kod + verifiering |
| **MFA Verify** | `/mfa-verify` login med 2FA |
| **Invite Super** | Komplett inbjudningsflöde (skicka + registration via `/invite/:token`) |
| **Super Registration** | `/invite/:token` formulär + konto skapas |
| **Onboarding Tours** | `/owner-onboarding`, `/super-tour`, `/texter-tour` |
| **Samtal (Calls)** | Voice/video-samtal initiera + acceptera + avsluta |
| **Voice Messages** | Spela in + spela upp röstmeddelande |
| **Location Sharing** | Dela plats i chatt |
| **Document Sharing** | Ladda upp + ladda ner dokument |
| **Message Editing** | Redigera skickat meddelande |
| **Message Forwarding** | Vidarebefordra meddelande till annan chatt |
| **Emoji Reactions** | Reagera med emoji på meddelande |
| **Chat Swipe Actions** | Pin/unpin, mute, archive, mark unread |
| **Chat Search** | Sök i chatt (sökmodal i chattvy) |
| **Group Chat** | Skapa gruppchatt, lägg till/ta bort deltagare |
| **Typing Indicators** | Realtidsindikator när någon skriver |
| **Read Receipts** | Läskvittenser (✓✓ blå) |
| **Subscription/Paywall** | Trial-banner, paywall-modal, plan-uppgradering |
| **Export Data** | Klicka export → ladda ner JSON |
| **Delete Account** | Komplett radering med bekräftelsetext |
| **Push Notifications** | FCM-registrering + notifikation visas |
| **Offline Mode** | Beteende utan nätverksanslutning |
| **Deep Linking** | Öppna app via URL |
| **Pull-to-refresh** | Faktisk datahämtning (inte bara element-check) |
| **Long Press Context** | Alla long-press menyer (chattlista + meddelanden) |
| **Create Texter Modal** | Dashboard → skapa Texter → lösenord/zemi genereras |
| **Mute Options** | Tystningsalternativ (1h/8h/alltid) |
| **Error Handling** | Nätverksfel, serverfel, timeout-beteende |
| **Loading States** | Skeleton loaders faktiskt försvinner |

### Delvis testat (behöver uppgradering)

| Område | Nuvarande | Saknas |
|--------|-----------|--------|
| **SOS** | T05 testar skicka+acknowledge | SOS utan GPS, SOS med felaktig position, SOS-historik |
| **Friend Requests** | T02 testar godkänna | Avvisa request, avbryta request, blockera |
| **Oversight** | T07+T09 testar läsning | Filtrera per texter, sök i oversight, raderade meddelanden |
| **Quick Messages** | T04 testar skapa+använda | Redigera, ta bort, ordning, max antal |
| **Quiet Hours** | T03 testar toggle | Verifiering att meddelanden blockeras under tysta timmar |
| **Login** | A07-A08 testar fel+rätt login | MFA-login, session-expiry, remember-me |
| **Texter Login** | A11 testar fel Zemi | Framgångsrik Texter-login E2E, deaktiverat konto |
| **Språk** | F01-F15 kollar rånycklar | Att faktisk text ändras, att alla sidor har översättningar |
| **Dark Mode** | G01-G02 kollar bakgrund | Alla komponenter i dark mode, toggle-funktion |

---

## 5. Rekommenderade NYA avancerade tester

### Prioritet 1: Kärnfunktionalitet (10 tester)

| # | Test | Beskrivning |
|---|------|-------------|
| 1 | **Komplett signup → create-team → choose-plan** | Ny användare registrerar sig, skapar team, väljer plan. Verifierar konto + team + plan i DB. |
| 2 | **Owner skapar Texter via dashboard** | Öppnar Create Texter-modal, fyller i namn, sparar. Verifierar Texter-konto i DB med genererat Zemi-nummer. Loggar in som Texter. |
| 3 | **Komplett Invite Super-flöde** | Owner bjuder in Super via email → Super registrerar via invite-link → Super loggar in → ser chattlista. |
| 4 | **Texter → Super meddelande synligt för Owner** | Texter skickar meddelande till Super → Owner verifierar meddelande i oversight. |
| 5 | **Super → Super privat (Owner ser EJ)** | Två Supers chattar → Owner verifierar att chatten INTE syns i oversight. |
| 6 | **Friend request: skicka → Owner godkänner → chatt skapas** | Texter1 (team A) skickar request till Texter2 (team B) → Owner1 godkänner → Texter1 ser Texter2 i kontakter → öppnar chatt. |
| 7 | **Emoji-reaktion synlig för mottagare** | User A reagerar med emoji → User B ser reaktion under meddelande. |
| 8 | **Redigera meddelande synligt för mottagare** | User A redigerar → User B ser "(redigerat)" markering + nytt innehåll. |
| 9 | **Voice message inspelning + uppspelning** | Texter spelar in röstmeddelande → Owner ser waveform i oversight. |
| 10 | **Group chat: skapa + meddelande synligt för alla** | Owner skapar grupp med Texter+Super → skickar meddelande → alla ser det. |

### Prioritet 2: Säkerhet & Transparens (8 tester)

| # | Test | Beskrivning |
|---|------|-------------|
| 11 | **Texter kan inte kringgå kapabilitetstoggling** | Texter med images=OFF kan inte skicka bild även via manuellt API-anrop. |
| 12 | **Quiet hours blockerar notifikationer** | Meddelande under tysta timmar → notifikation visas EJ. |
| 13 | **Raderat meddelande i gruppchatt** | User raderar meddelande i grupp → andra ser "(borttaget)" → Owner ser originaltext. |
| 14 | **Deaktiverad Texter: alla chattar kvar** | Owner deaktiverar → Texters chattar fortfarande synliga i oversight. |
| 15 | **Super kan inte se oversight** | Super försöker navigera till `/oversight` → blockeras/redirectas. |
| 16 | **Owner approved_by verifiering** | Vid friend-request godkännande: `approved_by` sätts till Owner's ID i DB. |
| 17 | **Session timeout / token expiry** | Token löper ut → användare redirectas till login. |
| 18 | **MFA-login flöde** | Aktivera MFA → logga ut → logga in → MFA-verifiering krävs. |

### Prioritet 3: UX & Edge Cases (7 tester)

| # | Test | Beskrivning |
|---|------|-------------|
| 19 | **Pull-to-refresh laddar ny data** | Skicka meddelande via API → pull-to-refresh → meddelande visas. |
| 20 | **Chat swipe: pin + mute** | Svep chatt → pin → verifierar pinned section → svep → mute → verifierar ikon. |
| 21 | **Export data laddar ner JSON** | Klicka export → verifiera nedladdad fil finns med korrekt data. |
| 22 | **Delete account komplett flöde** | Super fyller i bekräftelsetext → klicka radera → konto borttaget → redirect login. |
| 23 | **Onboarding tour komplett** | Ny Owner: /welcome → slides → signup → create-team → choose-plan → /chats. |
| 24 | **Meddelande med lång text + emoji + länk** | Skicka meddelande med 500+ tecken, emoji, och URL → verifierar rendering + link-preview. |
| 25 | **Offline → online transition** | Stäng av nätverk → skicka meddelande (queued) → sätt på nätverk → meddelande levereras. |

---

## 6. Uppgraderingsplan för ytliga tester

### Snabbaste vinster (YTLIG → MEDEL med minimal insats)

| Test | Nuvarande | Föreslagen uppgradering |
|------|-----------|------------------------|
| B06 – Dashboard nås | Kollar testid | + Verifiera team-namn visas + ≥1 member |
| D01 – Vänner-sida | Kollar ion-segment | + Verifiera ≥1 vän ELLER request synlig |
| H01 – Texter chattlista | Kollar chat-items | + Verifiera chatt-namn + last-message |
| I01 – Super chattlista | Kollar chat-items | + Verifiera chatt-namn + last-message |
| K01 – Oversight chattlista | Kollar items/empty | + Verifiera texter-badge på chatten |
| A06 – Login-formulär | Kollar 2 inputs | + Fylla i felaktig data → verifiera error |
| A10 – Texter-login | Kollar 2 inputs | + Fylla i felaktig data → verifiera error |

### Tester att ta bort (meningslösa)

| Test | Anledning |
|------|-----------|
| O07 – Alla roller navigation footer | `ion-content.count() >= 1` alltid sant |
| P05 – Dashboard refresher | `count >= 0` alltid sant |
| M09 – Quick-message-bar count | `count >= 0` alltid sant |
| G08 – Skeleton loaders | `count >= 0` alltid sant |

---

## 7. Slutsats & Rekommendation

### Nuvarande status
- **62.5% ytliga tester** ger en falsk känsla av säkerhet
- **4.6% avancerade tester** testar verklig funktionalitet
- Kärnflöden som signup, team-skapande, inbjudningar, samtal, och subscription saknas helt
- 8 tester har assertions som alltid är true (`count >= 0`, `body.toBeTruthy()`)

### Rekommendation
1. **Prioritera de 10 Prioritet 1-testerna** ovan - de täcker kärnflödet
2. **Ta bort 4 meningslösa tester** (O07, P05, M09, G08)
3. **Uppgradera 7 ytliga tester** med minimal insats (se ovan)
4. **Mål:** Nå 15% AVANCERAD, 45% MEDEL, 40% YTLIG (från 4.6%/32.9%/62.5%)
5. **Uppskattning:** 25 nya/uppgraderade tester behövs för att nå en rimlig testtäckning av alla kritiska flöden
