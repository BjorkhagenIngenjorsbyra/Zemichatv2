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

  const lang = i18n.language || 'sv';
  const contentMap = type === 'privacy' ? privacyContent : termsContent;

  useEffect(() => {
    const content = contentMap[lang] || contentMap['sv'];
    setHtml(content);
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
