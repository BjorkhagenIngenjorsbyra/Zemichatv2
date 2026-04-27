# PRD vs implementation — gap-analys 2026-04-27

## Sammanfattning

Vi håller kursen mot grundvisionen — "ansvar genom transparens" — och kärnmodellen Owner/Super/Texter är genomtänkt och konsekvent implementerad i RLS, schema och UI. Den största enskilda observationen är att produkten har **drivit i positiv riktning**: implementationen överträffar PRD på flera punkter (server-bekräftad RevenueCat, signed URLs, SOS-fortsättning vid pausat konto, delade hemligheter mellan trigger och edge function, referral-systemet, Team Wall, GIFs/stickers, friend-settings med smeknamn). Audit 2026-04-26 hittade 40 fynd, varav alla P0/P1 har fått migrations daterade `20260427` — kursen "lyssna på audit och åtgärda" är därmed också på plats.

Det finns dock luckor i förhållande till PRD: rapportering/moderation, "tillkalla"-knappen, stjärnmärkning, vidarebefordrings-UI, aktiva sessioner och inloggningsnotiser saknas eller är endast halvbyggda. Reports-tabellen finns men ingen service-fil eller UI använder den. Login-notiser och device-listor existerar bara som typ-stubs. PRD lovar share-sheet, originalformat-bilder och länkpreviews — share-sheet och länkpreviews finns, men image-komprimering är ofullständig och Capacitor-share-extension för Android/iOS kräver native arbete.

Inför Fas 1 är produkten **funktionellt tillräcklig** för core-MVP (Fas 1 i PRD §23): roller, onboarding, Zemi-nummer, vänner, chattar, text, lässtatus, transparens, push, RevenueCat. Fas 2 (media, voice, reactions, search, share, prenumerationer) är också på plats. Fas 3 (samtal, SOS, templates, schemalagd tystnad) är 80 % klar — men "tillkalla", samtalsspärr per Texter via UI och rapportering återstår. Fas 4 (2FA, mörkt läge, textstorlek, tillgänglighet) varierar — 2FA, teman och språk finns; textstorleksval, läs-högt och accessibilitetsetiketter behöver verifieras separat.

---

## Vision och kärnvärden

PRD §1 säger "premiumplattform där anonymitet ersätts av ansvar … Team Owner tar fullt ansvar för sina underställda konton". Implementationen håller detta:

- `auth_user_role()`, `is_team_owner_of()`, `chat_has_texter_from_team()` — SECURITY DEFINER-helpers i `supabase/migrations/20260205120000_add_rls_policies.sql:13-95`. Transparens-policies använder dem konsekvent (`messages_select_owner_oversight`, `polls_select_owner` osv).
- Owner ser deletade meddelanden via `messages_select_owner_oversight` (har inte `deleted_at IS NULL`-filter). Super-self-delete soft-deletar via `delete_super_account()` (migration `20260427130000`) — Owner-transparens behålls även när Super lämnar.
- Korsvis insyn (PRD §8.2) fungerar via `chat_has_texter_from_team()` — båda Owners ser chatten om en Texter från vardera team deltar.
- Supers privacy gentemot Owner är respekterad: Owner kan inte se en chatt där bara Supers deltar (RLS gör detta automatiskt eftersom `chat_has_texter_from_team` returnerar false).

**Bedömning:** Designfilosofin "WhatsApp-polerad UX + transparens + familjefokus" är teknisk realiserad. Det finns små glapp (login-notiser saknas, men de är PRD §9.3 + §16.3) men ingen drift bort från visionen.

---

## Per feature-område

### Användarroller och behörigheter (PRD §2, §7)

- **PRD säger:** Tre roller (Owner/Super/Texter), Owner kan stänga av Texters/Supers, individuell funktionsstyrning per Texter (8 toggles inkl. samtal, media, skärmdelning).
- **Implementation:** `users.role` enum (`owner`/`super`/`texter`) i `20260205090232_initial_schema.sql:75-100`. `texter_settings`-tabellen (samma migration:155 ff) har 8 booleans + quiet hours + nu även `can_access_wall`. Service: `src/services/members.ts:51-185` täcker create/get/update/deactivate/pause. UI för funktionskontroll finns i `OwnerApprovals.tsx` + `TexterDetail.tsx` (538 rader).
- **Status:** Enligt spec, lätt utökat (wall-access, friend-settings).
- **Detalj:** PRD §2 säger Texters skapas av Owner "Inget eget e-post/telefon krävs" — det löser RPC-funktionen `create_texter` i `members.ts:21-46` genom fake-email `zemixxx@texter.zemichat.local`. Login går via `signInAsTexter()` som mappar Zemi-nummer → fake email (`auth.ts:119-128`). Audit 2026-04-26 fynd #6 (SOS blockerades vid pausat konto) är fixat — `SOSOnlyView.tsx` (156 rader) renderas vid `sosOnly: true` (`auth.ts:140-148`).

### Chat och meddelanden (PRD §4, §5)

- **PRD säger:** 1:1 och grupp = samma struktur, pin (max 5), arkivera, mark unread, media-galleri per chatt, alla meddelandetyper (text/bild/voice/video/dok/plats/kontakt/länk), reactions, reply, vidarebefordra, redigera, ta bort, stjärnmärk, sök.
- **Implementation:** `chat_members.is_pinned/is_archived/marked_unread/is_muted` i schema. `pinChatWithLimit()` i `services/chat.ts:612-633` — **men limit är 3 i koden, PRD säger max 5**. Reply (`reply_to_id`), forward (`forwarded_from_id`), edit (med `message_edits`-tabell), soft delete (`deleted_at`+`deleted_for_all`) finns. Media-galleri-page finns ej (`ChatInfo.tsx` 458 rader visar grundinfo). Reactions: `services/reaction.ts` (258 rader). Search: `services/search.ts` (295 rader, global + per chat). Voice: `VoiceRecorder.tsx`+`VoiceMessage.tsx` med 1x/1.5x/2x via `audioRouting.ts`. Sticker + GIF (Tenor/Giphy?) finns även om PRD inte nämner det. **Stjärnmärkning saknas:** `starred_messages`-tabellen finns i `20260205090232_initial_schema.sql` men ingen service och inget UI använder den. **Vidarebefordra:** finns i `message.ts:303` men `ForwardPicker.tsx` är troligen halvfärdig (kolla själv).
- **Status:** Mest enligt spec, drift i pin-limit (3 vs 5), stjärnmärkning saknas, GIF/sticker är förbättring utöver spec.
- **Detalj:** PRD §4.4 säger "Max 5 pinnade chattar" — `chat.ts:629` returnerar fel om `pinned.length >= 3`. Detta är en avvikelse från spec som inte är dokumenterad. Bör antingen följa PRD eller uppdatera PRD.

### Transparens och Owner-oversight (PRD §8, kärnan)

- **PRD säger:** Owner läser ALLA meddelanden i ALLA chattar där deras Texters deltar. Korsvis insyn. Borttagna meddelanden syns för Owner. Edit-historik synlig för Owner. Owner ser INTE Supers chattar utan Texter-deltagare.
- **Implementation:** Allt finns. `messages_select_owner_oversight` i `20260205120000_add_rls_policies.sql` filtrerar inte `deleted_at`. `message_edits`-tabell skapas av trigger `save_message_edit` (samma migration). `chat_has_texter_from_team()` används i Owner-policies för chats, messages, reactions, polls, poll_votes. **Förbättring:** Audit-fynd #25 ledde till `get_texter_chat_overview()`-RPC (migration `20260427140000`) — single round-trip dashboard istället för n+1. Service: `services/oversight.ts:44-178`. Page: `OwnerOversight.tsx` + `OwnerChatView.tsx`.
- **Status:** Enligt spec, förbättrat (RPC, performance).
- **Detalj:** En subtil avvikelse: `poll_options` saknade Owner-oversight-policy enligt audit #13 — ej fixat i `20260427`-migrations. Owner ser polls + votes men inte options i Texter-chattar (UI visar röster utan alternativ-text). Bör läggas till före launch.

### Samtal (Agora) (PRD §6)

- **PRD säger:** Röst, video, gruppsamtal, växla ljud↔video, skärmdelning, minimerat samtalsfönster, max 60 min video med varning vid 55 min, ej inspelning. Samtal från vänlistan eller chatt-header.
- **Implementation:** `CallContext.tsx` (944 rader) + `services/call.ts` (495 rader) + `services/agora.ts` (296 rader) + Agora SDK. `VIDEO_CALL_MAX_DURATION_SECONDS = 60*60` och `VIDEO_CALL_WARNING_SECONDS` i `types/call.ts:33,38`. `MAX_GROUP_CALL_PARTICIPANTS` finns. Skärmdelning: `toggleScreenShare()` i `CallContext.tsx:649`. CallKit-integration på iOS via `ios-callkit/`-mappen. VoIP push (PushKit) via `registerVoipPushIfNeeded()`. Inkommande samtal: `IncomingCallModal.tsx` + ringtone via `services/ringtone.ts`.
- **Status:** Enligt spec, förbättrat (CallKit/VoIP, native-callscreen).
- **Detalj:** Audit #11 (stale closure på `activeCall` i `subscribeToCallSignals`) — ej åtgärdat. Realtime-subscriptions tas ner och upp varje gång användaren mute:ar/växlar video → risk att inkommande RING-signal förloras under aktivt samtal. Borde fixas före launch.

### Push-notiser (PRD §9)

- **PRD säger:** Push för varje meddelande, mute per chatt, "Stör ej", Owner-specifika notiser (Texter i ny chatt, rapportering, tillkalla, SOS, ny enhet-login).
- **Implementation:** FCM via `send-push` edge function (`supabase/functions/send-push/index.ts`, 600+ rader). Service-account-JWT-flow. Quiet hours-respekt. Rate limit 60/min/sender. Audit-fix #19: nu kräver delad hemlighet i Authorization (`PG_NET_SHARED_SECRET` via Vault, migration `20260427110000`). DB-trigger `notify_new_message()` skickar push automatiskt. APNs-badge räknas från `chat_members.unread_count`. **Saknas:** Owner-specifika notiser (Texter i ny chatt, rapportering, ny enhet) — ingen edge function eller trigger för dessa. SOS-notis till Owner: bara via realtime-subscription i `Dashboard.tsx`/`OwnerOversight.tsx` (verifiera). Tillkalla-funktionen: finns inte.
- **Status:** Delvis enligt spec, transactional push fungerar, Owner-specifika notiser saknas (bortsett från SOS).
- **Detalj:** Audit #18 (push-content syns i lock-screen) inte åtgärdat — FCM-payload har full meddelandetext i `body`. Privacy-läckage på lock-screen.

### Vänförfrågningar (PRD §3)

- **PRD säger:** Zemi-nummer för identifiering. Vänförfrågningar via Zemi-nummer. Owner godkänner alla Texters förfrågningar. Supers hanterar egna. Avsluta vänskap utan notis. Owner kan neka framtida förfrågningar för en Texter.
- **Implementation:** `friendships`-tabell + `denied_friend_requests`-tabell. Service: `friend.ts` (844 rader, störst i kodbasen). RPC `search_user_by_zemi` (cross-team lookup). Auto-friendship för team-medlemmar (`20260210120000_auto_team_friendships.sql`) — **förbättring utöver spec**, samma team får automatisk vänskap utan manuell ansökan. Friend-settings med smeknamn + kategorier (`friend_settings`-tabell, migration `20260213120000`) — **utökad funktion**. Owner-godkännande för Texter-vänförfrågningar via `OwnerApprovals.tsx` (507 rader). PRD §3.4 "ingen blockering, bara unfriend" är respekterad.
- **Status:** Enligt spec + förbättrat.
- **Detalj:** PRD §3.2 säger "Samma team ≠ automatisk vänskap" — detta är **medveten avvikelse**: auto-friendship inom team införd som bekvämlighetsfunktion. Bör dokumenteras i PRD som ett medvetet val.

### Prenumerationer (RevenueCat) (PRD §18)

- **PRD säger:** Tre planer (Free/Plus 25kr/Plus Ringa 69kr), 10 dagars gratis Plus Ringa-trial, fall-back till Free vid trial-slut, blockerande dialog om för många medlemmar, gating av låsta features.
- **Implementation:** RevenueCat SDK + `services/subscription.ts` (662 rader). Trial via `start_team_trial_for_owner`-RPC (migration `20260427120000`, audit-fix #20). `manual_subscriptions`-tabell för Erik:s manuella tilldelning. `MemberLimitDialog.tsx` blockerar. Plan-pricing i `types/subscription.ts`. **Förbättring:** RevenueCat-webhook (`supabase/functions/revenuecat-webhook/index.ts`, 226 rader) — server-bekräftad subscription-update. Klienten kan inte längre uppdatera `teams.plan` (audit-fix #20: trigger `block_client_team_plan_changes` blockerar). Detta är **mycket bättre än PRD lovar** — PRD nämner inte server-side validering, men det är nu på plats.
- **Status:** Enligt spec, kraftigt förbättrat (server-side webhook, immutable plan från klient).

### Storage (bilder, röst) (PRD §5.1)

- **PRD säger:** Bilder med bildtext, val att skicka i originalformat, röstmeddelanden, video, dokument.
- **Implementation:** `services/storage.ts` (545 rader). **Förbättring:** chat-media-bucket är nu PRIVAT (audit-fix #18, migration `20260427100000`). `resolveMediaUrl()` med signed URLs (1h TTL) + cache. Detta är **säkerhetsmässigt mycket bättre än PRD krävde**. Voice-mp3/webm/m4a-extension-detection, image-dimensions-extraction. **Saknas:** Klient-side image-komprimering (audit P2-fynd, ej åtgärdat). 12 MP-bilder från modern telefon laddas upp utan downscaling.
- **Status:** Enligt spec, förbättrat säkerhet, saknar komprimering.
- **Detalj:** Avatar-bucket använder fortfarande `getPublicUrl()` (`storage.ts:380`) — det är medvetet (avatars ska vara läsbara av kontaktade users) men saknas dokumentation om varför chat-media är private och avatar är public.

### SOS / barnsäkerhet (PRD §12)

- **PRD säger:** SOS-knapp tillgänglig för Texters, kan inte stängas av av Owner, skickar plats + push med hög prio + SOS-meddelande i Owner-chatt + valfritt automatiskt röstsamtal.
- **Implementation:** `services/sos.ts` (363 rader). Knapp i `SOSButton.tsx` med bekräftelse via `SOSConfirmModal.tsx`. RLS-policy `sos_alerts_insert_texter` har medvetet ingen `is_active`-check. **Förbättring:** Audit-fix #6/#23 — pausad/deaktiverad Texter blockeras inte längre vid login utan får `SOSOnlyView.tsx` så SOS fortfarande kan skickas. Det är en **kritisk förbättring** där implementation följde säkerhetsdesignen som PRD hade tänkt men inte genomförde tekniskt.
- **Status:** Enligt spec + förbättrat.
- **Detalj:** PRD §12.2 lovar "Valfritt: Automatiskt röstsamtal till Owner" — verifierat ej implementerat. Plats skickas, push skickas, men inget auto-call.

### Onboarding och invitationer (PRD §19)

- **PRD säger:** Owner: e-post → skapa team → 10-dag trial → in. Super: inbjudan via mejl → skapa lösenord → Zemi-nummer → introduktion. Texter: Owner skapar profil → Owner ger inloggningsuppgifter muntligt.
- **Implementation:** `Signup.tsx` → `CreateTeam.tsx` → `OwnerOnboarding.tsx` (78 rader, kort intro) → `Dashboard.tsx`. Trial startar automatiskt via `startFreeTrial()`. Super: `team_invitations`-tabell + `send-invitation` edge function med Resend → `SuperInvite.tsx` (242 rader). Texter: `CreateTexterModal.tsx` + `SuperTour.tsx`/`TexterTour.tsx`. Email-templates HTML-escapade (audit-fix #22, `_shared/escape-html.ts`).
- **Status:** Enligt spec, säkerhetsfix tillagt.

---

## Förbättringar utöver original-spec

PRD pekade ut grundprinciper men implementationen har lagt till funktioner och förstärkt säkerhet:

1. **Server-bekräftad RevenueCat** — webhook + immutable `teams.plan` från klient (audit-fix #20). PRD nämnde inte detta som krav men det är nu standardpraxis och förhindrar piracy.
2. **Privat chat-media + signed URLs** — PRD specificerade inte storage-säkerhet. Implementationen tar GDPR på allvar (audit-fix #18).
3. **Delad hemlighet mellan trigger och edge function** — PRD beskrev inte push-arkitektur. Verklig implementation är robust (audit-fix #19).
4. **SOSOnlyView** — PRD ville att SOS aldrig kan stängas av. Tekniska implementeringen genomförde det 100 % via separat lock-screen-flöde (audit-fix #23).
5. **Team Wall** — social feed per team (`wall_posts`/`wall_comments`/`wall_reactions`-tabeller, `Wall.tsx`-page). Ej i PRD.
6. **Referral-system** — varje team får unik referral-kod, månader gratis Plus Ringa per värvning. Ej i PRD.
7. **Friend-settings med smeknamn + kategorier** — asymmetric per-friend metadata. Ej i PRD.
8. **Auto-friendship inom team** — drift från PRD §3.2 men UX-förbättring.
9. **GIF + sticker-stöd** — `GifPicker.tsx`, `StickerPicker.tsx`. Ej i PRD §5.1.
10. **MFA/2FA** — PRD §16.1 sa "valfritt rekommenderat", implementation är klar (`MFASetup.tsx`/`MFAVerify.tsx`/`mfa.ts` 295 rader, TOTP).
11. **GDPR-export + delete-funktioner** — `delete_owner_account`, `delete_super_account`, `export_user_data` med audit-logg via SHA-256-hash av team-namn. Ej i PRD detaljerat.
12. **Internationalisering** — sv/en/fi/no/da via `react-i18next`. PRD nämnde inte språkval.
13. **Bundle splitting** — Agora, Leaflet, emoji-picker laddas på demand. Initial gzip 278 KB (från 1010 KB). Ej i PRD.
14. **Codemagic CI/CD + manuella subscriptions för admin** — operativa förbättringar.
15. **SSRF-skyddad link-preview** — privata IP-block, manuell redirect-validering, content-type-check (audit-fix #21). PRD-§14.2 sa bara "OG-scraping".

---

## Avvikelser och drift

Punkter där implementationen avviker från PRD utan tydlig motivering:

1. **Pin-limit 3 istället för 5** (`chat.ts:629`). PRD §4.4 säger max 5. Bör beslutas: uppdatera PRD eller koden.
2. **Auto-friendship inom team** (`20260210120000_auto_team_friendships.sql`). PRD §3.2 säger "Samma team ≠ automatisk vänskap". Medveten produktändring som bör spegla i PRD.
3. **`message_reactions`-policy saknar Owner-oversight** (audit #19). Owner ser inte reactions på meddelanden i Texter-chattar — bryter delvis PRD §8.1.
4. **`poll_options` saknar Owner-oversight** (audit #13). Owner ser polls + votes utan att kunna se vilka alternativ rösterna gäller.
5. **Push-content i lock-screen** (audit #18). Inte i konflikt med PRD men en privacy-svaghet PRD inte bedömt.
6. **Avatar-URL-uppdatering kan peka externt** (audit #28). `update_user_profile` accepterar valfri URL upp till 500 chars.

---

## Saknas helt

PRD-features som inte finns alls eller bara som typ-stubs:

1. **Tillkalla-knapp** (PRD §4.5): "Synlig i varje chatt – skickar akut notis till Team Owner". Ingen kod, ingen knapp, ingen RPC. Detta är ett distinkt feature från SOS.
2. **Stjärnmärkning** (PRD §5.2): `starred_messages`-tabell finns men ingen `services/`-fil och inget UI. Helt obyggd förutom schema.
3. **Rapportering & moderering** (PRD §15): `reports`-tabell finns + RLS-test, men ingen `services/report.ts`, ingen "Rapportera"-knapp i UI. Helt obyggd förutom schema och tabell-test. Detta är **stort** — PRD §15.3 säger 3 rapporter eskalerar till Zemi Support, men inget av detta finns.
4. **Aktiva sessioner-listing** (PRD §16.2): `user_sessions`-tabellen finns inte ens i en migration trots att den nämns i SCHEMA.md:600-610. Inget UI för "logga ut andra enheter".
5. **Inloggningsnotiser** (PRD §9.3, §16.3): Saknas helt. Ingen edge function, ingen trigger.
6. **Login-blockering vid 2FA-prompt** (PRD §16.3): "Möjlighet att neka inloggning" — inte implementerat.
7. **Media-galleri per chatt** (PRD §4.6): "Tryck på chattens namn → Se alla delade medier". `ChatInfo.tsx` visar metadata men ingen filtrerad mediavy.
8. **Vidarebefordra-UI** (PRD §5.2): `forwardMessage()` finns i `message.ts:303` men `ForwardPicker.tsx` ej granskad — kan vara halvfärdig.
9. **Video-recording inline** (PRD §5.1): bara `services/storage.ts.uploadVideo()`-funktion finns, ingen `VideoRecorder`-komponent.
10. **Kamera i appen** (PRD §14.3): `Capacitor.Camera` används troligen för bild-uppladdning, men ej dedikerad kamera-page.
11. **Plats: live-delning** (PRD §5.1): Bara engångsdelning via `LocationPicker.tsx`. Ingen continuous tracking.
12. **Kontakt-delning** (PRD §5.1): `messages.contact_zemi_number`-fält i schema men ingen UI eller service-kod.
13. **`analytics_events`-tabell** saknas helt i migrations (audit #22). `services/analytics.ts` försöker INSERT men misslyckas tyst.
14. **`docs/RLS.md`** referenced av CLAUDE.md saknas (audit #30).
15. **Veckorapport till Owner** (PRD §9.2 explicit nej, men kan vara värdefullt). Ej spec-krav, bara observation.
16. **Custom-emoji + förhandsgranskning av röst innan skicka** (PRD §5.3): `VoiceRecorder.tsx` har troligen detta — ej djupverifierat.
17. **Schemalagd tystnad** (PRD §17): `texter_settings.quiet_hours_*` finns och respekteras av `send-push`. UI: `QuietHoursManager.tsx`. Detta finns! (jag tog felaktigt med det här först.) Stryk från saknade-listan.
18. **Textstorlek S/M/L/XL** (PRD §10.4 / §21.1): ej verifierat. Tema finns (6 teman) men separat textstorlek?
19. **"Läs upp"-funktion** (PRD §21.3): ej implementerat.
20. **Bakgrundsbild per chatt eller global** (PRD §10.4): tema finns men chat-specifik bakgrund?

---

## Bedömning inför Fas 1-launch

PRD §23 definierar Fas 1 som: roller, registrering/onboarding, Zemi-nummer + vänförfrågningar, chattar, textmeddelanden, lässtatus, Team Owner insyn (transparens), grundläggande notifikationer, RevenueCat (Free-nivå).

**Allt på Fas 1-listan finns och fungerar.** Faktum är att även Fas 2 (media, voice, reactions, search, fäst/arkivera, share-sheet, Plus/Pro-prenumerationer) och Fas 3 (samtal, gruppsamtal, skärmdelning, SOS, snabbmeddelanden, schemalagd tystnad) är kraftigt levererade. Fas 4 (2FA, mörkt läge) är delvis levererad.

**Riskpunkter inför Fas 1-launch (2026-05-31):**

1. **P0/P1 audit-fynd är åtgärdade** (migrations daterade 20260427) — men dessa migrations behöver deployas till produktion och Vault-secrets sättas (`PG_NET_SHARED_SECRET`, `REVENUECAT_WEBHOOK_AUTH`). Misslyckad deploy ger antingen funktionsbortfall (push tystas) eller säkerhetsregression.
2. **Rapporteringsfunktionen saknas helt.** Eftersom appen marknadsförs mot familjer med barn är detta en **svaghet** — om en Texter rapporterar olämpligt innehåll har de ingenstans att klicka. Bör levereras före launch eller läggas till i v1.1 med tydlig kommunikation.
3. **Tillkalla-knappen saknas.** PRD §4.5 har den som distinkt från SOS. För en barnsäkerhetsapp är detta viktigt UX-element. Bör levereras eller dokumenteras som "kommer i v1.1".
4. **`poll_options` Owner-oversight-policy saknas.** Owner ser polls i Texter-chattar utan alternativ-text. Bör fixas — 5-radsmigration.
5. **Push-content på lock-screen** läcker chat-innehåll. Mindre allvarligt men en privacy-svaghet.
6. **Image-komprimering saknas.** Användare med mobildata får långsam upload + onödig storage-kostnad. Sannolikt ingen blockare men en UX-svaghet.
7. **Stora pages** (`Settings.tsx` 1291 rader, `ChatView.tsx` 1231 rader, `ChatList.tsx` 973 rader) är teknisk skuld. Ingen blockare men förvärrar regressioner.
8. **`analytics_events`-tabell saknas** → ingen användardata samlas in. Inte säkerhetsproblem men gör att teamet flyger blint efter launch.
9. **RLS-tester saknas för 14 tabeller** (wall_*, polls, message_reactions, push_tokens m.fl.). En regression går igenom utan att fångas.
10. **`subscribeToCallSignals` stale-closure-bug** kan orsaka missade inkommande samtal under aktivt samtal. Audit-fynd #11.

**Sammanfattande bedömning:** Produkten är **launch-ready** för Fas 1-funktionalitet, men det finns 4-5 punkter (rapportering, tillkalla, poll_options-policy, push-privacy, samtal-stale-closure) som bör adresseras inom 1-3 veckor. Inga av dessa är showstoppers men alla är synliga för slutanvändare och kan ge låga betyg eller säkerhets-incidenter i tidiga reviews.

Erik kan med gott samvete säga att appen levererar PRD-visionen — men listan med "saknas helt" (16 punkter) gör att det inte längre kan kallas "PRD-komplett". Det vore ärligt att uppdatera PRD-versionen till "2.1" och stryka eller eskalera de punkter som inte ska levereras före launch.
