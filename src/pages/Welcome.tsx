import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonButton,
} from '@ionic/react';

const Welcome: React.FC = () => {
  const { t } = useTranslation();

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="welcome-container">
          <div className="welcome-hero">
            <div className="welcome-logo">💬</div>
            <h1 className="welcome-title">{t('common.appName')}</h1>
            <p className="welcome-tagline">{t('welcome.description')}</p>
          </div>

          <div className="welcome-actions">
            <IonButton
              expand="block"
              routerLink="/signup"
              className="welcome-primary-button glow-primary"
            >
              {t('welcome.createAccount')}
            </IonButton>

            <IonButton
              fill="clear"
              expand="block"
              routerLink="/login"
              className="welcome-login-link"
            >
              {t('welcome.haveAccount')}
            </IonButton>
          </div>

          <p className="welcome-legal-links">
            <a href="/privacy">{t('settings.privacyPolicy')}</a>
            {' · '}
            <a href="/terms">{t('settings.termsOfService')}</a>
          </p>
        </div>

        <style>{`
          .welcome-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 100%;
            max-width: 400px;
            margin: 0 auto;
            padding: 2rem;
            text-align: center;
          }

          .welcome-hero {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding-bottom: 2rem;
          }

          .welcome-logo {
            font-size: 4rem;
            margin-bottom: 1.5rem;
          }

          .welcome-title {
            font-size: 2.5rem;
            font-weight: 800;
            color: hsl(var(--primary));
            margin: 0 0 0.75rem 0;
            letter-spacing: -0.02em;
          }

          .welcome-tagline {
            font-size: 1.125rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
            line-height: 1.5;
          }

          .welcome-actions {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding-bottom: 1.5rem;
          }

          .welcome-primary-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            height: 3rem;
            font-weight: 600;
          }

          .welcome-login-link {
            --color: hsl(var(--muted-foreground));
            font-size: 0.9375rem;
          }

          .welcome-legal-links {
            text-align: center;
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
          }

          .welcome-legal-links a {
            color: hsl(var(--muted-foreground));
            text-decoration: none;
          }

          .welcome-legal-links a:hover {
            text-decoration: underline;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Welcome;
