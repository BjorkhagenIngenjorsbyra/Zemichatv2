# 2026-06-13-1: Server-side enforcement av deltagartaket för gruppsamtal

*Architecture Decision Record (ADR).*

## Status

`Accepterad`

## Kontext

Ett samtals Agora-kanalnamn ÄR chattens id (`channelName = chatId` i `agora-token`
edge-funktionen). Varje aktiv medlem i chatten kan därför hämta en join-token och gå in i
kanalen. Klienten förkontrollerar detta i `CallContext.initiateCall` mot
`MAX_GROUP_CALL_PARTICIPANTS` (= 6, `src/types/call.ts`, Agoras gratis-tier-tak), men den
kontrollen är **enbart klientsidig**. En modifierad klient kan hoppa över den, gå med i en
överstor kanal och spränga det tier-tak som taket finns för att skydda (Fable kod-genomlysning,
fynd #4/6).

Detta är fynd #4 av de 6 server-bristerna Erik godkände. Till skillnad från #1 (wall-RLS) och
#2 (medlemsgräns, trigger) kan #4 inte lösas med en tabell-trigger eller en ren RLS-policy:
det finns ingen `call_participants`-tabell (Agora äger samtalskanalen, inga DB-rader skapas).
Taket måste sättas vid den enda punkt en modifierad klient inte kan kringgå — när join-token
utfärdas.

## Övervägda alternativ

### Alt 1: Agora REST API — räkna kanalens användare vid token-utfärdande

- För: Använder Agoras verkliga uppkopplingsläge (sann källa för vem som faktiskt är inne).
- Mot: Kräver nya hemligheter (Customer ID/Secret), extern beroende-latens + felläge, samt
  Agoras eventual-consistency-fördröjning. Ny driftytan att övervaka.
- Insats: Medel; mest rörliga delar.

### Alt 2: Presence-tabell (`call_participants`) med heartbeat + TTL

- För: Självständig, server är sanningskälla.
- Mot: Helt nytt presence-subsystem (join/leave-events, heartbeat, reconciliation av
  inaktuella rader om en klient kraschar). Stor yta för en gräns på 6.
- Insats: Stor.

### Alt 3: Räkna chattens aktiva medlemmar vid token-utfärdande (vald)

- För: Kanalen = chatten, så max antal samtidiga deltagare = antal aktiva chattmedlemmar.
  Speglar EXAKT klientens befintliga kontroll (`1 + otherMembers.length > 6`). Deterministiskt,
  ingen presence-staleness, inga nya hemligheter, ingen extern beroende. Samma mönster som #2
  (räkna medlemmar server-side).
- Mot: Cappar chattens medlemsantal-för-just-denna-kanal, inte live-närvaro — men det är just
  det som skyddar Agora-taket (≤6 medlemmar ⇒ ≤6 i kanalen).
- Insats: Liten — en SECURITY DEFINER-funktion + ett anrop i edge-funktionen.

## Beslut

Alt 3. `public.chat_call_within_capacity(chat_id)` (SECURITY DEFINER, stable) returnerar
`count(distinct user_id) <= 6` över `chat_members` där `left_at is null`. `agora-token`
edge-funktionen anropar den (som `service_role`) direkt efter medlemskapskontrollen och
returnerar 403 "Call group is full" om kanalen är full — ingen join-token utfärdas. Klienten
mappar serverfelet till den befintliga i18n-nyckeln `call.groupFull` (som dessutom saknades i
alla locale-filer — latent bugg, åtgärdad i samma ändring).

Funktionen låses till `service_role` (revoke från public/anon/authenticated), annars kunde
vilken inloggad användare som helst sondera godtyckliga chattars medlemsantal via en
SECURITY DEFINER-funktion.

## Konsekvenser

### Positiva

- Taket går inte längre att kringgå med en modifierad klient; Agora-gratis-taket skyddas.
- Mirror av klientkontrollen ⇒ samma beteende, inga nya magiska tal i flödet (6 finns i TS för
  UX-förkontroll och i SQL för säkerhetsgrinden — kommenterat på båda ställen att hålla i synk).
- `call.groupFull` visas nu lokaliserat istället för rå nyckel.

### Negativa / risker

- Talet 6 är duplicerat (TS + SQL). Avsiktligt; kommentar på båda håll. Ändras taket måste båda
  uppdateras.
- Funktionen räknar medlemskap, inte live-närvaro — en chatt med ≤6 medlemmar där alla 6 ringer
  är inom taket, vilket är korrekt mot Agora-gränsen.

### Vad som är inlåst

Grinden sitter i edge-funktionen (enda token-utfärdaren). Inför vi någon dag äkta ad-hoc-samtal
med deltagare utanför chatten krävs en riktig presence-modell (Alt 1/2) istället.

## Implementation

- `supabase/migrations/20260613100000_enforce_call_participant_cap.sql` (funktion + grants)
- `supabase/functions/agora-token/index.ts` (anropar funktionen, 403 vid fullt)
- `src/contexts/CallContext.tsx` (`mapCallError`: "group is full" → `call.groupFull`)
- `src/i18n/locales/*.json` (lägg till saknad `call.groupFull` i 5 språk)
- `src/tests/rls/call-capacity.rls.test.ts` (regressionstest: 6 ok, 7 blockeras, left_at, grants)
- `docs/SCHEMA.md`

## Referenser

- Fable kod-genomlysning r3 (`tests/explore/runs/code-review-r3.md`), fynd #4/6.
- Föregående server-fynd samma rond: #1 wall-RLS (`20260612120000`), #2 medlemsgräns
  (`20260612130000`).
