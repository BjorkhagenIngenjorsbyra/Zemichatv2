# Personvernerklæring – Zemichat

**Sist oppdatert:** 2026-02-09

---

## 1. Innledning

Denne personvernerklæringen beskriver hvordan Zemichat ("vi", "oss", "vår") samler inn, bruker og beskytter dine personopplysninger når du bruker appen og tjenestene våre.

Zemichat er en familievennlig chatteapp med en innebygd transparensmodell som gir foreldre og foresatte innsyn i barnas kommunikasjon. Vi tar personvernet ditt på alvor og behandler all data i samsvar med EUs personvernforordning (GDPR).

**Behandlingsansvarlig:**
Zemichat
E-post: support@zemichat.com

Har du spørsmål om hvordan vi håndterer dine personopplysninger, er du velkommen til å kontakte oss.

---

## 2. Hvilke data vi samler inn

### 2.1 Kontoinformasjon

| Data | Beskrivelse |
|------|-------------|
| E-postadresse | Brukes til innlogging og kontokommunikasjon (Owner og Super) |
| Visningsnavn | Navnet du velger å vise i appen |
| Profilbilde | Valgfritt bilde som vises på profilen din |
| Statusmelding | Valgfri tekst som vises for andre brukere |
| Zemi-nummer | Unikt identifikasjonsnummer (format: ZEMI-XXX-XXX) |
| Rolle | Din rolle i teamet: Owner, Super eller Texter |

**Texters (barn)** logger ikke inn med e-post. De bruker i stedet et Zemi-nummer og passord som opprettes av Team Owner.

### 2.2 Meldinger og media

| Data | Beskrivelse |
|------|-------------|
| Tekstmeldinger | Innholdet i meldingene du sender |
| Bilder og video | Media som deles i chatter |
| Talemeldinger | Innspilte lydmeldinger |
| Dokumenter | Filer som deles i chatter |
| Redigeringshistorikk | Hvis du redigerer en melding, lagres det opprinnelige innholdet |
| Lesebekreftelser | Informasjon om når en melding er lest |
| Reaksjoner | Emoji-reaksjoner på meldinger |

**Viktig:** Når en bruker sletter en melding, utføres en såkalt «soft delete». Meldingen markeres som slettet, men finnes fortsatt i databasen. Dette er en del av transparensmodellen – Team Owner kan fortsatt se at en melding ble sendt og slettet.

### 2.3 Posisjonsdata

Vi samler **ikke** inn posisjonsdata løpende. Posisjonsdata lagres **kun** i følgende tilfeller:

- **SOS-varsler:** Hvis en Texter sender et SOS-varsel, inkluderes nåværende posisjon slik at forelderen raskt kan lokalisere barnet.
- **Posisjonsdeling i chat:** Hvis en bruker aktivt velger å dele sin posisjon i en melding (krever at funksjonen er aktivert i Texter-innstillinger).

### 2.4 Enhetsinformasjon

| Data | Beskrivelse |
|------|-------------|
| Push-token | En unik identifikator som gjør at vi kan sende push-varsler til enheten din |
| Plattform | Hvilken type enhet du bruker (iOS, Android, Web) |
| Enhetsnavn | Navnet på enheten din (vises i sesjonshåndtering) |
| IP-adresse | Registreres ved innlogging for sesjonshåndtering |

### 2.5 Betalings- og abonnementsdata

| Data | Beskrivelse |
|------|-------------|
| Abonnementsplan | Hvilken plan teamet ditt har (free, basic, family, premium) |
| Prøveperiode | Startdato og utløpsdato for prøveperioden |

Vi håndterer **ingen** kredittkortopplysninger eller betalingsdetaljer direkte. All betalingshåndtering skjer via RevenueCat og den aktuelle appbutikken (App Store/Google Play).

---

## 3. Hvorfor vi samler inn data

Vi samler bare inn data som er nødvendig for at appen skal fungere. Her er formålet med hver kategori:

| Datakategori | Formål | Rettslig grunnlag (GDPR) |
|--------------|--------|--------------------------|
| Kontoinformasjon | Opprette og administrere kontoen din, identifisere deg i appen | Avtale (art. 6.1b) |
| Meldinger og media | Levere chattefunksjonaliteten – at du kan sende og motta meldinger | Avtale (art. 6.1b) |
| Redigeringshistorikk | Transparens – Team Owner kan se endringer i Texters meldinger | Berettiget interesse (art. 6.1f) |
| Posisjonsdata (SOS) | Barnesikkerhet – hjelpe foreldre med å lokalisere barnet sitt i en nødsituasjon | Berettiget interesse (art. 6.1f) |
| Enhetsinformasjon | Sende push-varsler og administrere aktive sesjoner | Samtykke (art. 6.1a) |
| Texter-innstillinger | Foreldrekontroll – la Team Owner styre hvilke funksjoner barnet har tilgang til | Berettiget interesse/Samtykke (art. 6.1f/a) |
| Vennerelasjoner | Sosial funksjonalitet – håndtere kontakter og venneforespørsler | Avtale (art. 6.1b) |
| Samtalelogger | Samtalehistorikk – vise tidligere samtaler | Avtale (art. 6.1b) |
| Abonnementsdata | Administrere abonnementet ditt og tilgang til funksjoner | Avtale (art. 6.1b) |
| Rapporter | Sikkerhet og moderering – håndtere anmeldelser | Berettiget interesse (art. 6.1f) |
| Anonymisert slettingslogg | Juridisk sporbarhet ved kontolesetting | Berettiget interesse (art. 6.1f) |

---

## 4. Hvordan vi beskytter dataene dine

### 4.1 Kryptering

- All kommunikasjon mellom enheten din og serverne våre skjer via **HTTPS/TLS** (kryptert overføring).
- Databasen bruker kryptering i hvile (encryption at rest).
- Passord lagres som krypterte hasher – vi kan aldri se passordet ditt i klartekst.

### 4.2 Tilgangskontroll (Row Level Security)

Vi bruker **Row Level Security (RLS)** i databasen. Det betyr at hver databaseforespørsel kontrolleres mot strenge regler som sikrer at:

- Du bare kan se data som tilhører ditt team.
- Texters bare kan se sine egne chatter og venner.
- Team Owner kan se Texters chatter (transparensmodellen), men **ikke** private chatter mellom voksne (Supers) der ingen Texter deltar.
- Ingen kan få tilgang til data fra andre team.

### 4.3 Sikker lagring

- All data lagres hos **Supabase** på servere innenfor **EU** (Den europeiske union).
- Mediefiler (bilder, video, dokumenter) lagres i Supabase Storage med tilgangskontroll.
- Midlertidig data (som samtalesignaler) ryddes automatisk etter kort tid.

### 4.4 Sikkerhetsfunksjoner i appen

- Sikre autentiseringsflyter via Supabase Auth.
- Alle sensitive databaseoperasjoner (kontolesetting, invitasjoner) kjøres som sikre serverfunksjoner (SECURITY DEFINER) som ikke kan manipuleres fra klientsiden.
- Sesjonshåndtering med mulighet til å se og avslutte aktive sesjoner.

---

## 5. Tredjeparter

Vi deler aldri dataene dine med tredjeparter i markedsføringsøyemed. Følgende tjenesteleverandører brukes for at appen skal fungere:

### 5.1 Supabase (database og infrastruktur)

- **Hva:** All appdata lagres hos Supabase – database, fillagring og autentisering.
- **Hvor:** EU-baserte servere.
- **Data:** All data som beskrives i denne erklæringen.
- **Personvernerklæring:** [https://supabase.com/privacy](https://supabase.com/privacy)

### 5.2 Agora (tale- og videosamtaler)

- **Hva:** Agora håndterer lyd- og videostrømmer for samtaler i appen.
- **Hvor:** Globalt distribuert nettverk.
- **Data:** Lyd- og videostrømmer i sanntid. **Samtalene tas ikke opp**, og ingen data lagres permanent hos Agora.
- **Personvernerklæring:** [https://www.agora.io/en/privacy-policy](https://www.agora.io/en/privacy-policy)

### 5.3 RevenueCat (betalinger og abonnementer)

- **Hva:** RevenueCat håndterer abonnementer og kjøp via App Store og Google Play.
- **Hvor:** USA (Privacy Shield / Standard Contractual Clauses).
- **Data:** Anonymisert kjøps-ID og abonnementsplan. RevenueCat har **ingen** tilgang til dine personopplysninger, meldinger eller chatteinnhold.
- **Personvernerklæring:** [https://www.revenuecat.com/privacy](https://www.revenuecat.com/privacy)

### 5.4 Firebase Cloud Messaging (push-varsler, Android)

- **Hva:** Sender push-varsler til Android-enheter.
- **Data:** Push-token og enhets-ID.
- **Personvernerklæring:** [https://firebase.google.com/support/privacy](https://firebase.google.com/support/privacy)

### 5.5 Apple Push Notification Service (push-varsler, iOS)

- **Hva:** Sender push-varsler til Apple-enheter.
- **Data:** Push-token og enhets-ID.
- **Personvernerklæring:** [https://www.apple.com/legal/privacy](https://www.apple.com/legal/privacy)

---

## 6. Barns personvern

Zemichat er designet for bruk av familier, inkludert barn. Vi tar barns personvern ekstra alvorlig.

### 6.1 Hvordan Zemichat fungerer for barn

Barn bruker appen med rollen **Texter**. En Texter:

- Opprettes av en forelder/foresatt (Team Owner).
- Logger inn med et Zemi-nummer og passord – **ingen e-postadresse kreves**.
- Har begrenset funksjonalitet som styres av Team Owner.
- Kan ikke selv godkjenne venneforespørsler – dette gjør Team Owner.

### 6.2 Foreldretilsyn (transparensmodellen)

Team Owner har full innsikt i Texters kommunikasjon. Det betyr at:

- Team Owner kan lese alle meldinger som Texters sender og mottar.
- Team Owner kan se slettede meldinger (markert som slettet, men ikke fjernet).
- Team Owner kan se redigeringshistorikk.
- Team Owner godkjenner alle venneforespørsler.
- Team Owner kan deaktivere spesifikke funksjoner (bilder, video, samtaler osv.) per Texter.

Denne transparensen er en grunnleggende del av tjenesten og finnes for å beskytte barna.

### 6.3 Private chatter mellom voksne

Chatter mellom voksne brukere (Supers) der **ingen Texter deltar**, er private og kan **ikke** ses av Team Owner. Dette skillet håndheves teknisk via databasesikkerhetsregler.

### 6.4 Samtykke

Ved å opprette en Texter-profil for et barn bekrefter Team Owner at de er barnets forelder eller foresatt og har rett til å gi samtykke for barnets bruk av tjenesten, i samsvar med GDPR artikkel 8.

---

## 7. Dine rettigheter

I henhold til GDPR har du følgende rettigheter:

### 7.1 Rett til innsyn (art. 15)

Du har rett til å vite hvilke data vi har om deg. I appen kan du eksportere all din data via **Innstillinger > Last ned mine data**. Du får en strukturert JSON-fil med alle dine personopplysninger.

### 7.2 Rett til dataportabilitet (art. 20)

Dataene dine eksporteres i et strukturert, maskinlesbart format (JSON) som du kan ta med deg til en annen tjeneste.

### 7.3 Rett til sletting (art. 17)

Du har rett til å slette kontoen din og alle tilhørende data:

- **Team Owner** kan slette hele teamet (inkludert alle medlemmer og all data) via **Innstillinger > Slett konto**.
- Ved sletting fjernes all data: profiler, meldinger, mediefiler, vennerelasjoner, samtalelogger og alle andre personopplysninger.
- En anonymisert loggpost beholdes for juridisk sporbarhet. Denne inneholder ingen personopplysninger – bare en SHA-256-hash av teamnavnet og antall medlemmer.

### 7.4 Rett til retting (art. 16)

Du kan oppdatere profilinformasjonen din (navn, profilbilde, statusmelding) direkte i appen via Innstillinger.

### 7.5 Rett til å klage

Hvis du mener at vi håndterer dine personopplysninger feil, har du rett til å klage til:

**Datatilsynet**
Postboks 458 Sentrum, 0105 Oslo
E-post: postkasse@datatilsynet.no
Nett: [https://www.datatilsynet.no](https://www.datatilsynet.no)

---

## 8. Informasjonskapsler og sporing

Zemichat bruker **ingen informasjonskapsler** (cookies) for sporing eller markedsføring.

Vi bruker **ingen** analyse- eller sporingstjeneste (som Google Analytics, Facebook Pixel eller lignende).

Den eneste lokale lagringen vi bruker er:

- **Autentiseringstoken** – for å holde deg innlogget mellom sesjoner.
- **Språkinnstilling** – for å huske det valgte språket ditt.
- **Onboarding-status** – for å vite om du har fullført introduksjonsguiden.

Disse dataene lagres lokalt på enheten din og sendes aldri til noen tredjepart.

---

## 9. Lagringstid

| Data | Lagringstid |
|------|-------------|
| Kontoinformasjon | Til kontoen slettes |
| Meldinger og media | Til kontoen slettes |
| Samtalelogger | Til kontoen slettes |
| Samtalesignaler (ring/avslå) | Kort tid – ryddes automatisk |
| Push-tokens | Til kontoen slettes eller token avregistreres |
| Sesjoner | Til kontoen slettes |
| Anonymisert slettingslogg | Permanent (inneholder ingen personopplysninger) |

---

## 10. Endringer i denne erklæringen

Vi kan oppdatere denne personvernerklæringen ved behov, for eksempel ved nye funksjoner eller endret lovgivning. Ved vesentlige endringer:

- Varsler vi deg via appen eller e-post.
- Oppdaterer vi datoen for siste oppdatering øverst i erklæringen.
- Kan vi be om nytt samtykke hvis endringene krever det.

Vi anbefaler at du jevnlig leser gjennom denne erklæringen.

---

## 11. Kontakt

Har du spørsmål om denne personvernerklæringen eller hvordan vi håndterer dine personopplysninger? Kontakt oss:

**E-post:** support@zemichat.com

Vi svarer normalt innen 30 dager på henvendelser som gjelder dine rettigheter i henhold til GDPR.

---

*Denne personvernerklæringen gjelder fra 2026-02-09.*
