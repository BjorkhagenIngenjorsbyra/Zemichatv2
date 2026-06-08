# 2026-06-08-1: Namn-ögonblicksbild på chat_members

*Architecture Decision Record (ADR).*

## Status

`Accepterad`

## Kontext

En 1-on-1-chatt kan överleva relationen som gjorde motpartens profil synlig. RLS på
`users` exponerar bara egna teammedlemmar och accepterade vänner (`users_select_team` /
`users_select_friends`). När man avvänjer en vän raderas vänskapsraden men chatten finns
kvar (transparens-/bevismodellen behåller meddelandena). Då kan klienten inte längre läsa
motpartens namn → chatthuvudet visade "Utan namn" och oversight kraschade på en null-user.

Erik (produktägare) vill att man ska kunna avsluta en dålig relation snabbt, men att det
ska finnas kvar **bevis på vem barnet pratade med** ("Tidigare kontakt (Namn)") för att
t.ex. kunna ta upp det med den andra familjen — utan att lätta på säkerhetsreglerna.

## Övervägda alternativ

### Alt 1: Lätta på users-RLS så chatt-medlemmar ser varandras profil

- För: Enkel; namnet alltid live.
- Mot: Vidgar insynen i barns kontaktuppgifter generellt; rör produktens integritetskärna.
- Insats: Liten kod, stor principiell förändring.

### Alt 2: UX-fallback utan namn ("Tidigare kontakt")

- För: Noll datamodell-ändring; säkrast.
- Mot: Tappar beviset på *vem* — det Erik specifikt ville ha kvar.
- Insats: Minimal.

### Alt 3: Namn-ögonblicksbild på chat_members (vald)

- För: Bevarar namnet som bevis utan att röra users-RLS (snapshotet ligger på en rad
  medlemmen alltid får läsa); fryser vid senast kända namn när synligheten upphör.
- Mot: Denormalisering; kan bli inaktuellt om namnet ändras efter att synligheten brutits.
- Insats: En migration (kolumn + två triggers + backfill) + läs-väg i chatthuvudet.

## Beslut

Alt 3. Lägg `chat_members.display_name` som en ögonblicksbild. En BEFORE INSERT-trigger
fångar namnet när medlemskapet skapas; en AFTER UPDATE-trigger på `users.display_name`
håller det aktuellt så länge namnet är synligt. Chatthuvudet visar live-namnet när profilen
syns, annars snapshotet som "Tidigare kontakt (Namn)", annars enbart "Tidigare kontakt".

## Konsekvenser

### Positiva

- Bevis på vem man pratade med finns kvar efter avvänjning, utan RLS-lättnad.
- Chattlistan (DEFINER-RPC) och chatthuvudet blir konsekventa för synliga kontakter.

### Negativa / risker

- Snapshotet kan vara inaktuellt om motparten byter namn efter att synligheten brutits —
  acceptabelt eftersom "namnet vid tillfället" är rätt bevis-semantik.
- Ny denormaliserad kolumn att hålla i minnet vid framtida namn-/medlemslogik.

### Vad som är inlåst

Triggers populerar kolumnen; tas de bort slutar nya rader fyllas. Omvärdera om vi inför
en separat per-meddelande-avsändarsnapshot (starkare bevis per meddelande) — då kan
medlems-snapshotet bli redundant.

## Implementation

- `supabase/migrations/20260608130000_chat_member_name_snapshot.sql`
- `src/types/database.ts` (`ChatMember.display_name`)
- `src/pages/ChatView.tsx` (`getChatDisplayName` fallback)
- `src/i18n/locales/*.json` (`chat.formerContact`, `chat.formerContactNamed`)
- `src/tests/rls/helpers/global-setup.ts` (seed populerar snapshot; triggers av i replica)
- `tests/e2e/two-user-former-contact-name.spec.ts` (regressionstest)
- `docs/SCHEMA.md`

## Referenser

- Föregående fix samma rond: `fix(oversight)` (null-user-krasch) — samma RLS-null-mönster.
