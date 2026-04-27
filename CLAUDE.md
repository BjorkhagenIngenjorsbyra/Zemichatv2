# CLAUDE.md – Zemichat v2

## Projektöversikt

Zemichat är en familjevänlig chattapp med unik transparensmodell där Team Owners har full insyn i sina Texters kommunikation. Appen ska kännas lika polerad som WhatsApp men med inbyggd trygghet för barn.

**Tech Stack:**
- Frontend: Ionic + Capacitor (React + TypeScript)
- Backend: Supabase (Auth, PostgreSQL, Realtime, Storage)
- Betalningar: RevenueCat
- Samtal: Agora SDK
- Push: Firebase Cloud Messaging / APNs

**Dokumentation:**
- [PRD](./docs/PRD.md) – Komplett produktspecifikation
- [Schema](./docs/SCHEMA.md) – Databasschema
- [RLS Policies](./docs/RLS.md) – Säkerhetspolicies

---

## Arbetsflöde

### 1. Planera först
För alla uppgifter med 3+ steg eller arkitekturella beslut:
- Skriv plan i `tasks/todo.md` med checkbara items
- Stäm av planen med Erik innan implementation börjar
- Markera items som klara allt eftersom
- Om något går snett: STOPPA, uppdatera planen, och börja om

### 2. Verifiera innan klart
Markera en uppgift som klar först när den är bevisat fungerande:
- Kör relevanta tester
- Diffla dina ändringar – håll scopet till det som behövs
- Fråga dig: "Skulle en senior utvecklare godkänna detta?"
- Verifiera att övriga delar fortfarande fungerar

### 3. Lär av misstag
Efter VARJE korrigering från Erik:
- Uppdatera `tasks/lessons.md` med mönstret
- Skriv en regel som förhindrar samma misstag
- Läs lessons vid sessionens start för relevanta projekt

---

## Utvecklingsprinciper

### 1. Produktion från start
Skriv alltid produktionskvalitet. Om scope är för stort för full lösning: leverera en mindre fungerande del och skapa en issue för resten — så att begränsningen är synlig snarare än dold som "TODO".

### 2. Minimal påverkan
- Håll varje ändring fokuserad på den specifika uppgiften
- Rör de filer som är nödvändiga för uppgiften
- Adressera grundorsaken — bygg lösningar som håller över tid
- Bevara orelaterad kod intakt för att skydda mot regressionsfel
- Om en fix känns hackig: pausa och leta en elegantare lösning

### 3. Tester före implementation
```
1. Skriv testspecifikation (vad ska testas)
2. Skriv själva testet (förväntas faila)
3. Implementera funktionen
4. Kör testet (ska passa)
5. Refaktorera om nödvändigt
6. Kör ALLA tester igen
7. Diffla mot main – ser ändringarna rimliga ut?
```

### 4. Självständigt arbete
Claude ska arbeta autonomt i långa sessioner. Vid osäkerhet:
- Läs PRD:en först
- Sök i befintlig kodbas
- Kolla `tasks/lessons.md` för tidigare lärdomar
- Fatta beslut baserat på etablerade mönster
- Dokumentera beslutet i commit-meddelande

### 5. Stanna när det är oklart
Om något är oklart i PRD:en – stanna och fråga Erik. Sök förtydligande på följande områden innan implementation:
- Säkerhetslogik (RLS, behörigheter)
- Affärslogik (prenumerationer, roller)
- Användarflöden som påverkar barn

---

## Kodstandard

### TypeScript
```typescript
// Strict mode
// Explicit types på alla parametrar och returvärden
// Föredra interfaces över types för objekt
// Använd enums för fasta värden

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MessageType;
  createdAt: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  VIDEO = 'video',
  DOCUMENT = 'document',
  LOCATION = 'location',
  CONTACT = 'contact',
}
```

### React-komponenter
```typescript
// Funktionella komponenter med TypeScript
// Props-interface alltid explicit
// Hooks i toppen av komponenten
// Separera logik från presentation där möjligt

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  onReply: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isOwn,
  onReply,
  onReaction,
}) => {
  // Implementation
};
```

### Filstruktur
```
src/
├── components/          # Återanvändbara UI-komponenter
│   ├── chat/
│   ├── common/
│   └── owner-dashboard/
├── pages/               # Ionic-sidor (routes)
├── hooks/               # Custom React hooks
├── services/            # API-anrop, Supabase-klient
├── stores/              # State management (Zustand/Jotai)
├── types/               # TypeScript-definitioner
├── utils/               # Hjälpfunktioner
└── tests/               # Tester (speglar src-strukturen)
```

---

## Testning

### Testtyper
1. **Unit tests** – Enskilda funktioner och komponenter
2. **Integration tests** – Supabase-interaktioner, RLS-policies
3. **E2E tests** – Kompletta användarflöden

### Testkrav
- Varje ny funktion kräver minst ett test
- RLS-policies kräver tester för ALLA roller (Owner, Super, Texter)
- Transparenslogik kräver explicita tester

### Testmönster för RLS
```typescript
describe('Message RLS', () => {
  it('Owner can read all messages from their Texters chats', async () => {
    // Setup: Skapa Owner, Texter, chatt, meddelande
    // Act: Försök läsa som Owner
    // Assert: Meddelandet är synligt
  });

  it('Owner cannot read Super-only chats', async () => {
    // Setup: Skapa Owner, två Supers, chatt mellan Supers
    // Act: Försök läsa som Owner
    // Assert: Meddelandet är INTE synligt
  });

  it('Deleted messages are still visible to Owner', async () => {
    // Setup: Skapa meddelande, radera det
    // Act: Läs som Owner
    // Assert: Meddelandet syns med deleted_at satt
  });
});
```

### Köra tester
```bash
# Alla tester
npm test

# Specifik fil
npm test -- messages.test.ts

# Watch mode under utveckling
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

## Supabase-konventioner

### Tabellnamn
- snake_case
- Pluralform (users, messages, chats)
- Prefix för junction tables: `chat_participants`, `user_friends`

### Kolumnnamn
- snake_case
- `id` alltid UUID, primary key
- `created_at` och `updated_at` på alla tabeller
- `deleted_at` för soft delete (där det behövs)
- Foreign keys: `[tabell]_id` (t.ex. `user_id`, `chat_id`)

### RLS-policies
```sql
-- Namnkonvention: [tabell]_[operation]_[roll]
-- Exempel: messages_select_owner, messages_insert_member

-- Alltid explicit: Ingen USING (true) utan motivering
-- Alltid testa: Varje policy ska ha motsvarande test
```

### Migrations
```bash
# Skapa ny migration
supabase migration new add_messages_table

# Kör lokalt
supabase db reset

# Pusha till produktion (manuellt efter review)
supabase db push
```

---

## Git-konventioner

### Commits
```
type(scope): kort beskrivning

[valfri längre beskrivning]

[valfri referens till issue]
```

**Types:**
- `feat` – Ny funktionalitet
- `fix` – Buggfix
- `test` – Lägger till eller fixar tester
- `refactor` – Kodförbättring utan funktionsändring
- `docs` – Dokumentation
- `chore` – Byggverktyg, dependencies

**Exempel:**
```
feat(chat): add swipe-to-reply gesture

Implements WhatsApp-style swipe right to quote a message.
Uses react-swipeable for gesture detection.

Closes #42
```

### Branches
```
main              # Produktion
develop           # Integration
feature/xxx       # Nya features
fix/xxx           # Bugfixes
```

---

## Säkerhetsprinciper

### Servern är källan till sanning
- Behörighetskontroll sker i RLS — klienten ses som icke-betrodd
- Validera input på server (Supabase Functions om nödvändigt)
- Behåll service_role-nyckeln serversida — den lämnar inte edge functions eller backend

### Transparens är kärnan
- Team Owner SKA kunna läsa Texters meddelanden
- Detta är inte en bugg – det är hela poängen
- Borttagna meddelanden sparas med `deleted_at`, inte faktiskt raderade

### Rollhierarki
```
Team Owner
├── Läser ALLA Texters chattar (inklusive raderade meddelanden)
├── Supers privata chattar är skyddade när ingen Texter deltar
├── Stänger av funktioner per Texter
├── Stänger av Texters och Supers i sitt team
└── Godkänner Texters vänförfrågningar

Super
├── Har privacy från Owner när ingen Texter deltar i chatten
├── Hanterar sina egna vänförfrågningar
├── Avslutar vänskaper (unfriend); blockering finns endast för stängda team-relationer
└── Kan stängas av av Team Owner

Texter
├── Owner ser allt
├── Avslutar vänskaper (unfriend); blockering hanteras via Owner
├── Vänförfrågningar kräver Owner-godkännande
└── Kan stängas av av Team Owner
```

---

## Vanliga uppgifter

### Lägga till ny meddelandetyp
1. Uppdatera `MessageType` enum
2. Uppdatera `messages`-tabellen om ny kolumn behövs
3. Skapa komponent för rendering
4. Uppdatera input-komponent för att skicka
5. Skriv tester för båda
6. Verifiera att RLS fortfarande fungerar

### Lägga till ny Owner-kontroll (feature toggle för Texter)
1. Lägg till kolumn i `texter_settings` (eller liknande)
2. Uppdatera Owner Dashboard UI
3. Lägg till check i relevant funktionalitet
4. Skriv test som verifierar att togglen fungerar
5. Skriv test som verifierar att Texter inte kan kringgå

### Testa RLS-ändringar
```bash
# 1. Skriv testet först
# 2. Kör: npm test -- rls.test.ts (ska faila)
# 3. Uppdatera policy
# 4. Kör: supabase db reset
# 5. Kör: npm test -- rls.test.ts (ska passa)
# 6. Kör ALLA tester: npm test
```

---

## Felsökning

### "Permission denied" i Supabase
1. Kontrollera att användaren är inloggad
2. Kontrollera RLS-policy för tabellen
3. Kör `supabase db reset` och testa igen
4. Logga `auth.uid()` och jämför med förväntad

### Realtime uppdateras inte
1. Kontrollera att Realtime är aktiverat för tabellen
2. Kontrollera RLS – användaren måste ha SELECT-behörighet
3. Verifiera subscription-filtret

### Tester failar i CI men inte lokalt
1. Kontrollera att seed-data är identisk
2. Kontrollera tidszoner (använd alltid UTC)
3. Kör `supabase db reset` lokalt och testa igen

---

## Kontakt & Beslut

När Claude behöver fatta beslut som inte täcks av PRD:en:

1. **UX-beslut:** Följ WhatsApp/Messenger som referens
2. **Säkerhetsbeslut:** Välj alltid det säkrare alternativet
3. **Prestandabeslut:** Optimera för mobil först
4. **Arkitekturbeslut:** Dokumentera i commit och fortsätt

Om beslutet påverkar:
- Barns säkerhet → STOPPA och fråga Erik
- Betalningsflöden → STOPPA och fråga Erik
- Datamodellen fundamentalt → STOPPA och fråga Erik

---

*Senast uppdaterad: 2025-02-20*
