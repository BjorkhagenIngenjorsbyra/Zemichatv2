import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
} from '@ionic/react';
import { Capacitor } from '@capacitor/core';

/* ── Inline markdown content per language ────────────────────── */

import privacySv from '../legal/privacy-sv';
import privacyEn from '../legal/privacy-en';
import privacyNo from '../legal/privacy-no';
import privacyDa from '../legal/privacy-da';
import privacyFi from '../legal/privacy-fi';

import termsSv from '../legal/terms-sv';
import termsEn from '../legal/terms-en';
import termsNo from '../legal/terms-no';
import termsDa from '../legal/terms-da';
import termsFi from '../legal/terms-fi';

/**
 * Strip cross-store references for the current platform.
 *
 * Apple rejection 2026-05-18 (build 51, Guideline 2.3.10) flagged the iOS
 * binary for containing Google Play references. The legal documents share
 * one source per language to keep wording in sync, but the binary that
 * ships to a given store must only mention that store.
 *
 * Patterns we collapse:
 *   - "App Store or Google Play"          -> "App Store" (iOS) / "Google Play" (Android)
 *   - "App Store (Apple) or Google Play (Google)" -> single-store form
 *   - "App Store's and Google Play's"     -> single-store form
 *   - "App Store/Google Play"             -> single-store form
 * Localised variants are handled via the translation table below so we cover
 * sv/en/no/da/fi without touching the legal source files (which still need
 * the dual-store wording for the privacy policy on the website).
 */
function stripCrossStoreReferences(html: string): string {
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') {
    // Web build keeps the dual-store wording.
    return html;
  }

  const keep = platform === 'ios' ? 'App Store' : 'Google Play';

  // Ordered: more specific patterns first so they don't get partially
  // captured by the broader ones below.
  const replacements: Array<[RegExp, string]> = [
    // Parenthesised vendor-attribution forms
    [/App\s?Store\s?\(Apple\)\s?(?:eller|or|of|tai|og|och)\s?Google\s?Play\s?\(Google\)/gi, keep],

    // Slash form: "App Store/Google Play"
    [/App\s?Store\s?\/\s?Google\s?Play/gi, keep],
    [/Google\s?Play\s?\/\s?App\s?Store/gi, keep],

    // Possessive forms: "App Store's and Google Play's"
    [/App\s?Store(?:'|&#39;)?s?\s+(?:and|och|og|ja|og)\s+Google\s?Play(?:'|&#39;)?s?/gi, keep],
    [/Google\s?Play(?:'|&#39;)?s?\s+(?:and|och|og|ja|og)\s+App\s?Store(?:'|&#39;)?s?/gi, keep],

    // "App Stores och Google Plays" / "App Stores and Google Plays"
    [/App\s?Stores?\s+(?:och|and|og|ja|tai|eller|or)\s+Google\s?Plays?/gi, keep],
    [/Google\s?Plays?\s+(?:och|and|og|ja|tai|eller|or)\s+App\s?Stores?/gi, keep],

    // Coordinated form with localised connectives:
    //   sv: "eller"   en: "or"   no: "eller"   da: "eller"   fi: "tai"
    [/App\s?Store(?:-|\s)?(?:eller|or|tai|og|ou)\s+Google\s?Play/gi, keep],
    [/Google\s?Play(?:-|\s)?(?:eller|or|tai|og|ou)\s+App\s?Store/gi, keep],

    // Loose "App Store och Google Play" or "App Store and Google Play"
    [/App\s?Store(?:-|\s)*(?:och|and|og|ja)\s+Google\s?Play/gi, keep],
    [/Google\s?Play(?:-|\s)*(?:och|and|og|ja)\s+App\s?Store/gi, keep],
  ];

  let result = html;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  // Final sweep: replace any remaining bare "Google Play" / "App Store"
  // mentions with the platform-appropriate one. We only do this on iOS
  // (the rejected platform). Android keeps both because Apple has no
  // equivalent guideline against App Store mentions in Android binaries.
  if (platform === 'ios') {
    result = result.replace(/Google\s?Play/g, 'App Store');
  }

  return result;
}

const privacyContent: Record<string, string> = {
  sv: privacySv,
  en: privacyEn,
  no: privacyNo,
  da: privacyDa,
  fi: privacyFi,
};

const termsContent: Record<string, string> = {
  sv: termsSv,
  en: termsEn,
  no: termsNo,
  da: termsDa,
  fi: termsFi,
};

interface LegalPageProps {
  type: 'privacy' | 'terms';
}

const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
  const { i18n } = useTranslation();
  const [html, setHtml] = useState('');

  // i18next often reports regional codes like 'en-US'/'sv-SE' which miss the
  // base-language map keys ('en','sv',...) and would silently fall back to
  // Swedish. Normalize to the base language before lookup.
  const lang = (i18n.resolvedLanguage || i18n.language || 'sv').split('-')[0];
  const contentMap = type === 'privacy' ? privacyContent : termsContent;

  useEffect(() => {
    const content = contentMap[lang] || contentMap['sv'];
    setHtml(stripCrossStoreReferences(content));
  }, [lang, contentMap]);

  const title = type === 'privacy'
    ? { sv: 'Integritetspolicy', en: 'Privacy Policy', no: 'Personvernerklæring', da: 'Privatlivspolitik', fi: 'Tietosuojakäytäntö' }
    : { sv: 'Användarvillkor', en: 'Terms of Service', no: 'Brukervilkår', da: 'Brugervilkår', fi: 'Käyttöehdot' };

  const pageTitle = (title as Record<string, string>)[lang] || title.sv;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/welcome" text="" />
          </IonButtons>
          <IonTitle>{pageTitle}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <div
          className="legal-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <style>{`
          .legal-content {
            max-width: 700px;
            margin: 0 auto;
            padding: 1rem 0 3rem 0;
            color: hsl(var(--foreground));
            font-size: 0.95rem;
            line-height: 1.7;
          }

          .legal-content h1 {
            font-size: 1.5rem;
            font-weight: 800;
            margin: 0 0 0.25rem 0;
            color: hsl(var(--foreground));
          }

          .legal-content h2 {
            font-size: 1.2rem;
            font-weight: 700;
            margin: 2rem 0 0.75rem 0;
            color: hsl(var(--foreground));
            border-bottom: 1px solid hsl(var(--border));
            padding-bottom: 0.5rem;
          }

          .legal-content h3 {
            font-size: 1.05rem;
            font-weight: 600;
            margin: 1.5rem 0 0.5rem 0;
            color: hsl(var(--foreground));
          }

          .legal-content p {
            margin: 0.5rem 0;
            color: hsl(var(--muted-foreground));
          }

          .legal-content strong {
            color: hsl(var(--foreground));
          }

          .legal-content ul, .legal-content ol {
            margin: 0.5rem 0;
            padding-left: 1.5rem;
          }

          .legal-content li {
            margin: 0.25rem 0;
            color: hsl(var(--muted-foreground));
          }

          .legal-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            font-size: 0.875rem;
          }

          .legal-content th {
            text-align: left;
            padding: 0.5rem 0.75rem;
            background: hsl(var(--muted) / 0.3);
            border-bottom: 2px solid hsl(var(--border));
            color: hsl(var(--foreground));
            font-weight: 600;
          }

          .legal-content td {
            padding: 0.5rem 0.75rem;
            border-bottom: 1px solid hsl(var(--border) / 0.5);
            color: hsl(var(--muted-foreground));
          }

          .legal-content a {
            color: hsl(var(--primary));
            text-decoration: none;
          }

          .legal-content a:hover {
            text-decoration: underline;
          }

          .legal-content hr {
            border: none;
            border-top: 1px solid hsl(var(--border));
            margin: 2rem 0;
          }

          .legal-content em {
            color: hsl(var(--muted-foreground));
            font-style: italic;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default LegalPage;
