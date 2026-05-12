# 2026-05-12-1: ON DELETE-policy på FKs mot users/teams/chats

## Status

`Accepterad`

## Kontext

Issue #41: vid försök att radera ett team + dess users via Supabase Admin
API (`DELETE auth.users`) failar anropet med 11 olika FK-violations
(SQLSTATE 23503). Resultatet är att alla "radera mitt konto"-flöden i
klienten kraschar, och vi måste städa manuellt i SQL för varje radering.

Grundorsaken: 11 FKs skapades utan `ON DELETE`-policy, så Postgres
default `NO ACTION` blockerar parent-DELETE när det finns kvarvarande
child-rader.

Vi måste välja en konsekvent strategi för **varje** FK: ska child-raden
försvinna med parent (`CASCADE`) eller överleva med tappad referens
(`SET NULL`)?

## Övervägda alternativ

### Alt 1: CASCADE överallt

- För: enklast att resonera kring; en DELETE auth.users städar allt.
- Mot: meddelandehistorik och samtalsloggar försvinner helt när en user
  raderas. För Owner-transparensmodellen är detta direkt skadligt — en
  Texter som raderas kunde retroaktivt "rensa" hela sin chatthistorik
  från Owner's vy.
- Insats: liten.

### Alt 2: SET NULL överallt

- För: ingen data försvinner, allt blir auditbart.
- Mot: join-tabeller (chat_members, message_reactions, push_tokens,
  texter_settings) blir orphaned rader utan mening. push_tokens utan
  user blir aktivt skadligt — vi skulle skicka push till "ingen".
- Insats: liten.

### Alt 3: Hybrid per FK (valt)

- För: respekterar respektive radens semantik. Join-tabeller och
  per-user-state cascades; historik (meddelanden, samtalsloggar,
  enkäter) bevaras med null-referens.
- Mot: kräver att klienten hanterar null-referenser i UI (visar
  "Borttagen användare" i bubblor, etc.). Måste dokumenteras tydligt.
- Insats: medel — 11 ALTER TABLE plus klient-hardening.

## Beslut

Alt 3 — hybrid per FK. Policy per kolumn:

| FK                              | Policy     |
| ------------------------------- | ---------- |
| `poll_votes.user_id`            | CASCADE    |
| `polls.creator_id`              | SET NULL   |
| `message_reactions.user_id`     | CASCADE    |
| `message_read_receipts.user_id` | CASCADE    |
| `messages.sender_id`            | SET NULL   |
| `chat_members.user_id`          | CASCADE    |
| `push_tokens.user_id`           | CASCADE    |
| `texter_settings.user_id`       | CASCADE    |
| `call_logs.chat_id`             | CASCADE    |
| `call_logs.initiator_id`        | SET NULL   |
| `chats.created_by`              | SET NULL   |

Tre kolumner får dessutom `DROP NOT NULL` så `SET NULL` är legalt:
`messages.sender_id`, `call_logs.initiator_id`, `chats.created_by`.
Plus `polls.creator_id` som var `NOT NULL`.

## Konsekvenser

### Positiva

- "Radera mitt konto"-flödet fungerar utan FK-violations.
- Owner-transparensmodellen bevarad: meddelanden och samtalsloggar
  försvinner inte när en Texter raderas — bara avsändaren blir null.
- Per-user-state (notifikations-tokens, läskvitton, reaktioner) städas
  automatiskt utan kvarvarande spöken.

### Negativa / risker

- Klienten måste rendera `sender = null` korrekt. Idag kraschar
  sannolikt rendering om sender är null — uppföljs i separat issue
  innan en faktisk user-deletion körs i prod.
- RLS-policies som filtrerar på `created_by` eller `sender_id` måste
  granskas — de måste tåla `IS NULL`.
- En raderad Owner får sin team-cascade automatiskt (initial schema:
  `teams.owner_id` ON DELETE CASCADE → users ON DELETE CASCADE). Vi
  rör inte den policyn här.

### Vad som är inlåst

- Att meddelanden bevaras med null-sender är en transparens-
  mekanism. Om vi senare beslutar att "radera mitt konto = total
  GDPR-rensning" måste vi vända till CASCADE — det ändrar produktens
  trygghetsmodell och kräver explicit produktbeslut.

## Implementation

- `supabase/migrations/20260512090000_fk_cascade_user_team_delete.sql`
- `docs/SCHEMA.md` — uppdaterad med tabellen över ON DELETE-policy
- PR: v1.5.15-batch

## Referenser

- Issue #41
