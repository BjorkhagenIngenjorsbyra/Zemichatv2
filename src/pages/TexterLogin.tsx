import { useState, FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
} from '@ionic/react';
import { signInAsTexter } from '../services/auth';

const TexterLogin: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [zemiNumber, setZemiNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formatZemiNumber = (value: string): string => {
    // Remove all non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Format as ZEMI-XXX-XXX
    if (cleaned.length <= 4) {
      return cleaned;
    } else if (cleaned.length <= 7) {
      return cleaned.slice(0, 4) + '-' + cleaned.slice(4);
    } else {
      return cleaned.slice(0, 4) + '-' + cleaned.slice(4, 7) + '-' + cleaned.slice(7, 10);
    }
  };

  const handleZemiNumberChange = (value: string | null | undefined) => {
    const formatted = formatZemiNumber(value || '');
    setZemiNumber(formatted);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!zemiNumber.trim()) {
      setError(t('texterLogin.zemiNumber'));
      return;
    }

    if (!password) {
      setError(t('texter.password'));
      return;
    }

    setIsLoading(true);

    const { error: signInError } = await signInAsTexter({
      zemiNumber: zemiNumber.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    history.replace('/dashboard');
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-title">{t('common.appName')}</h1>
            <p className="auth-subtitle">{t('texterLogin.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <IonText color="danger">{error}</IonText>
              </div>
            )}

            <div className="input-group">
              <IonInput
                type="text"
                placeholder={t('texterLogin.zemiPlaceholder')}
                value={zemiNumber}
                onIonInput={(e) => handleZemiNumberChange(e.detail.value)}
                required
                className="auth-input zemi-input"
                fill="outline"
                maxlength={12}
              />
            </div>

            <div className="input-group">
              <IonInput
                type="password"
                placeholder={t('texterLogin.password')}
                value={password}
                onIonInput={(e) => setPassword(e.detail.value || '')}
                required
                className="auth-input"
                fill="outline"
              />
            </div>

            <IonButton
              type="submit"
              expand="block"
              className="auth-button glow-primary"
              disabled={isLoading}
            >
              {isLoading ? <IonSpinner name="crescent" /> : t('texterLogin.loginButton')}
            </IonButton>

            <div className="auth-divider">
              <span>{t('common.or')}</span>
            </div>

            <IonButton
              fill="outline"
              expand="block"
              routerLink="/login"
              className="auth-secondary-button"
            >
              {t('texterLogin.ownerLogin')}
            </IonButton>

            <p className="auth-legal-links">
              <a href="/privacy">{t('settings.privacyPolicy')}</a>
              {' · '}
              <a href="/terms">{t('settings.termsOfService')}</a>
            </p>
          </form>
        </div>

        <style>{`
          .auth-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 100%;
            max-width: 400px;
            margin: 0 auto;
            padding: 2rem;
          }

          .auth-header {
            text-align: center;
            margin-bottom: 2.5rem;
          }

          .auth-title {
            font-size: 2.5rem;
            font-weight: 800;
            color: hsl(var(--primary));
            margin: 0 0 0.5rem 0;
            letter-spacing: -0.02em;
          }

          .auth-subtitle {
            font-size: 1rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
          }

          .auth-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .auth-error {
            background: hsl(var(--destructive) / 0.1);
            border: 1px solid hsl(var(--destructive) / 0.3);
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
            margin-bottom: 0.5rem;
          }

          .input-group {
            margin-bottom: 0.5rem;
          }

          .auth-input {
            --background: hsl(var(--card));
            --color: hsl(var(--foreground));
            --placeholder-color: hsl(var(--muted-foreground));
            --border-color: hsl(var(--border));
            --border-radius: 1rem;
            --padding-start: 1rem;
            --padding-end: 1rem;
            --highlight-color-focused: hsl(var(--primary));
          }

          .zemi-input {
            font-family: monospace;
            font-size: 1.1rem;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          .auth-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --border-radius: 9999px;
            font-weight: 700;
            height: 3rem;
            margin-top: 0.5rem;
          }

          .auth-divider {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 1rem 0;
          }

          .auth-divider::before,
          .auth-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: hsl(var(--border));
          }

          .auth-divider span {
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .auth-secondary-button {
            --border-color: hsl(var(--border));
            --color: hsl(var(--foreground));
            --border-radius: 9999px;
            font-weight: 600;
            height: 3rem;
          }

          .auth-legal-links {
            text-align: center;
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            margin-top: 1.5rem;
          }

          .auth-legal-links a {
            color: hsl(var(--muted-foreground));
            text-decoration: none;
          }

          .auth-legal-links a:hover {
            text-decoration: underline;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default TexterLogin;
