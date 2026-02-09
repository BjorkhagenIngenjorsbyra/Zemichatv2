# Privatlivspolitik – Zemichat

**Sidst opdateret:** 2026-02-09

---

## 1. Indledning

Denne privatlivspolitik beskriver, hvordan Zemichat ("vi", "os", "vores") indsamler, bruger og beskytter dine personoplysninger, når du bruger vores app og tjenester.

Zemichat er en familievenlig chatapp med en indbygget transparensmodel, der giver forældre og værger indsigt i deres børns kommunikation. Vi tager dit privatliv alvorligt og behandler alle data i overensstemmelse med EU's databeskyttelsesforordning (GDPR).

**Dataansvarlig:**
Zemichat
E-mail: support@zemichat.com

Har du spørgsmål om, hvordan vi håndterer dine personoplysninger, er du velkommen til at kontakte os.

---

## 2. Hvilke data vi indsamler

### 2.1 Kontooplysninger

| Data | Beskrivelse |
|------|-------------|
| E-mailadresse | Bruges til login og kontokommunikation (Owner og Super) |
| Visningsnavn | Det navn, du vælger at vise i appen |
| Profilbillede | Valgfrit billede, der vises på din profil |
| Statusbesked | Valgfri tekst, der vises for andre brugere |
| Zemi-nummer | Unikt identifikationsnummer (format: ZEMI-XXX-XXX) |
| Rolle | Din rolle i teamet: Owner, Super eller Texter |

**Texters (børn)** logger ikke ind med e-mail. De bruger i stedet et Zemi-nummer og en adgangskode, der oprettes af Team Owner.

### 2.2 Beskeder og medier

| Data | Beskrivelse |
|------|-------------|
| Tekstbeskeder | Indholdet af de beskeder, du sender |
| Billeder og video | Medier, der deles i chats |
| Talebeskeder | Indspillede lydbeskeder |
| Dokumenter | Filer, der deles i chats |
| Redigeringshistorik | Hvis du redigerer en besked, gemmes det originale indhold |
| Læsekvitteringer | Information om, hvornår en besked er læst |
| Reaktioner | Emoji-reaktioner på beskeder |

**Vigtigt:** Når en bruger sletter en besked, udføres en såkaldt "soft delete". Beskeden markeres som slettet, men findes stadig i databasen. Dette er en del af transparensmodellen – Team Owner kan stadig se, at en besked blev sendt og slettet.

### 2.3 Placeringsdata

Vi indsamler **ikke** placeringsdata løbende. Placeringsdata gemmes **kun** i følgende tilfælde:

- **SOS-alarmer:** Hvis en Texter sender en SOS-alarm, inkluderes den aktuelle position, så forælderen hurtigt kan lokalisere barnet.
- **Placeringsdeling i chat:** Hvis en bruger aktivt vælger at dele sin placering i en besked (kræver, at funktionen er aktiveret i Texter-indstillinger).

### 2.4 Enhedsinformation

| Data | Beskrivelse |
|------|-------------|
| Push-token | En unik identifikator, der gør, at vi kan sende push-notifikationer til din enhed |
| Platform | Hvilken type enhed du bruger (iOS, Android, Web) |
| Enhedsnavn | Navnet på din enhed (vises i sessionshåndtering) |
| IP-adresse | Registreres ved login til sessionshåndtering |

### 2.5 Betalings- og abonnementsdata

| Data | Beskrivelse |
|------|-------------|
| Abonnementsplan | Hvilken plan dit team har (free, basic, family, premium) |
| Prøveperiode | Startdato og udløbsdato for prøveperioden |

Vi håndterer **ingen** kreditkortoplysninger eller betalingsdetaljer direkte. Al betalingshåndtering sker via RevenueCat og den relevante appbutik (App Store/Google Play).

---

## 3. Hvorfor vi indsamler data

Vi indsamler kun data, der er nødvendig for, at appen kan fungere. Her er formålet med hver kategori:

| Datakategori | Formål | Retsgrundlag (GDPR) |
|--------------|--------|---------------------|
| Kontooplysninger | Oprette og administrere din konto, identificere dig i appen | Kontrakt (art. 6.1b) |
| Beskeder og medier | Levere chatfunktionaliteten – at du kan sende og modtage beskeder | Kontrakt (art. 6.1b) |
| Redigeringshistorik | Transparens – Team Owner kan se ændringer i Texters beskeder | Legitim interesse (art. 6.1f) |
| Placeringsdata (SOS) | Børnesikkerhed – hjælpe forældre med at lokalisere deres barn i en nødsituation | Legitim interesse (art. 6.1f) |
| Enhedsinformation | Sende push-notifikationer og administrere aktive sessioner | Samtykke (art. 6.1a) |
| Texter-indstillinger | Forældrekontrol – lade Team Owner styre, hvilke funktioner barnet har adgang til | Legitim interesse/Samtykke (art. 6.1f/a) |
| Vennerelationer | Social funktionalitet – håndtere kontakter og venneanmodninger | Kontrakt (art. 6.1b) |
| Opkaldslogger | Opkaldshistorik – vise tidligere opkald | Kontrakt (art. 6.1b) |
| Abonnementsdata | Administrere dit abonnement og adgang til funktioner | Kontrakt (art. 6.1b) |
| Rapporter | Sikkerhed og moderering – håndtere anmeldelser | Legitim interesse (art. 6.1f) |
| Anonymiseret sletningslog | Juridisk sporbarhed ved kontosletning | Legitim interesse (art. 6.1f) |

---

## 4. Hvordan vi beskytter dine data

### 4.1 Kryptering

- Al kommunikation mellem din enhed og vores servere sker via **HTTPS/TLS** (krypteret overførsel).
- Databasen bruger kryptering i hvile (encryption at rest).
- Adgangskoder gemmes som krypterede hashes – vi kan aldrig se din adgangskode i klartekst.

### 4.2 Adgangskontrol (Row Level Security)

Vi bruger **Row Level Security (RLS)** i databasen. Det betyder, at enhver databaseforespørgsel kontrolleres mod strenge regler, der sikrer, at:

- Du kun kan se data, der tilhører dit team.
- Texters kun kan se deres egne chats og venner.
- Team Owner kan se Texters chats (transparensmodellen), men **ikke** private chats mellem voksne (Supers), hvor ingen Texter deltager.
- Ingen kan få adgang til data fra andre teams.

### 4.3 Sikker opbevaring

- Al data opbevares hos **Supabase** på servere inden for **EU** (Den Europæiske Union).
- Mediefiler (billeder, video, dokumenter) opbevares i Supabase Storage med adgangskontrol.
- Midlertidig data (som opkaldssignaler) ryddes automatisk efter kort tid.

### 4.4 Sikkerhedsfunktioner i appen

- Sikre autentificeringsflows via Supabase Auth.
- Alle følsomme databaseoperationer (kontosletning, invitationer) køres som sikre serverfunktioner (SECURITY DEFINER), der ikke kan manipuleres fra klientsiden.
- Sessionshåndtering med mulighed for at se og afslutte aktive sessioner.

---

## 5. Tredjeparter

Vi deler aldrig dine data med tredjeparter i markedsføringsøjemed. Følgende tjenesteudbydere bruges for, at appen kan fungere:

### 5.1 Supabase (database og infrastruktur)

- **Hvad:** Al appdata opbevares hos Supabase – database, filopbevaring og autentificering.
- **Hvor:** EU-baserede servere.
- **Data:** Al data, der beskrives i denne politik.
- **Privatlivspolitik:** [https://supabase.com/privacy](https://supabase.com/privacy)

### 5.2 Agora (tale- og videoopkald)

- **Hvad:** Agora håndterer lyd- og videostrømme for opkald i appen.
- **Hvor:** Globalt distribueret netværk.
- **Data:** Lyd- og videostrømme i realtid. **Opkald optages ikke**, og ingen data opbevares permanent hos Agora.
- **Privatlivspolitik:** [https://www.agora.io/en/privacy-policy](https://www.agora.io/en/privacy-policy)

### 5.3 RevenueCat (betalinger og abonnementer)

- **Hvad:** RevenueCat håndterer abonnementer og køb via App Store og Google Play.
- **Hvor:** USA (Privacy Shield / Standard Contractual Clauses).
- **Data:** Anonymiseret købs-ID og abonnementsplan. RevenueCat har **ingen** adgang til dine personoplysninger, beskeder eller chatindhold.
- **Privatlivspolitik:** [https://www.revenuecat.com/privacy](https://www.revenuecat.com/privacy)

### 5.4 Firebase Cloud Messaging (push-notifikationer, Android)

- **Hvad:** Sender push-notifikationer til Android-enheder.
- **Data:** Push-token og enheds-ID.
- **Privatlivspolitik:** [https://firebase.google.com/support/privacy](https://firebase.google.com/support/privacy)

### 5.5 Apple Push Notification Service (push-notifikationer, iOS)

- **Hvad:** Sender push-notifikationer til Apple-enheder.
- **Data:** Push-token og enheds-ID.
- **Privatlivspolitik:** [https://www.apple.com/legal/privacy](https://www.apple.com/legal/privacy)

---

## 6. Børns privatliv

Zemichat er designet til brug af familier, herunder børn. Vi tager børns privatliv ekstra alvorligt.

### 6.1 Hvordan Zemichat fungerer for børn

Børn bruger appen med rollen **Texter**. En Texter:

- Oprettes af en forælder/værge (Team Owner).
- Logger ind med et Zemi-nummer og en adgangskode – **ingen e-mailadresse kræves**.
- Har begrænset funktionalitet, der styres af Team Owner.
- Kan ikke selv godkende venneanmodninger – dette gør Team Owner.

### 6.2 Forældretilsyn (transparensmodellen)

Team Owner har fuld indsigt i Texters kommunikation. Det betyder, at:

- Team Owner kan læse alle beskeder, som Texters sender og modtager.
- Team Owner kan se slettede beskeder (markeret som slettet, men ikke fjernet).
- Team Owner kan se redigeringshistorik.
- Team Owner godkender alle venneanmodninger.
- Team Owner kan deaktivere specifikke funktioner (billeder, video, opkald osv.) per Texter.

Denne transparens er en grundlæggende del af tjenesten og findes for at beskytte børnene.

### 6.3 Private chats mellem voksne

Chats mellem voksne brugere (Supers), hvor **ingen Texter deltager**, er private og kan **ikke** ses af Team Owner. Denne adskillelse håndhæves teknisk via databasesikkerhedsregler.

### 6.4 Samtykke

Ved at oprette en Texter-profil for et barn bekræfter Team Owner, at de er barnets forælder eller værge og har ret til at give samtykke til barnets brug af tjenesten, i overensstemmelse med GDPR artikel 8.

---

## 7. Dine rettigheder

I henhold til GDPR har du følgende rettigheder:

### 7.1 Ret til indsigt (art. 15)

Du har ret til at vide, hvilke data vi har om dig. I appen kan du eksportere al din data via **Indstillinger > Download mine data**. Du får en struktureret JSON-fil med alle dine personoplysninger.

### 7.2 Ret til dataportabilitet (art. 20)

Dine data eksporteres i et struktureret, maskinlæsbart format (JSON), som du kan tage med dig til en anden tjeneste.

### 7.3 Ret til sletning (art. 17)

Du har ret til at slette din konto og alle tilhørende data:

- **Team Owner** kan slette hele teamet (inklusive alle medlemmer og al data) via **Indstillinger > Slet konto**.
- Ved sletning fjernes al data: profiler, beskeder, mediefiler, vennerelationer, opkaldslogger og alle andre personoplysninger.
- En anonymiseret logpost beholdes af hensyn til juridisk sporbarhed. Denne indeholder ingen personoplysninger – kun en SHA-256-hash af teamnavnet og antallet af medlemmer.

### 7.4 Ret til berigtigelse (art. 16)

Du kan opdatere dine profiloplysninger (navn, profilbillede, statusbesked) direkte i appen via Indstillinger.

### 7.5 Ret til at klage

Hvis du mener, at vi håndterer dine personoplysninger forkert, har du ret til at klage til:

**Datatilsynet**
Carl Jacobsens Vej 35, 2500 Valby
E-mail: dt@datatilsynet.dk
Web: [https://www.datatilsynet.dk](https://www.datatilsynet.dk)

---

## 8. Cookies og sporing

Zemichat bruger **ingen cookies** til sporing eller markedsføring.

Vi bruger **ingen** analyse- eller sporingstjeneste (som Google Analytics, Facebook Pixel eller lignende).

Den eneste lokale lagring, vi bruger, er:

- **Autentificeringstoken** – for at holde dig logget ind mellem sessioner.
- **Sprogindstilling** – for at huske dit valgte sprog.
- **Onboarding-status** – for at vide, om du har fuldført introduktionsguiden.

Disse data gemmes lokalt på din enhed og sendes aldrig til nogen tredjepart.

---

## 9. Opbevaringstid

| Data | Opbevaringstid |
|------|----------------|
| Kontooplysninger | Indtil kontoen slettes |
| Beskeder og medier | Indtil kontoen slettes |
| Opkaldslogger | Indtil kontoen slettes |
| Opkaldssignaler (ring/afvis) | Kort tid – ryddes automatisk |
| Push-tokens | Indtil kontoen slettes eller token afregistreres |
| Sessioner | Indtil kontoen slettes |
| Anonymiseret sletningslog | Permanent (indeholder ingen personoplysninger) |

---

## 10. Ændringer i denne politik

Vi kan opdatere denne privatlivspolitik efter behov, f.eks. ved nye funktioner eller ændret lovgivning. Ved væsentlige ændringer:

- Giver vi dig besked via appen eller e-mail.
- Opdaterer vi datoen for seneste opdatering øverst i politikken.
- Kan vi bede om nyt samtykke, hvis ændringerne kræver det.

Vi anbefaler, at du regelmæssigt læser denne politik igennem.

---

## 11. Kontakt

Har du spørgsmål om denne privatlivspolitik, eller hvordan vi håndterer dine personoplysninger? Kontakt os:

**E-mail:** support@zemichat.com

Vi svarer normalt inden for 30 dage på henvendelser vedrørende dine rettigheder i henhold til GDPR.

---

*Denne privatlivspolitik gælder fra 2026-02-09.*
