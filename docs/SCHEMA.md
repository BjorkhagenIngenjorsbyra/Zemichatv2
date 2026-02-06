# Zemichat v2 – Databasschema

## Översikt

Detta dokument beskriver Supabase/PostgreSQL-schemat för Zemichat. Schemat är designat för att stödja den unika transparensmodellen där Team Owners har full insyn i sina Texters kommunikation.

---

## ER-diagram (konceptuellt)

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   teams     │       │   users     │       │  friendships│
│─────────────│       │─────────────│       │─────────────│
│ id          │◄──────│ team_id     │       │ user_id     │
│ name        │       │ role        │──────►│ friend_id   │
│ owner_id    │──────►│ zemi_number │       │ status      │
│ plan        │       │ ...         │       │ approved_by │
└─────────────┘       └─────────────┘       └─────────────┘
                            │
                            ▼
                      ┌─────────────┐       ┌─────────────┐
                      │ chat_members│       │   chats     │
                      │─────────────│       │─────────────│
                      │ user_id     │──────►│ id          │
                      │ chat_id     │       │ name        │
                      │ joined_at   │       │ created_by  │
                      └─────────────┘       └─────────────┘
                                                  │
                                                  ▼
                                            ┌─────────────┐
                                            │  messages   │
                                            │─────────────│
                                            │ chat_id     │
                                            │ sender_id   │
                                            │ content     │
                                            │ type        │
                                            │ deleted_at  │
                                            └─────────────┘
```

---

## Tabeller

### teams
Team/familj som ägs av en Team Owner.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| name | text | Teamets namn (t.ex. "Familjen Andersson") |
| owner_id | uuid | FK → users.id (Team Owner) |
| plan | enum | 'free', 'basic', 'pro' |
| trial_ends_at | timestamptz | När trial-perioden slutar |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```sql
CREATE TYPE plan_type AS ENUM ('free', 'basic', 'pro');

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan plan_type NOT NULL DEFAULT 'free',
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

### users
Alla användare (Owner, Super, Texter).

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key (samma som auth.users.id) |
| team_id | uuid | FK → teams.id |
| role | enum | 'owner', 'super', 'texter' |
| zemi_number | text | Unikt ID (t.ex. "ZEMI-123-456") |
| display_name | text | Valfritt visningsnamn |
| avatar_url | text | Profilbild |
| status_message | text | Statusmeddelande |
| last_seen_at | timestamptz | Senast online |
| is_active | boolean | Om kontot är aktivt (Owner kan stänga av) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```sql
CREATE TYPE user_role AS ENUM ('owner', 'super', 'texter');

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  zemi_number text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  status_message text,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_zemi_number ON users(zemi_number);
```

---

### texter_settings
Funktionskontroll per Texter (vilka features Owner har aktiverat).

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → users.id (måste vara Texter) |
| can_send_images | boolean | |
| can_send_voice | boolean | |
| can_send_video | boolean | |
| can_send_documents | boolean | |
| can_share_location | boolean | |
| can_voice_call | boolean | |
| can_video_call | boolean | |
| can_screen_share | boolean | |
| quiet_hours_start | time | Schemalagd tystnad start |
| quiet_hours_end | time | Schemalagd tystnad slut |
| quiet_hours_days | int[] | Vilka veckodagar (1=mån, 7=sön) |

```sql
CREATE TABLE texter_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_send_images boolean NOT NULL DEFAULT true,
  can_send_voice boolean NOT NULL DEFAULT true,
  can_send_video boolean NOT NULL DEFAULT true,
  can_send_documents boolean NOT NULL DEFAULT true,
  can_share_location boolean NOT NULL DEFAULT true,
  can_voice_call boolean NOT NULL DEFAULT true,
  can_video_call boolean NOT NULL DEFAULT true,
  can_screen_share boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_days int[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

### friendships
Vänskapsrelationer mellan användare.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| requester_id | uuid | Den som skickade förfrågan |
| addressee_id | uuid | Den som tar emot förfrågan |
| status | enum | 'pending', 'accepted', 'rejected' |
| approved_by | uuid | Om Texter: Owner som godkände |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```sql
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
```

---

### denied_friend_requests
Användare som Team Owner har nekat för en Texter (kan inte skicka nya förfrågningar).

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| texter_id | uuid | Textern som skyddas |
| denied_user_id | uuid | Användaren som nekats |
| denied_by | uuid | Owner som nekade |
| created_at | timestamptz | |

```sql
CREATE TABLE denied_friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  denied_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  denied_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(texter_id, denied_user_id)
);
```

---

### chats
Alla chattar (1:1 och grupper är samma struktur).

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| name | text | Gruppnamn (null för 1:1) |
| description | text | Gruppbeskrivning |
| avatar_url | text | Gruppbild |
| is_group | boolean | True om >2 deltagare tillåts |
| created_by | uuid | Skaparen |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```sql
CREATE TABLE chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  avatar_url text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

### chat_members
Vilka användare som deltar i vilka chattar.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| chat_id | uuid | FK → chats.id |
| user_id | uuid | FK → users.id |
| joined_at | timestamptz | |
| left_at | timestamptz | Null om fortfarande medlem |
| is_muted | boolean | Mutad av användaren |
| is_pinned | boolean | Pinnad av användaren |
| is_archived | boolean | Arkiverad av användaren |
| unread_count | int | Antal olästa meddelanden |
| last_read_at | timestamptz | Senast lästa meddelande |

```sql
CREATE TABLE chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  is_muted boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  unread_count int NOT NULL DEFAULT 0,
  last_read_at timestamptz,
  UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_chat_members_user ON chat_members(user_id);
CREATE INDEX idx_chat_members_chat ON chat_members(chat_id);
```

---

### messages
Alla meddelanden.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| chat_id | uuid | FK → chats.id |
| sender_id | uuid | FK → users.id |
| type | enum | Meddelandetyp |
| content | text | Textinnehåll |
| media_url | text | URL till media (bild, video, etc.) |
| media_metadata | jsonb | Storlek, duration, etc. |
| reply_to_id | uuid | FK → messages.id (om reply) |
| forwarded_from_id | uuid | FK → messages.id (om vidarebefordrat) |
| location | geography | Platsdata |
| contact_zemi_number | text | Om kontaktdelning |
| is_edited | boolean | Om meddelandet redigerats |
| edited_at | timestamptz | När det redigerades |
| deleted_at | timestamptz | Soft delete (visas fortfarande för Owner) |
| deleted_by | uuid | Vem som raderade |
| created_at | timestamptz | |

```sql
CREATE TYPE message_type AS ENUM (
  'text', 
  'image', 
  'voice', 
  'video', 
  'document', 
  'location', 
  'contact',
  'system'  -- För "X joined the chat" etc.
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  type message_type NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  media_metadata jsonb,
  reply_to_id uuid REFERENCES messages(id),
  forwarded_from_id uuid REFERENCES messages(id),
  location geography(Point, 4326),
  contact_zemi_number text,
  is_edited boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(chat_id, created_at DESC);
```

---

### message_edits
Historik över redigeringar (för Owner-insyn).

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| message_id | uuid | FK → messages.id |
| old_content | text | Innehållet innan redigering |
| edited_at | timestamptz | |

```sql
CREATE TABLE message_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  old_content text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_edits_message ON message_edits(message_id);
```

---

### message_reactions
Reactions på meddelanden.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| message_id | uuid | FK → messages.id |
| user_id | uuid | FK → users.id |
| emoji | text | Emoji-tecknet |
| created_at | timestamptz | |

```sql
CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);
```

---

### starred_messages
Stjärnmärkta meddelanden per användare.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → users.id |
| message_id | uuid | FK → messages.id |
| created_at | timestamptz | |

```sql
CREATE TABLE starred_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);
```

---

### message_read_receipts
Läskvitton per användare och meddelande.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| message_id | uuid | FK → messages.id |
| user_id | uuid | FK → users.id |
| read_at | timestamptz | |

```sql
CREATE TABLE message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_read_receipts_message ON message_read_receipts(message_id);
```

---

### quick_messages
Snabbmeddelanden/templates.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| user_id | uuid | Användaren som äger (eller Texter om skapad av Owner) |
| created_by | uuid | Vem som skapade (Owner för Texters) |
| content | text | Meddelandetext |
| sort_order | int | Sorteringsordning |
| created_at | timestamptz | |

```sql
CREATE TABLE quick_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quick_messages_user ON quick_messages(user_id);
```

---

### reports
Rapporterade meddelanden/användare.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| reporter_id | uuid | Vem som rapporterade |
| reported_user_id | uuid | Rapporterad användare (valfritt) |
| reported_message_id | uuid | Rapporterat meddelande (valfritt) |
| reason | text | Anledning |
| status | enum | 'pending', 'reviewed', 'escalated' |
| reviewed_by | uuid | Owner som hanterade |
| escalated_at | timestamptz | Om eskalerat till Zemi Support |
| created_at | timestamptz | |

```sql
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'escalated');

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id),
  reported_user_id uuid REFERENCES users(id),
  reported_message_id uuid REFERENCES messages(id),
  reason text,
  status report_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id),
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reported_user_id IS NOT NULL OR reported_message_id IS NOT NULL)
);

CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);
```

---

### sos_alerts
SOS-larm från Texters.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| texter_id | uuid | FK → users.id |
| location | geography | Plats vid larm |
| acknowledged_at | timestamptz | När Owner bekräftade |
| acknowledged_by | uuid | FK → users.id |
| created_at | timestamptz | |

```sql
CREATE TABLE sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texter_id uuid NOT NULL REFERENCES users(id),
  location geography(Point, 4326),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sos_alerts_texter ON sos_alerts(texter_id);
```

---

### call_logs
Samtalshistorik.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| chat_id | uuid | FK → chats.id |
| initiator_id | uuid | Vem som startade |
| type | enum | 'voice', 'video' |
| status | enum | 'missed', 'answered', 'declined' |
| started_at | timestamptz | |
| ended_at | timestamptz | |
| duration_seconds | int | |

```sql
CREATE TYPE call_type AS ENUM ('voice', 'video');
CREATE TYPE call_status AS ENUM ('missed', 'answered', 'declined');

CREATE TABLE call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id),
  initiator_id uuid NOT NULL REFERENCES users(id),
  type call_type NOT NULL,
  status call_status NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int
);

CREATE INDEX idx_call_logs_chat ON call_logs(chat_id);
```

---

### push_tokens
Push-notifikationstokens per enhet.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → users.id |
| token | text | FCM/APNs token |
| platform | enum | 'ios', 'android' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```sql
CREATE TYPE platform_type AS ENUM ('ios', 'android');

CREATE TABLE push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform platform_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
```

---

### user_sessions
Aktiva sessioner (för "Logga ut andra enheter").

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK → users.id |
| device_name | text | T.ex. "iPhone 14" |
| ip_address | inet | |
| last_active_at | timestamptz | |
| created_at | timestamptz | |

```sql
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name text,
  ip_address inet,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
```

---

## Funktioner & Triggers

### Generera Zemi-nummer
```sql
CREATE OR REPLACE FUNCTION generate_zemi_number()
RETURNS text AS $$
DECLARE
  new_number text;
  exists_already boolean;
BEGIN
  LOOP
    new_number := 'ZEMI-' || 
      LPAD(floor(random() * 1000)::text, 3, '0') || '-' ||
      LPAD(floor(random() * 1000)::text, 3, '0');
    
    SELECT EXISTS(SELECT 1 FROM users WHERE zemi_number = new_number) INTO exists_already;
    
    IF NOT exists_already THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Uppdatera updated_at automatiskt
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applicera på alla relevanta tabeller
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ... etc för övriga tabeller
```

### Spara meddelandehistorik vid redigering
```sql
CREATE OR REPLACE FUNCTION save_message_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO message_edits (message_id, old_content)
    VALUES (OLD.id, OLD.content);
    
    NEW.is_edited := true;
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_edit_trigger BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION save_message_edit();
```

### Räkna rapporter och eskalera
```sql
CREATE OR REPLACE FUNCTION check_report_escalation()
RETURNS TRIGGER AS $$
DECLARE
  report_count int;
BEGIN
  IF NEW.reported_user_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT reporter_id) INTO report_count
    FROM reports
    WHERE reported_user_id = NEW.reported_user_id
    AND status != 'escalated';
    
    IF report_count >= 3 THEN
      UPDATE reports
      SET status = 'escalated', escalated_at = now()
      WHERE reported_user_id = NEW.reported_user_id
      AND status != 'escalated';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_escalation_trigger AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_escalation();
```

---

## RLS Policies

Se separat dokument: [RLS.md](./RLS.md)

**Grundprinciper:**
1. Team Owner kan läsa alla meddelanden där deras Texters deltar
2. Borttagna meddelanden (deleted_at IS NOT NULL) visas fortfarande för Owner
3. Supers chattar är privata om ingen Texter deltar
4. Texters kan endast chatta med godkända vänner

---

## Migrations-ordning

1. `001_create_enums.sql` – Alla enum-typer
2. `002_create_teams.sql` – Teams-tabell (utan owner_id FK först)
3. `003_create_users.sql` – Users-tabell
4. `004_add_teams_owner_fk.sql` – Lägg till owner_id FK på teams
5. `005_create_texter_settings.sql`
6. `006_create_friendships.sql`
7. `007_create_chats.sql`
8. `008_create_messages.sql`
9. `009_create_supporting_tables.sql` – Reactions, receipts, etc.
10. `010_create_functions.sql`
11. `011_create_triggers.sql`
12. `012_create_rls_policies.sql`
13. `013_enable_realtime.sql`

---

*Dokumentversion: 1.0*
*Senast uppdaterad: 2025-02-04*
