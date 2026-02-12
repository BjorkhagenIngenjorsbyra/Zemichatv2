# PRD: Zemichat v2 – Ansvar genom Transparens

## Komplett Produktspecifikation

---

## 1. Vision & Syfte

Zemichat är en premiumplattform för kommunikation där anonymitet ersätts av ansvar. Genom en unik hierarki och ekonomisk verifiering skapas en miljö fri från troll och mobbning.

**Kärnprincip:** En Team Owner tar fullt ansvar för sina underställda konton (Texters) och har full insyn i deras digitala interaktioner för att garantera trygghet.

**Designfilosofi:** Kombinera WhatsApp/Messengers polerade UX med unik transparens och familjefokus.

---

## 2. Användarroller & Hierarki

| Roll | Beskrivning | Registrering | Insyn |
|------|-------------|--------------|-------|
| **Team Owner** | Ansvarig vuxen (18+). Betalar för teamet. | E-post + betalkortsverifiering | Full insyn i alla Texters chattar |
| **Super** | Äldre deltagare med mer privacy (t.ex. tonåring, ledare) | Inbjudan via e-post från Owner | Ingen insyn i andras chattar |
| **Texter** | Underställd användare (t.ex. barn) | Skapas av Owner. Inget eget e-post/telefon krävs | Owner ser allt |

**Kontroll:** Team Owner kan stänga av både Texters och Supers från sitt team när som helst.

---

## 3. Identitet & Vänskap

### 3.1 Zemi-nummer
- Varje användare får ett unikt, slumpmässigt ID (t.ex. `ZEMI-123-456`)
- Används för att lägga till vänner
- Kan delas via kontaktdelning i chattar

### 3.2 Vänförfrågningar
- Samma team ≠ automatisk vänskap
- Man lägger till vänner manuellt via Zemi-nummer
- **Texters:** Team Owner måste godkänna alla vänförfrågningar
- **Supers:** Hanterar sina egna vänförfrågningar

### 3.3 Avsluta vänskap
- Alla roller kan avsluta en vänskap
- Ingen notis skickas till den andra parten

### 3.4 Avsluta vänskap (Unfriend)
- Alla roller kan avsluta en vänskap
- Ingen notis skickas till den andra parten
- Ingen roll kan blockera – endast unfriend
- Om en Texter vill undvika någon helt kan Team Owner neka framtida vänförfrågningar

---

## 4. Chattar & Grupper

### 4.1 Arkitektur
Alla chattar är tekniskt grupper. En 1:1-chatt är en grupp med exakt två deltagare.

### 4.2 Skapa chatt
- Alla roller kan skapa chattar med sina befintliga vänner
- Endast skaparen kan bjuda in fler deltagare (Team Owner behåller kontroll)

### 4.3 Gruppinställningar
- Gruppnamn
- Gruppbild
- Gruppbeskrivning
- Bakgrundsbild (per chatt eller global standard)

### 4.4 Chatt-organisation

#### Fäst chattar (Pin)
- Dra favoriter till toppen av chattlistan
- Max 5 pinnade chattar

#### Arkivera chattar
- Göm chattar utan att radera dem
- Arkiverade chattar visas i separat sektion
- Nya meddelanden flyttar tillbaka chatten till huvudlistan (konfigurerbart)

#### Oläst-markering
- Markera en läst chatt som oläst
- Fungerar som påminnelse att svara senare

### 4.5 Lämna grupp
- Texters kan lämna grupper själva
- **Tillkalla-knapp:** Synlig i varje chatt – skickar akut notis till Team Owner

### 4.6 Media-galleri per chatt
- Tryck på chattens namn → Se alla delade medier
- Filtrerat per typ: Bilder, Videos, Dokument, Länkar

---

## 5. Meddelanden

### 5.1 Meddelandetyper

| Typ | Beskrivning |
|-----|-------------|
| Text | Med formatering (fetstil, kursiv, genomstruken, monospace) |
| Bilder | Med valfri bildtext, val att skicka i originalformat |
| Röstmeddelanden | Håll för att spela in, svep upp för att låsa, förhandsgranskning |
| Video | Inspelade klipp |
| Dokument | PDF, Word, Excel, etc. |
| Plats | Engångsdelning eller live-plats |
| Kontakt | Dela ett Zemi-nummer |
| Länkar | Automatisk preview med bild, titel, beskrivning |

### 5.2 Meddelandefunktioner

#### Reactions
- Dubbeltryck för snabb ❤️
- Håll inne för full emoji-picker
- Visa alla som reagerat

#### Reply/Citera
- Svep höger på meddelande för snabb reply
- Citerat meddelande visas ovanför svaret
- Tryck på citat för att hoppa till ursprungsmeddelandet

#### Vidarebefordra
- Vidarebefordra meddelande till annan chatt
- Markering "Vidarebefordrat" visas

#### Redigera
- Redigera skickade meddelanden
- "Redigerat"-markering visas
- Redigeringshistorik sparas (synlig för Team Owner)

#### Ta bort meddelanden
- "Ta bort för mig" – endast lokalt
- "Ta bort för alla" – borttaget för alla deltagare
- **Transparens:** Borttagna meddelanden syns fortfarande för Texterns Team Owner

#### Stjärnmärk meddelanden
- Spara viktiga meddelanden
- Egen vy för alla stjärnmärkta meddelanden
- Stjärnmärkta sparas per chatt och globalt

### 5.3 Röstmeddelanden – Detaljer
- Håll inne mikrofon-knappen för att spela in
- Svep upp för att låsa inspelning (kan släppa knappen)
- Svep vänster för att avbryta
- Förhandsgranska innan skicka
- **Uppspelningshastighet:** 1x, 1.5x, 2x

### 5.4 Lässtatus
- ✓ Skickat
- ✓✓ Levererat
- ✓✓ (blå) Läst
- "Skriver..." indikator
- "Senast online" (Supers kan dölja detta i inställningar)

### 5.5 Sök i meddelanden
- Sök i specifik chatt (via chattens meny)
- Global sökning över alla chattar
- Hoppa direkt till sökresultat i konversationen
- Sökresultat visar kontext (meddelanden före/efter)

---

## 6. Samtal (Agora)

### 6.1 Åtkomst till samtal
Samtal initieras från två platser:
- **Vänlistan:** Tryck på en väns namn → Samtalsikoner (röst/video)
- **I chatten:** Samtalsikoner i chattens header

### 6.2 Samtalsfunktioner
- Röstsamtal
- Videosamtal
- Gruppsamtal (flera deltagare)
- Växla ljud ↔ video under pågående samtal
- Skärmdelning
- Minimerat samtalsfönster (fortsätt chatta under samtal)

### 6.3 Samtalsbegränsningar
- **Videosamtal:** Max 60 minuter per samtal
- **Varning vid 55 minuter:** "Samtalet avslutas om 5 minuter"
- Samtalet avslutas automatiskt efter 60 minuter
- Röstsamtal har ingen tidsgräns

### 6.4 Ej inkluderat
- ❌ Inspelning av samtal

### 6.5 Behörighet
- Man kan ringa alla på sin vänlista
- Team Owner godkänner alla kontakter för Texters
- Team Owner kan stänga av samtalsfunktioner per Texter

### 6.6 Samtalshistorik
- Visas som meddelanden i chatten: "Röstsamtal, 3 min"
- Missade samtal markerade

---

## 7. Funktionskontroll för Texters

Team Owner har en tydlig kontrollpanel ("bar") för att styra varje Texters funktioner på individnivå:

| Funktion | Kan stängas av per Texter |
|----------|---------------------------|
| Skicka bilder | ✅ |
| Skicka röstmeddelanden | ✅ |
| Skicka video | ✅ |
| Skicka dokument | ✅ |
| Dela plats | ✅ |
| Röstsamtal | ✅ |
| Videosamtal | ✅ |
| Skärmdelning | ✅ |

**Supers:** Har alltid alla funktioner aktiverade – styrs inte av Owner.

---

## 8. Radikal Transparens (Oversight)

### 8.1 Grundprincip
Team Owner kan läsa **alla** meddelanden i **alla** chattar där deras Texters deltar.

### 8.2 Korsvis insyn
Om Texter A (tillhör Owner 1) chattar med Texter B (tillhör Owner 2):
- **Båda** Owners har full läsbehörighet till chatten

### 8.3 Borttagna meddelanden
- Meddelanden som tas bort "för alla" visas fortfarande för relevant Team Owner
- Markeras tydligt som "Borttaget av [namn]"

### 8.4 Redigerade meddelanden
- Redigeringshistorik sparas och är synlig för Team Owner

### 8.5 Undantag
- Owner ser **inte** Supers chattar (såvida inte en av Owners Texters deltar i chatten)

---

## 9. Notifikationer

### 9.1 Alla användare
- Push-notis för varje meddelande
- Kan muta enskilda chattar (inga notiser, men synlig i listan)
- "Stör ej" – tysta alla notiser under vald tid

### 9.2 Team Owner-specifika notiser
| Händelse | Notis |
|----------|-------|
| Texter läggs till i ny chatt | ✅ |
| Texter rapporterar meddelande/användare | ✅ |
| Texter trycker "Tillkalla"-knappen | ✅ (hög prioritet) |
| Texter trycker SOS-knappen | ✅ (hög prioritet + plats) |
| Varje meddelande Texter skickar | ❌ |
| Veckorapport | ❌ |

### 9.3 Inloggningsnotiser
- "Ditt konto loggades in på ny enhet"
- Skickas till Team Owner för alla konton i teamet

---

## 10. Profiler & Inställningar

### 10.1 Användarprofil
- Profilbild
- Visningsnamn (valfritt)
- Statusmeddelande (t.ex. "Upptagen", "På semester")
- Zemi-nummer (visas, kan inte ändras)

### 10.2 Profilhantering per roll
- **Texters:** Hanterar sin egen profil (Owner behöver inte godkänna)
- **Supers:** Full kontroll över sin profil
- **Owners:** Full kontroll

### 10.3 Integritetsinställningar
- Supers kan dölja "senast online"
- Texters kan **inte** dölja detta

### 10.4 App-inställningar

#### Utseende
- Mörkt läge (auto/manuellt)
- Textstorlek (oberoende av systeminställning)
- Bakgrundsbild (global standard)
- Chattbubblefärger

#### Lagring & Data
- Hantera nedladdade medier
- Rensa cache
- Auto-nedladdning av media (Wi-Fi/mobildata)

---

## 11. Snabbmeddelanden & Templates

### 11.1 Fördefinierade meddelanden
Team Owner kan skapa templates åt sina Texters:
- "Jag är framme!"
- "Hämta mig"
- "Allt ok"
- "Jag är sen"

### 11.2 Användning
- Texters ser templates som snabbknappar ovanför tangentbordet
- Ett tryck skickar meddelandet direkt
- Perfekt för yngre barn som inte skriver snabbt

### 11.3 Egna templates
- Supers och Owners kan skapa egna snabbmeddelanden

---

## 12. SOS-funktion

### 12.1 Knapp
- Tydlig, alltid tillgänglig SOS-knapp (t.ex. i sidomeny eller genom att hålla inne volymknapp)
- Kräver bekräftelse för att undvika misstag

### 12.2 Vid aktivering
1. Skickar aktuell plats till Team Owner
2. Push-notis med hög prioritet (genombryter "stör ej")
3. Meddelande i chatt med Owner: "🆘 SOS aktiverad"
4. Valfritt: Automatiskt röstsamtal till Owner

### 12.3 Tillgänglighet
- Endast för Texters
- Kan inte stängas av av Team Owner

---

## 13. Team Owner Dashboard

### 13.1 Aktivitetsöversikt
- Lista över alla Texters med "Senast aktiv"
- Snabb överblick utan att behöva gå in i varje chatt

### 13.2 Väntande godkännanden
- Nya vänförfrågningar att godkänna
- Nya chattinbjudningar

### 13.3 Rapporter
- Lista över rapporterade meddelanden/användare
- Åtgärdsstatus

### 13.4 Funktionskontroll
- Snabb toggle för varje Texters funktioner
- Visuell "bar" som visar vad som är på/av

---

## 14. Delning & Integration

### 14.1 Share Sheet / Share Intent
- **Kritisk funktion:** Dela från galleri/andra appar direkt till Zemichat
- Användare markerar bilder i Foton → Dela → Väljer Zemichat → Väljer chatt
- Stöd för: bilder, video, dokument, länkar, text

### 14.2 Länkpreviews
- Automatisk hämtning av OG-metadata
- Visar: bild, titel, beskrivning
- Tryck för att öppna i webbläsare

### 14.3 Kamera i appen
- Ta foto/video direkt utan att lämna chatten
- Front/back-kamera toggle
- Blixt-kontroll
- Skicka direkt eller redigera först

### 14.4 Skicka i originalformat
- Val att skicka bild/video utan komprimering
- Indikator för filstorlek innan skicka

---

## 15. Rapportering & Moderering

### 15.1 Vad kan rapporteras
- Enskilda meddelanden
- Användare

### 15.2 Rapporteringsflöde
1. Användare trycker "Rapportera" på meddelande/profil
2. Väljer anledning (valfritt)
3. Rapport skickas till Texterns Team Owner

### 15.3 Eskalering
- Efter **3 rapporteringar** av samma användare (från olika teams)
- → Automatisk notis till Zemi Support
- Zemi Support kan stänga av användare centralt

### 15.4 Team Owner-åtgärder
- Kan stänga av Texter/Super i sitt team
- Kan ta bort specifika chattar för en Texter
- Kan neka framtida vänförfrågningar från specifika användare för en Texter

---

## 16. Säkerhet

### 16.1 Tvåfaktorsautentisering (2FA)
- Valfritt men rekommenderat för Team Owners
- Via SMS eller authenticator-app

### 16.2 Aktiva sessioner
- Se alla enheter där kontot är inloggat
- Logga ut andra enheter med ett tryck

### 16.3 Inloggningsnotiser
- Notis vid inloggning från ny enhet
- Möjlighet att neka inloggning

### 16.4 Row Level Security (RLS)
- Supabase RLS säkerställer att:
  - Team Owner endast ser sina egna Texters data
  - Texters inte kan se andras chattar
  - Korsvis insyn fungerar korrekt

---

## 17. Schemalagd Tystnad

### 17.1 Funktionalitet
- Team Owner kan sätta tidsfönster (t.ex. "Skoltid 08:00-15:00")
- Under denna tid: Texters notiser är tysta
- Appen fungerar fortfarande, men inga push-notiser

### 17.2 Användningsfall
- Undvik distraktioner under skoltid
- Nattro – inga notiser efter läggdags

---

## 18. Prenumerationsnivåer (RevenueCat)

| Nivå | Pris | Användare | Funktioner |
|------|------|-----------|------------|
| **Start (Free)** | Gratis | Max 3 (1 Owner + 2) | Endast text |
| **Plus (Basic)** | 25 kr/mån | Max 10 | Text + Bilder |
| **Plus Ringa (Pro)** | 69 kr/mån | Max 10 | Allt inkl. samtal |

### 18.1 Trial
- 10 dagar gratis Plus Ringa-funktionalitet startar automatiskt vid team-skapande
- Ingen planvalssida vid signup – alla börjar med trial automatiskt
- Efter trial (dag 11): faller tillbaka till Start (gratis)

### 18.2 Trial-utgång med för många medlemmar
- Om teamet har fler än 3 medlemmar (inkl. Owner) när trial går ut:
  - **Blockerande dialog** visas vid inloggning
  - Owner väljer vilka 2 medlemmar (utöver sig själv) som ska vara kvar
  - Övriga medlemmar **pausas** (inte raderade)
  - Pausade medlemmar kan inte logga in, visas med "Pausad"-badge i dashboard
  - Pausade medlemmar aktiveras automatiskt vid uppgradering

### 18.3 Gating
- Funktioner som kräver högre nivå är synliga men låsta
- Tydlig upgrade-prompt vid försök att använda
- Start: bara textmeddelanden (bilder, samtal, mm. blockerade)
- Plus: text + bilder (samtal blockerade)
- Plus Ringa: allt inklusive samtal

---

## 19. Onboarding-flöden

### 19.1 Team Owner
1. Laddar ner appen
2. Registrerar med e-post
3. Skapar team (namnger det)
4. 10-dagars Plus Ringa trial startar automatiskt
5. Direkt in i appen (chattvyn)

### 19.2 Super
1. Får inbjudan via e-post från Owner
2. Laddar ner appen
3. Skapar eget lösenord
4. Får slumpat Zemi-nummer
5. Kort introduktion till appen

### 19.3 Texter
1. Owner skapar profilen i sin dashboard
2. Zemi-nummer slumpas automatiskt
3. Owner väljer initialt lösenord
4. Owner ger inloggningsuppgifter till Texter (muntligt/fysiskt)
5. Texter loggar in och kan välja visningsnamn
6. Inget e-post/telefon krävs för Texter

---

## 20. Konto- & Datahantering

### 20.1 Ta bort Texter
- Team Owner kan ta bort en Texter när som helst
- **Allt raderas:** profil, meddelanden, vänskap, media
- Ingen anonymisering – fullständig borttagning

### 20.2 Ta bort Super
- Team Owner kan ta bort en Super
- Superns data raderas från teamet

### 20.3 Ta bort Team Owner-konto
- Alla Texters och Supers i teamet raderas
- All data raderas permanent
- Kräver bekräftelse och eventuellt lösenord

### 20.4 Exportera data
- Team Owner kan exportera all data för sitt team (GDPR)
- Inkluderar: meddelanden, media, kontakter

---

## 21. Tillgänglighet

### 21.1 Textstorlek
- Justerbar i appen (S, M, L, XL)
- Oberoende av telefonens systeminställning

### 21.2 Skärmläsare
- Stöd för VoiceOver (iOS) och TalkBack (Android)
- Alla knappar och element har tillgänglighetsetiketter

### 21.3 Läs högt
- Integrera med systemets text-to-speech
- Håll inne meddelande → "Läs upp"

### 21.4 Kontrast
- Mörkt läge med hög kontrast
- Respektera systemets kontrastinställningar

---

## 22. Teknisk Stack

| Komponent | Teknologi |
|-----------|-----------|
| Frontend | Ionic + Capacitor (React) |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Storage) |
| Betalningar | RevenueCat |
| Media | Supabase Storage |
| Samtal | Agora SDK |
| Push-notiser | Firebase Cloud Messaging / APNs |
| Säkerhet | Row Level Security (RLS), 2FA |
| Länkpreviews | Open Graph scraping (server-side) |

---

## 23. Prioritering för MVP

### Fas 1: Core (MVP)
- [ ] Användarroller (Owner, Super, Texter)
- [ ] Registrering & onboarding
- [ ] Zemi-nummer & vänförfrågningar
- [ ] Chattar (1:1 och grupp)
- [ ] Textmeddelanden
- [ ] Lässtatus
- [ ] Team Owner insyn (transparens)
- [ ] Grundläggande notifikationer
- [ ] RevenueCat-integration (Free-nivå)

### Fas 2: Media & UX
- [ ] Bilder med bildtext
- [ ] Röstmeddelanden (med hastighetsval)
- [ ] Reactions & reply (svep)
- [ ] Sök i chattar
- [ ] Fäst & arkivera chattar
- [ ] Share Sheet-integration
- [ ] Basic & Pro-prenumerationer

### Fas 3: Samtal & Avancerat
- [ ] Röst- och videosamtal (Agora)
- [ ] Gruppsamtal
- [ ] Skärmdelning
- [ ] SOS-knapp
- [ ] Snabbmeddelanden/templates
- [ ] Schemalagd tystnad

### Fas 4: Polish
- [ ] 2FA
- [ ] Mörkt läge
- [ ] Textstorlek
- [ ] Bakgrundsbilder
- [ ] Tillgänglighetsfunktioner
- [ ] Dataexport

---

## 24. Framtida överväganden (ej i scope)

- End-to-end-kryptering (konflikt med transparens-modellen)
- Desktop-app
- Integrationer (kalender, påminnelser)
- AI-moderering
- Översättning av meddelanden

---

## Appendix A: Ordlista

| Term | Definition |
|------|------------|
| Team | En grupp användare under en Team Owners ansvar |
| Team Owner | Den betalande, ansvariga vuxna |
| Super | En äldre/betrodd användare med mer privacy |
| Texter | En underställd användare (t.ex. barn) |
| Zemi-nummer | Unikt användar-ID för att lägga till vänner |
| Transparens | Team Owners fulla insyn i Texters kommunikation |
| Oversight | Systemet för att möjliggöra transparens |

---

## Appendix B: User Stories

### Team Owner
- "Som Team Owner vill jag kunna se alla meddelanden mina barn skickar och tar emot, så att jag kan säkerställa deras trygghet."
- "Som Team Owner vill jag kunna stänga av videofunktionen för mitt yngsta barn, så att de inte delar olämpligt innehåll."
- "Som Team Owner vill jag få notis när mitt barn läggs till i en ny gruppchatt, så att jag vet vilka de pratar med."

### Super
- "Som Super vill jag kunna chatta utan att Team Owner läser mina meddelanden, så länge jag inte chattar med en Texter."
- "Som Super vill jag kunna dölja när jag senast var online, för att ha viss privacy."

### Texter
- "Som Texter vill jag kunna chatta med mina godkända vänner, så att jag kan hålla kontakten med dem."
- "Som Texter vill jag kunna trycka på en SOS-knapp om något känns fel, så att min förälder blir varnad direkt."
- "Som Texter vill jag kunna använda snabbmeddelanden för att berätta att jag är framme, utan att behöva skriva."

---

*Dokumentversion: 2.0*
*Senast uppdaterad: 2025-02-04*
*Författare: Erik + Claude*
