# Integritetspolicy – Zemichat

**Senast uppdaterad:** 2026-02-09

---

## 1. Inledning

Denna integritetspolicy beskriver hur Zemichat ("vi", "oss", "vår") samlar in, använder och skyddar dina personuppgifter när du använder vår app och våra tjänster.

Zemichat är en familjevänlig chattapp med en inbyggd transparensmodell som ger föräldrar och vårdnadshavare insyn i sina barns kommunikation. Vi tar din integritet på allvar och behandlar all data i enlighet med EU:s dataskyddsförordning (GDPR).

**Personuppgiftsansvarig:**
Zemichat
E-post: support@zemichat.com

Om du har frågor om hur vi hanterar dina personuppgifter är du välkommen att kontakta oss.

---

## 2. Vilken data vi samlar in

### 2.1 Kontouppgifter

| Data | Beskrivning |
|------|-------------|
| E-postadress | Används för inloggning och kontokommunikation (Owner och Super) |
| Visningsnamn | Det namn du väljer att visa i appen |
| Profilbild | Valfri bild som visas i din profil |
| Statusmeddelande | Valfri text som visas för andra användare |
| Zemi-nummer | Unikt identifieringsnummer (format: ZEMI-XXX-XXX) |
| Roll | Din roll i teamet: Owner, Super eller Texter |

**Texters (barn)** loggar inte in med e-post. De använder istället ett Zemi-nummer och lösenord som skapas av Team Owner.

### 2.2 Meddelanden och media

| Data | Beskrivning |
|------|-------------|
| Textmeddelanden | Innehållet i de meddelanden du skickar |
| Bilder och video | Media som delas i chattar |
| Röstmeddelanden | Inspelade ljudmeddelanden |
| Dokument | Filer som delas i chattar |
| Redigeringshistorik | Om du redigerar ett meddelande sparas det ursprungliga innehållet |
| Läskvitton | Information om när ett meddelande har lästs |
| Reaktioner | Emoji-reaktioner på meddelanden |

**Viktigt:** När en användare raderar ett meddelande utförs en så kallad "soft delete". Meddelandet markeras som raderat men finns kvar i databasen. Detta är en del av transparensmodellen – Team Owner kan fortfarande se att ett meddelande har skickats och raderats.

### 2.3 Platsdata

Vi samlar **inte** in platsdata löpande. Platsdata sparas **enbart** i följande fall:

- **SOS-larm:** Om en Texter skickar ett SOS-larm inkluderas aktuell position så att föräldern snabbt kan lokalisera barnet.
- **Platsdelning i chatt:** Om en användare aktivt väljer att dela sin plats i ett meddelande (kräver att funktionen är aktiverad i Texter-inställningar).

### 2.4 Enhetsinformation

| Data | Beskrivning |
|------|-------------|
| Push-token | En unik identifierare som gör att vi kan skicka pushnotiser till din enhet |
| Plattform | Vilken typ av enhet du använder (iOS, Android, Webb) |
| Enhetsnamn | Namn på din enhet (visas i sessionshantering) |
| IP-adress | Registreras vid inloggning för sessionshantering |

### 2.5 Betalnings- och prenumerationsdata

| Data | Beskrivning |
|------|-------------|
| Prenumerationsplan | Vilken plan ditt team har (free, basic, family, premium) |
| Provperiod | Startdatum och utgångsdatum för provperioden |

Vi hanterar **inga** kreditkortsuppgifter eller betalningsdetaljer direkt. All betalningshantering sker via RevenueCat och respektive appbutik (App Store/Google Play).

---

## 3. Varför vi samlar in data

Vi samlar bara in data som behövs för att appen ska fungera. Här är syftet med varje kategori:

| Datakategori | Syfte | Rättslig grund (GDPR) |
|--------------|-------|-----------------------|
| Kontouppgifter | Skapa och hantera ditt konto, identifiera dig i appen | Avtal (art. 6.1b) |
| Meddelanden och media | Leverera chattfunktionaliteten – att du kan skicka och ta emot meddelanden | Avtal (art. 6.1b) |
| Redigeringshistorik | Transparens – Team Owner kan se ändringar i Texters meddelanden | Berättigat intresse (art. 6.1f) |
| Platsdata (SOS) | Barnsäkerhet – hjälpa föräldrar att lokalisera sitt barn vid nödsituation | Berättigat intresse (art. 6.1f) |
| Enhetsinformation | Skicka pushnotiser och hantera aktiva sessioner | Samtycke (art. 6.1a) |
| Texter-inställningar | Föräldrakontroll – låta Team Owner styra vilka funktioner barnet har tillgång till | Berättigat intresse/Samtycke (art. 6.1f/a) |
| Vänrelationer | Social funktionalitet – hantera kontakter och vänförfrågningar | Avtal (art. 6.1b) |
| Samtalsloggar | Samtalshistorik – visa tidigare samtal | Avtal (art. 6.1b) |
| Prenumerationsdata | Hantera din prenumeration och tillgång till funktioner | Avtal (art. 6.1b) |
| Rapporter | Säkerhet och moderering – hantera anmälningar | Berättigat intresse (art. 6.1f) |
| Anonymiserad raderingslogg | Juridisk spårbarhet vid kontoradering | Berättigat intresse (art. 6.1f) |

---

## 4. Hur vi skyddar din data

### 4.1 Kryptering

- All kommunikation mellan din enhet och våra servrar sker via **HTTPS/TLS** (krypterad överföring).
- Databasen använder kryptering i vila (encryption at rest).
- Lösenord lagras som krypterade hashar – vi kan aldrig se ditt lösenord i klartext.

### 4.2 Åtkomstkontroll (Row Level Security)

Vi använder **Row Level Security (RLS)** i databasen. Det innebär att varje databasförfrågan kontrolleras mot strikta regler som säkerställer att:

- Du bara kan se data som tillhör ditt team.
- Texters bara kan se sina egna chattar och vänner.
- Team Owner kan se Texters chattar (transparensmodellen) men **inte** privata chattar mellan vuxna (Supers) där ingen Texter deltar.
- Ingen kan komma åt data från andra team.

### 4.3 Säker lagring

- All data lagras hos **Supabase** på servrar inom **EU** (Europeiska unionen).
- Mediafiler (bilder, video, dokument) lagras i Supabase Storage med åtkomstkontroll.
- Temporär data (som samtalssignaler) rensas automatiskt efter kort tid.

### 4.4 Säkerhetsfunktioner i appen

- Säkra autentiseringsflöden via Supabase Auth.
- Alla känsliga databasoperationer (kontoradering, inbjudningar) körs som säkra serverfunktioner (SECURITY DEFINER) som inte kan manipuleras från klientsidan.
- Sessionshantering med möjlighet att se och avsluta aktiva sessioner.

---

## 5. Tredjeparter

Vi delar aldrig din data med tredjeparter i marknadsföringssyfte. Följande tjänsteleverantörer används för att appen ska fungera:

### 5.1 Supabase (databas och infrastruktur)

- **Vad:** All appdata lagras hos Supabase – databas, fillagring och autentisering.
- **Var:** EU-baserade servrar.
- **Data:** All data som beskrivs i denna policy.
- **Integritetspolicy:** [https://supabase.com/privacy](https://supabase.com/privacy)

### 5.2 Agora (röst- och videosamtal)

- **Vad:** Agora hanterar ljud- och videoströmmar för samtal i appen.
- **Var:** Globalt distribuerat nätverk.
- **Data:** Ljud- och videoströmmar i realtid. **Samtalen spelas inte in** och ingen data lagras permanent hos Agora.
- **Integritetspolicy:** [https://www.agora.io/en/privacy-policy](https://www.agora.io/en/privacy-policy)

### 5.3 RevenueCat (betalningar och prenumerationer)

- **Vad:** RevenueCat hanterar prenumerationer och köp via App Store och Google Play.
- **Var:** USA (Privacy Shield / Standard Contractual Clauses).
- **Data:** Anonymiserat köp-ID och prenumerationsplan. RevenueCat har **ingen** tillgång till dina personuppgifter, meddelanden eller chattinnehåll.
- **Integritetspolicy:** [https://www.revenuecat.com/privacy](https://www.revenuecat.com/privacy)

### 5.4 Firebase Cloud Messaging (pushnotiser, Android)

- **Vad:** Skickar pushnotiser till Android-enheter.
- **Data:** Push-token och enhets-ID.
- **Integritetspolicy:** [https://firebase.google.com/support/privacy](https://firebase.google.com/support/privacy)

### 5.5 Apple Push Notification Service (pushnotiser, iOS)

- **Vad:** Skickar pushnotiser till Apple-enheter.
- **Data:** Push-token och enhets-ID.
- **Integritetspolicy:** [https://www.apple.com/legal/privacy](https://www.apple.com/legal/privacy)

---

## 6. Barns integritet

Zemichat är utformat för att användas av familjer, inklusive barn. Vi tar barns integritet extra allvarligt.

### 6.1 Hur Zemichat fungerar för barn

Barn använder appen med rollen **Texter**. En Texter:

- Skapas av en förälder/vårdnadshavare (Team Owner).
- Loggar in med ett Zemi-nummer och lösenord – **ingen e-postadress krävs**.
- Har begränsad funktionalitet som styrs av Team Owner.
- Kan inte själv godkänna vänförfrågningar – detta gör Team Owner.

### 6.2 Föräldraövervakning (transparensmodellen)

Team Owner har full insyn i Texters kommunikation. Det innebär att:

- Team Owner kan läsa alla meddelanden som Texters skickar och tar emot.
- Team Owner kan se raderade meddelanden (markerade som raderade men inte borttagna).
- Team Owner kan se redigeringshistorik.
- Team Owner godkänner alla vänförfrågningar.
- Team Owner kan stänga av specifika funktioner (bilder, video, samtal etc.) per Texter.

Denna transparens är en grundläggande del av tjänsten och finns för att skydda barnen.

### 6.3 Privata chattar mellan vuxna

Chattar mellan vuxna användare (Supers) där **ingen Texter deltar** är privata och kan **inte** ses av Team Owner. Denna åtskillnad säkerställs tekniskt via databassäkerhetsregler.

### 6.4 Samtycke

Genom att skapa en Texter-profil för ett barn bekräftar Team Owner att de är barnets förälder eller vårdnadshavare och har rätt att ge samtycke för barnets användning av tjänsten, i enlighet med GDPR artikel 8.

---

## 7. Dina rättigheter

Enligt GDPR har du följande rättigheter:

### 7.1 Rätt till tillgång (art. 15)

Du har rätt att veta vilken data vi har om dig. I appen kan du exportera all din data via **Inställningar > Ladda ner min data**. Du får en strukturerad JSON-fil med all din persondata.

### 7.2 Rätt till dataportabilitet (art. 20)

Din data exporteras i ett strukturerat, maskinläsbart format (JSON) som du kan ta med dig till en annan tjänst.

### 7.3 Rätt till radering (art. 17)

Du har rätt att radera ditt konto och all tillhörande data:

- **Team Owner** kan radera hela teamet (inklusive alla medlemmar och all data) via **Inställningar > Radera konto**.
- Vid radering tas all data bort: profiler, meddelanden, mediafiler, vänrelationer, samtalsloggar och alla andra personuppgifter.
- En anonymiserad loggpost sparas för juridisk spårbarhet. Denna innehåller inga personuppgifter – bara en SHA-256-hash av teamnamnet och antalet medlemmar.

### 7.4 Rätt till rättelse (art. 16)

Du kan uppdatera din profilinformation (namn, profilbild, statusmeddelande) direkt i appen via Inställningar.

### 7.5 Rätt att klaga

Om du anser att vi hanterar dina personuppgifter felaktigt har du rätt att lämna klagomål till:

**Integritetsskyddsmyndigheten (IMY)**
Box 8114, 104 20 Stockholm
E-post: imy@imy.se
Webb: [https://www.imy.se](https://www.imy.se)

---

## 8. Cookies och spårning

Zemichat använder **inga cookies** för spårning eller marknadsföring.

Vi använder **ingen** analys- eller spårningstjänst (som Google Analytics, Facebook Pixel eller liknande).

Den enda lokala lagringen vi använder är:

- **Autentiseringstoken** – för att hålla dig inloggad mellan sessioner.
- **Språkinställning** – för att komma ihåg ditt valda språk.
- **Onboarding-status** – för att veta om du har slutfört introduktionsguiden.

Denna data lagras lokalt på din enhet och skickas aldrig till tredje part.

---

## 9. Lagringstid

| Data | Lagringstid |
|------|-------------|
| Kontouppgifter | Tills kontot raderas |
| Meddelanden och media | Tills kontot raderas |
| Samtalsloggar | Tills kontot raderas |
| Samtalssignaler (ring/avböj) | Kort tid – rensas automatiskt |
| Push-tokens | Tills kontot raderas eller token avregistreras |
| Sessioner | Tills kontot raderas |
| Anonymiserad raderingslogg | Permanent (innehåller inga personuppgifter) |

---

## 10. Ändringar i denna policy

Vi kan uppdatera denna integritetspolicy vid behov, exempelvis vid nya funktioner eller ändrad lagstiftning. Vid väsentliga ändringar:

- Meddelar vi dig via appen eller e-post.
- Anger vi datum för senaste uppdatering högst upp i policyn.
- Kan vi be om nytt samtycke om ändringarna kräver det.

Vi rekommenderar att du regelbundet läser igenom denna policy.

---

## 11. Kontakt

Har du frågor om denna integritetspolicy eller hur vi hanterar dina personuppgifter? Kontakta oss:

**E-post:** support@zemichat.com

Vi svarar normalt inom 30 dagar på förfrågningar som rör dina rättigheter enligt GDPR.

---

*Denna integritetspolicy gäller från 2026-02-09.*
