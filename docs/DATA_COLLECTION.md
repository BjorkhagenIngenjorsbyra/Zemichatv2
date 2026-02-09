# Zemichat – Dataspecifikation (GDPR)

Detta dokument beskriver all persondata som Zemichat samlar in, lagrar och bearbetar.

## Sammanfattning

Zemichat är en familjevänlig chattapp med transparensmodell. All data lagras i Supabase (EU-region). Ingen data säljs till tredje part.

---

## Data per tabell

| Tabell | Data | Syfte | Lagringstid | Rättslig grund |
|--------|------|-------|-------------|----------------|
| `users` | Profil: display_name, avatar_url, status_message, last_seen_at, zemi_number, role, is_active | Identifiering & appfunktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `teams` | Teamnamn, plan, trial_ends_at | Gruppering av familjemedlemmar | Tills konto raderas | Avtal (art. 6.1b) |
| `texter_settings` | Behörighetsinställningar (bilder, röst, video, plats, samtal), tysta timmar | Föräldrakontroll | Tills konto raderas | Berättigat intresse/Samtycke (art. 6.1f/a) |
| `friendships` | Vänrelationer (vem frågade vem, status, godkännare) | Social funktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `denied_friend_requests` | Blockerade vänförfrågningar per Texter | Föräldrakontroll | Tills konto raderas | Berättigat intresse (art. 6.1f) |
| `chats` | Chattnamn, beskrivning, avatar, gruppflagga | Chattfunktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `chat_members` | Medlemskap, mute/pin/arkiv-status, olästa räknare, senast läst | Chattfunktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `messages` | Meddelandeinnehåll, mediaURL, plats, kontakt, redigerings-/raderingsstatus | Kärnfunktionalitet (chatt) | Tills konto raderas (soft delete vid radering) | Avtal (art. 6.1b) |
| `message_edits` | Redigeringshistorik (gammalt innehåll) | Transparens (Owner kan se ändringar) | Tills konto raderas | Berättigat intresse (art. 6.1f) |
| `message_reactions` | Emoji-reaktioner per meddelande | Social funktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `starred_messages` | Stjärnmärkta meddelanden | Användarfunktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `message_read_receipts` | Läskvitton (vem läste vad, när) | Chattfunktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `quick_messages` | Snabbmeddelanden (fördefinierade svar) | Användarfunktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `reports` | Rapporter om användare/meddelanden | Säkerhet & moderering | Tills konto raderas | Berättigat intresse (art. 6.1f) |
| `sos_alerts` | SOS-larm med plats | Barnsäkerhet | Tills konto raderas | Berättigat intresse (art. 6.1f) |
| `call_logs` | Samtalsloggar (typ, status, varaktighet) | Samtalsfunktionalitet | Tills konto raderas | Avtal (art. 6.1b) |
| `call_signals` | Temporära samtalssignaler (ring, avböj) | Realtidssamtal | Kort (utgår automatiskt) | Avtal (art. 6.1b) |
| `push_tokens` | Push-tokens (device token, plattform) | Pushnotiser | Tills konto raderas | Samtycke (art. 6.1a) |
| `user_sessions` | Sessioner (enhetsnamn, IP-adress, senast aktiv) | Sessionshantering | Tills konto raderas | Avtal (art. 6.1b) |
| `manual_subscriptions` | Manuella prenumerationer (plan, utgångsdatum, anledning) | Prenumerationshantering | Tills konto raderas | Avtal (art. 6.1b) |
| `account_deletion_log` | Anonymiserad radering: SHA-256-hash av teamnamn, antal medlemmar, typ | Juridisk spårbarhet | Permanent (anonymiserad) | Berättigat intresse (art. 6.1f) |

---

## Mediafiler (Supabase Storage)

| Typ | Exempel | Syfte | Lagringstid |
|-----|---------|-------|-------------|
| Profilbilder | avatar_url | Identifiering | Tills konto raderas |
| Chattmedia | Bilder, video, röstmeddelanden, dokument | Meddelandeinnehåll | Tills konto raderas |

Mediafiler raderas vid kontoradering (hard delete från Storage).

---

## Tredjeparter

| Tjänst | Data som delas | Syfte | Persistent? |
|--------|---------------|-------|-------------|
| **Supabase** (EU) | All data (databas + storage + auth) | Hosting & infrastruktur | Ja (tills radering) |
| **Agora** | Ljud-/videoström (ej inspelat) | Röst- och videosamtal | Nej (realtid) |
| **RevenueCat** | Anonymiserat köp-ID, plan | Prenumerationshantering | Ja (oberoende) |
| **Firebase Cloud Messaging** | Push-token, enhets-ID | Pushnotiser (Android) | Ja (tills avregistrering) |
| **Apple Push Notification Service** | Push-token, enhets-ID | Pushnotiser (iOS) | Ja (tills avregistrering) |

---

## Användarrättigheter (GDPR)

### Rätt till tillgång (art. 15)
Alla användare kan exportera sin data via **Inställningar > Ladda ner min data**. Funktionen `export_user_data()` returnerar all persondata som JSON.

### Rätt till radering (art. 17)
Team Owners kan radera hela teamet via **Inställningar > Radera konto**. Detta:
- Tar bort alla `auth.users`-poster (CASCADE raderar all relaterad data)
- Tar bort alla mediafiler från Storage
- Loggar en anonymiserad post i `account_deletion_log`

### Rätt till dataportabilitet (art. 20)
Data exporteras som strukturerad JSON, maskinläsbar och i ett vanligt format.

### Barndata (art. 8)
Zemichat hanterar barns data under föräldrakontroll. Team Owner (förälder/vårdnadshavare) har full insyn och kontroll, inklusive:
- Godkännande av vänförfrågningar
- Inställning av behörigheter
- Radering av hela teamet

---

## Dataflöde vid kontoradering

1. Användaren (Owner) skriver "RADERA" som bekräftelse
2. `delete_owner_account()` anropas (SECURITY DEFINER)
3. Verifierar att anroparen är Owner
4. Sparar anonymiserad loggpost (SHA-256-hash av teamnamn)
5. Raderar alla mediafiler i Storage
6. Raderar alla `auth.users`-poster (teammedlemmar först, sedan Owner)
7. CASCADE-regler i databasen raderar automatiskt all relaterad data
8. Användaren loggas ut och skickas till inloggningssidan
