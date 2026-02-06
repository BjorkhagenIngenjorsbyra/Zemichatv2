# Zemi Family Chat — Design System

> Denna fil dokumenterar det kompletta designsystemet extraherat från den befintliga kodbasen.
> Alla värden ska återanvändas i nya versionen för visuell konsistens.

---

## 1. Färgpalett

### Grundfärger (HSL-format, mörkt tema)

| Token                  | HSL                  | Hex (approx) | Användning                  |
|------------------------|----------------------|--------------|------------------------------|
| `--background`         | `220 50% 7%`        | `#0B1221`    | Sidans bakgrund              |
| `--foreground`         | `210 40% 98%`       | `#F8FAFC`    | Primär textfärg              |
| `--card`               | `220 39% 11%`       | `#111827`    | Kortbakgrund                 |
| `--card-foreground`    | `210 40% 98%`       | `#F8FAFC`    | Text på kort                 |
| `--popover`            | `220 39% 11%`       | `#111827`    | Popover-bakgrund             |
| `--popover-foreground` | `210 40% 98%`       | `#F8FAFC`    | Text i popover               |

### Primärfärg (Lila/Amethyst)

| Token                    | HSL              | Hex (approx) | Användning                  |
|--------------------------|------------------|--------------|------------------------------|
| `--primary`              | `258 90% 80%`   | `#A78BFA`    | Knappar, skickade bubblor    |
| `--primary-foreground`   | `220 50% 7%`    | `#0B1221`    | Text på primärfärg           |

### Sekundär- och accentfärg (Mint)

| Token                      | HSL              | Hex (approx) | Användning                 |
|----------------------------|------------------|--------------|------------------------------|
| `--secondary`              | `142 76% 36%`   | `#10B981`    | Sekundära knappar            |
| `--secondary-foreground`   | `210 40% 98%`   | `#F8FAFC`    | Text på sekundär             |
| `--accent`                 | `142 76% 36%`   | `#10B981`    | Accentfärg, hover-states     |
| `--accent-foreground`      | `220 50% 7%`    | `#0B1221`    | Text på accent               |

### Neutrala färger

| Token                  | HSL              | Hex (approx) | Användning                  |
|------------------------|------------------|--------------|------------------------------|
| `--muted`              | `215 16% 47%`   | `#94A3B8`    | Dämpad bakgrund              |
| `--muted-foreground`   | `215 16% 70%`   | `#A0AEC0`    | Sekundär text, platshållare  |
| `--border`             | `215 25% 27%`   | `#1E293B`    | Ramar, avdelare              |
| `--input`              | `215 25% 27%`   | `#1E293B`    | Inmatningsfält-ram           |
| `--ring`               | `258 90% 80%`   | `#A78BFA`    | Fokusring                    |

### Destruktiv (Fel/Varning)

| Token                        | HSL            | Hex (approx) | Användning        |
|------------------------------|----------------|--------------|---------------------|
| `--destructive`              | `0 72% 65%`   | `#FF6B6B`    | Felknappar, varning |
| `--destructive-foreground`   | `0 0% 100%`   | `#FFFFFF`    | Text på destruktiv  |

### Chattbubblor

| Token                         | HSL              | Hex (approx) | Användning          |
|-------------------------------|------------------|--------------|----------------------|
| `--bubble-sent`               | `258 90% 80%`   | `#A78BFA`    | Skickade meddelanden |
| `--bubble-sent-foreground`    | `220 50% 7%`    | `#0B1221`    | Text i skickade      |
| `--bubble-received`           | `215 25% 27%`   | `#1E293B`    | Mottagna meddelanden |
| `--bubble-received-foreground`| `210 40% 98%`   | `#F8FAFC`    | Text i mottagna      |

### Pastellpalett (Avatarer)

| Token              | HSL              | Hex (approx) | Användning         |
|--------------------|------------------|--------------|---------------------|
| `--pastel-pink`    | `350 80% 80%`   | `#F2A0A0`    | Avatar-bakgrund     |
| `--pastel-blue`    | `200 80% 80%`   | `#99D6F2`    | Avatar-bakgrund     |
| `--pastel-green`   | `140 60% 75%`   | `#8CD9A8`    | Avatar-bakgrund     |
| `--pastel-yellow`  | `45 90% 80%`    | `#F5D98A`    | Avatar-bakgrund     |
| `--pastel-purple`  | `270 70% 80%`   | `#C4A0E6`    | Avatar-bakgrund     |
| `--pastel-orange`  | `25 90% 75%`    | `#F0A66B`    | Avatar-bakgrund     |

### Sidebar

| Token                            | HSL              | Hex (approx) |
|----------------------------------|------------------|--------------|
| `--sidebar-background`           | `220 50% 7%`    | `#0B1221`    |
| `--sidebar-foreground`           | `210 40% 98%`   | `#F8FAFC`    |
| `--sidebar-primary`              | `258 90% 80%`   | `#A78BFA`    |
| `--sidebar-primary-foreground`   | `220 50% 7%`    | `#0B1221`    |
| `--sidebar-accent`               | `215 25% 27%`   | `#1E293B`    |
| `--sidebar-accent-foreground`    | `210 40% 98%`   | `#F8FAFC`    |
| `--sidebar-border`               | `215 25% 27%`   | `#1E293B`    |
| `--sidebar-ring`                 | `258 90% 80%`   | `#A78BFA`    |

### Kategoribadge-färger

| Kategori   | Bakgrund (dark)               | Textfärg          |
|------------|-------------------------------|--------------------|
| Family     | `bg-orange-900/30`            | `text-orange-600`  |
| Friend     | `bg-blue-900/30`              | `text-blue-600`    |
| Classmate  | `bg-green-900/30`             | `text-green-600`   |
| Team       | `bg-purple-900/30`            | `text-purple-600`  |
| Others     | `bg-gray-800/30`              | `text-gray-600`    |

---

## 2. Typografi

### Typsnittsfamilj

```css
font-family: 'Outfit', 'Manrope', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
```

Importerat via `@fontsource/nunito` (paketnamn), renderat som **Outfit**.

### Tillgängliga vikter

| Vikt | Namn         | Tailwind-klass  | Användning                     |
|------|--------------|-----------------|----------------------------------|
| 200  | Extra Light  | —               | Tillgänglig                      |
| 300  | Light        | `font-light`    | Tillgänglig                      |
| 400  | Regular      | `font-normal`   | Brödtext, platshållartext        |
| 500  | Medium       | `font-medium`   | Etiketter, badges                |
| 600  | Semibold     | `font-semibold` | Sekundära rubriker, korttitlar   |
| 700  | Bold         | `font-bold`     | Primära rubriker, knappar        |
| 800  | Extra Bold   | —               | Tillgänglig                      |
| 900  | Black        | —               | Tillgänglig                      |

### Textstorlekar

| Tailwind-klass   | Storlek | Användning                        |
|------------------|---------|-------------------------------------|
| `text-[10px]`    | 10px    | Reaktionsräknare, små indikatorer   |
| `text-xs`        | 12px    | Tidstämplar, små badges             |
| `text-[11px]`    | 11px    | Chattmetadata                       |
| `text-[13px]`    | 13px    | Avsändarnamn i gruppchattar         |
| `text-sm`        | 14px    | Sekundär text, etiketter            |
| `text-[15px]`    | 15px    | Chattmeddelandeinnehåll             |
| `text-base`      | 16px    | Standard brödtext, knappar          |
| `text-lg`        | 18px    | Större rubriker                     |
| `text-2xl`       | 24px    | Korttitlar (`CardTitle`)            |
| `text-3xl`       | 30px    | Avatar XL-storlek                   |

### Radhöjd

| Klass              | Värde | Användning           |
|--------------------|-------|------------------------|
| `leading-none`     | 1     | Täta rubriker          |
| `leading-[1.4]`    | 1.4   | Chattmeddelanden       |
| `leading-relaxed`  | 1.625 | Luftig brödtext        |

---

## 3. Komponentstil

### Button

**Bas:** `h-12 px-6 py-3 rounded-full font-bold text-base transition-all duration-200`
**Aktiv:** `active:scale-[0.98]`
**Fokus:** `ring-2 ring-ring ring-offset-2`

| Variant       | Stil                                                                                   |
|---------------|------------------------------------------------------------------------------------------|
| `default`     | Primär lila med glow-skugga `shadow-[0_4px_12px_rgba(108,92,231,0.3)]`                  |
| `destructive` | Destruktiv röd med mjuk skugga                                                           |
| `outline`     | 2px ram, accentfärg vid hover                                                            |
| `secondary`   | Mint accentfärg med mint-glow                                                            |
| `ghost`       | Transparent bakgrund, accentfärg vid hover                                               |
| `link`        | Understrukningstext                                                                      |
| `pill`        | Bredare padding (`px-8`)                                                                 |
| `soft`        | Dämpad bakgrund, 80% opacitet vid hover                                                  |
| `pastel`      | Pastellblå bakgrund                                                                      |
| `icon`        | Dämpad bakgrund för ikonknappar                                                          |

| Storlek    | Klass                            |
|------------|-----------------------------------|
| `sm`       | `h-10 px-4 text-sm rounded-full` |
| `default`  | `h-12 px-6`                      |
| `lg`       | `h-14 px-8 text-lg`              |
| `xl`       | `h-16 px-10 text-xl`             |
| `icon`     | `h-12 w-12 rounded-full`         |
| `icon-sm`  | `h-10 w-10 rounded-full`         |
| `icon-lg`  | `h-14 w-14 rounded-full`         |

### Card

**Bas:** `rounded-3xl border-border/50 bg-card/80 backdrop-blur-sm shadow-soft`

| Subdel            | Klass                                              |
|-------------------|----------------------------------------------------|
| `CardHeader`      | `flex flex-col space-y-1.5 p-6`                    |
| `CardTitle`       | `text-2xl font-semibold leading-none tracking-tight`|
| `CardDescription` | `text-sm text-muted-foreground`                    |
| `CardContent`     | `p-6 pt-0`                                        |
| `CardFooter`      | `flex items-center p-6 pt-0`                      |

### Input

**Bas:** `h-12 border-2 border-input rounded-2xl bg-background px-4 py-3 text-base font-medium`
**Fokus:** `ring-2 ring-primary border-primary duration-200`
**Platshållare:** `text-muted-foreground font-normal`

### Textarea

**Bas:** `min-h-[80px] border-2 border-input rounded-2xl px-4 py-3`
**Fokus:** Samma som Input

### Badge

**Bas:** `rounded-full px-2.5 py-0.5 text-xs font-semibold`

| Variant       | Stil                                |
|---------------|---------------------------------------|
| `default`     | Primärfärg bakgrund                   |
| `secondary`   | Sekundärfärg bakgrund                 |
| `destructive` | Destruktiv röd bakgrund               |
| `outline`     | Ram utan bakgrund                     |

### Avatar

| Storlek | Klass                      |
|---------|------------------------------|
| `sm`    | `h-10 w-10 text-sm`         |
| `md`    | `h-14 w-14 text-lg`         |
| `lg`    | `h-20 w-20 text-2xl`        |
| `xl`    | `h-24 w-24 text-3xl`        |

**Stil:** `rounded-full shadow-soft`
**Online-indikator:** 3–4px cirkel, grön för online, dämpad för offline
**Avstängd:** Röd badge med utropstecken, `opacity-60 grayscale`

### Dialog

**Stil:** `rounded-2xl w-[95vw] max-w-[512px] max-h-[85dvh] overflow-y-auto shadow-lg`
**Overlay:** Svart 80% opacitet

### Sheet (Bottom Sheet)

**Stil:** `rounded-t-2xl max-h-[85dvh]`
**Overlay:** Svart 80% opacitet med fade
**Z-index:** 60

### Chattbubbla

**Textbubbla:**
```
px-4 py-2.5 min-w-[60px] text-[15px] leading-[1.4] break-words whitespace-pre-wrap
```

**Hörnradie (skickad med svans):**
```
rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-md
```

**Hörnradie (mottagen med svans):**
```
rounded-tl-md rounded-tr-2xl rounded-bl-md rounded-br-2xl
```

**Meddelandetillstånd:**

| Tillstånd    | Stil                                     |
|--------------|-------------------------------------------|
| Pending      | `opacity-70`                              |
| Failed       | `opacity-60 border-2 border-destructive/50` |
| Highlighted  | `ring-2 ring-primary/50 rounded-2xl`     |

**Reaktioner:**
```
bg-muted/80 border-border/50 rounded-full px-1.5 py-0.5 -mt-2 shadow-sm
```

### Sidebar

| Variabel                   | Värde         |
|----------------------------|----------------|
| `--sidebar-width`          | `16rem` (256px)|
| `--sidebar-width-mobile`   | `18rem` (288px)|
| `--sidebar-width-icon`     | `3rem` (48px)  |

---

## 4. Skuggor och effekter

### Skuggvariabler

```css
--shadow-soft:    0 4px 20px -4px hsl(0 0% 0% / 0.3);
--shadow-medium:  0 8px 30px -6px hsl(0 0% 0% / 0.4);
--shadow-lifted:  0 12px 40px -8px hsl(0 0% 0% / 0.5);
```

| Klass            | Användning                       |
|------------------|-----------------------------------|
| `.shadow-soft`   | Kort, bubblor (standard)          |
| `.shadow-medium` | Hover-tillstånd för kort          |
| `.shadow-lifted` | Upphöjda element                  |

### Glow-effekter

**Lila primärglow (knappar):**
```css
shadow-[0_4px_12px_rgba(108,92,231,0.3), inset_0_1px_0_rgba(255,255,255,0.2)]
/* Hover: */
shadow-[0_6px_16px_rgba(108,92,231,0.4), inset_0_1px_0_rgba(255,255,255,0.2)]
```

**Mint accentglow (navigeringsbadges):**
```css
shadow-[0_0_12px_rgba(16,185,129,0.5)]
```

### Bakgrundseffekter

| Effekt              | Klass/Värde                   |
|---------------------|-------------------------------|
| Glasmorfism         | `backdrop-blur-sm`            |
| Halvtransparent     | `bg-card/80`                  |
| Gråskala            | `grayscale` (avstängda)       |

---

## 5. Animationer

### Anpassade keyframes

```css
/* bounce-in — 400ms cubic-bezier(0.34, 1.56, 0.64, 1) */
0%   { opacity: 0; transform: scale(0.9); }
50%  { transform: scale(1.02); }
100% { opacity: 1; transform: scale(1); }

/* slide-up — 300ms ease-out */
0%   { opacity: 0; transform: translateY(20px); }
100% { opacity: 1; transform: translateY(0); }

/* wiggle — 500ms ease-in-out */
0%, 100% { transform: rotate(0deg); }
25%      { transform: rotate(-3deg); }
75%      { transform: rotate(3deg); }

/* bubble-pop — 300ms cubic-bezier(0.34, 1.56, 0.64, 1) */
0%   { opacity: 0; transform: scale(0.8) translateY(10px); }
100% { opacity: 1; transform: scale(1) translateY(0); }

/* call-pulse — 2s infinite ease-in-out */
0%, 100% { transform: scale(1); }
50%      { transform: scale(1.05); }

/* ping-slow — 2s infinite cubic-bezier(0, 0, 0.2, 1) */
0%   { transform: scale(1); opacity: 0.4; }
100% { transform: scale(2); opacity: 0; }

/* bounce-gentle — 1s infinite ease-in-out */
0%, 100% { transform: translateY(0); }
50%      { transform: translateY(-8px); }

/* scale-in — 500ms ease-out */
0%   { transform: scale(1); }
50%  { transform: scale(1.05); }
100% { transform: scale(1); }
```

### Animationsklasser

| Klass                   | Animation                      | Användning            |
|-------------------------|--------------------------------|------------------------|
| `.animate-bounce-in`    | `bounce-in 0.4s`               | Meddelandeentré        |
| `.animate-slide-up`     | `slide-up 0.3s`                | Bottom sheet-entré     |
| `.animate-wiggle`       | `wiggle 0.5s`                  | Uppmärksamhetseffekt   |
| `.bubble-enter`         | `bubble-pop 0.3s`              | Chattbubblor           |
| `.animate-call-pulse`   | `call-pulse 2s infinite`       | Samtalsöverlägg        |
| `.animate-ping-slow`    | `ping-slow 2s infinite`        | Pulserande effekt      |
| `.animate-bounce-gentle`| `bounce-gentle 1s infinite`    | Mjuk flytning          |
| `.animate-scale-in`     | `scale-in 0.5s`                | Skala-animation        |

---

## 6. Avstånd och layout

### Border Radius-skala

| Token     | Värde                           | Pixlar  |
|-----------|----------------------------------|---------|
| `sm`      | `calc(var(--radius) - 8px)`     | ~16px   |
| `md`      | `calc(var(--radius) - 4px)`     | ~20px   |
| `lg`      | `var(--radius)`                  | 24px    |
| `bubble`  | `1.5rem`                         | 24px    |
| `pill`    | `9999px`                         | Helt rund|

**Bas:** `--radius: 1.5rem` (24px)

### Vanliga padding-mönster

| Kontext            | Värde          | Pixlar     |
|--------------------|----------------|------------|
| Kort header/content| `p-6`          | 24px       |
| Chattbubbla        | `px-4 py-2.5`  | 16px / 10px|
| Input              | `px-4 py-3`    | 16px / 12px|
| Badge              | `px-2.5 py-0.5`| 10px / 2px |
| Pill-knapp         | `px-8`         | 32px       |

### Safe Area (Mobil)

```css
.safe-bottom  { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
.safe-top     { padding-top: max(1rem, env(safe-area-inset-top)); }
.chat-footer  { padding-bottom: max(1.25rem, env(safe-area-inset-bottom, 1.25rem)); }
.pb-safe      { padding-bottom: max(1rem, env(safe-area-inset-bottom, 1rem)); }
```

---

## 7. Z-index-skala

| Element            | Z-index              |
|--------------------|----------------------|
| Emoji Picker       | `99999 !important`   |
| Dialog             | `100`                |
| Sheet (content)    | `60`                 |
| Sheet (overlay)    | `59`                 |
| Bottom Navigation  | `50`                 |
| Popover/Dropdown   | `50`                 |
| Sidebar            | `10`                 |
| Standard           | `0`                  |

---

## 8. Responsivitet

### Breakpoints (Tailwind standard)

| Prefix | Bredd   |
|--------|---------|
| `sm`   | 640px   |
| `md`   | 768px   |
| `lg`   | 1024px  |
| `xl`   | 1280px  |
| `2xl`  | 1536px  |

### Mobilanpassning

- **Viewport:** `viewport-fit=cover` (stöd för notch)
- **Höjd:** `100dvh` med `100svh` som fallback
- **Touch:** `-webkit-tap-highlight-color: transparent`
- **Scroll:** `overscroll-behavior: contain`, `-webkit-overflow-scrolling: touch`
- **Container max-width:** `1400px` (2xl-skärmar)

---

## 9. Temasystem

### Dark-only tema

Appen använder **uteslutande mörkt tema** — `dark`-klassen är alltid applicerad på `<html>`.

### Färgtokens (HSL-format)

Alla CSS-variabler använder HSL-format utan `hsl()`-wrapper:
```css
--primary: 258 90% 80%;
```

Tillämpas i Tailwind via:
```css
background-color: hsl(var(--primary));
color: hsl(var(--primary) / 0.5); /* med opacitet */
```

### Metatema

```html
<meta name="theme-color" content="#2dd4bf" /> <!-- Cyan -->
```

---

## 10. Beroenden och verktyg

| Paket                  | Roll                                    |
|------------------------|-----------------------------------------|
| Tailwind CSS           | Utility-first CSS-ramverk               |
| `tailwindcss-animate`  | Animationsverktyg                       |
| Radix UI               | Tillgängliga primitiva komponenter       |
| CVA (class-variance-authority) | Varianthantering för komponenter |
| `@fontsource/nunito`   | Typsnitt (Outfit)                       |
| PostCSS + Autoprefixer | CSS-bearbetning                         |

---

## 11. Filreferenser

| Fil                              | Innehåll                              |
|----------------------------------|----------------------------------------|
| `src/index.css`                  | CSS-variabler, animationer, verktyg    |
| `tailwind.config.ts`            | Tailwind-konfiguration och tema        |
| `src/components/ui/*.tsx`        | 47 Shadcn/ui-komponenter               |
| `src/components/ChatBubble.tsx`  | Meddelanderendering                    |
| `src/components/Avatar.tsx`      | Avatar med färgsystem                  |
| `src/components/ChildCard.tsx`   | Kortstil med kategorier                |
| `src/components/FriendCard.tsx`  | Vänliststil                            |
| `src/components/BottomNav.tsx`   | Navigation med badges                  |
| `postcss.config.js`             | PostCSS-plugins                        |
