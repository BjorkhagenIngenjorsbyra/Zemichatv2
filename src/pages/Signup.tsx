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
  IonIcon,
  IonCheckbox,
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { signUp } from '../services/auth';

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordTooShort', { min: 8 }));
      return;
    }

    if (!consentAccepted) {
      setError(t('auth.consentRequired'));
      return;
    }

    setIsLoading(true);

    const { error: signUpError, user } = await signUp({
      email,
      password,
      displayName: displayName || undefined,
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    if (!user) {
      setError(t('common.error'));
      setIsLoading(false);
      return;
    }

    history.replace('/verify-email', { email });
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container">
          <IonButton
            fill="clear"
            className="back-button"
            onClick={() => history.goBack()}
          >
            <IonIcon icon={arrowBack} slot="start" />
            {t('common.back')}
          </IonButton>

          <div className="auth-header">
            <h1 className="auth-title">{t('auth.signupTitle')}</h1>
            <p className="auth-subtitle">{t('auth.signupSubtitle')}</p>
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
                placeholder={t('auth.yourName')}
                value={displayName}
                onIonInput={(e) => setDisplayName(e.detail.value || '')}
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <IonInput
                type="email"
                placeholder={t('auth.email')}
                value={email}
                onIonInput={(e) => setEmail(e.detail.value || '')}
                required
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <IonInput
                type="password"
                placeholder={t('auth.passwordMinLength')}
                value={password}
                onIonInput={(e) => setPassword(e.detail.value || '')}
                required
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <IonInput
                type="password"
                placeholder={t('auth.confirmPassword')}
                value={confirmPassword}
                onIonInput={(e) => setConfirmPassword(e.detail.value || '')}
                required
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="consent-row">
              <IonCheckbox
                checked={consentAccepted}
                onIonChange={(e) => setConsentAccepted(e.detail.checked)}
                className="consent-checkbox"
              />
              <label className="consent-label">
                {t('auth.consentLabel')}{' '}
                <a href="/terms">{t('auth.termsLink')}</a> {t('common.and')}{' '}
                <a href="/privacy">{t('auth.privacyLink')}</a>
              </label>
            </div>

            <IonButton
              type="submit"
              expand="block"
              className="auth-button glow-primary"
              disabled={isLoading || !consentAccepted}
            >
              {isLoading ? <IonSpinner name="crescent" /> : t('auth.signup')}
            </IonButton>
          </form>
        </div>

        <style>{`
          .auth-container {
            display: flex;
            flex-direction: column;
            min-height: 100%;
            max-width: 400px;
            margin: 0 auto;
            padding: 1rem 2rem 2rem;
          }

          .back-button {
            --color: hsl(var(--muted-foreground));
            align-self: flex-start;
            margin-left: -0.5rem;
            margin-bottom: 1rem;
          }

          .auth-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .auth-title {
            font-size: 2rem;
            font-weight: 800;
            color: hsl(var(--primary));
            margin: 0 0 0.5rem 0;
            letter-spacing: -0.02em;
          }

          .auth-subtitle {
            font-size: 1rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
            line-height: 1.5;
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
            margin-bottom: 0.25rem;
          }

          .auth-input {
            --background: hsl(var(--card));
            --color: hsl(var(--foreground));
            --placeholder-color: hsl(var(--muted-foreground));
            --border-color: hsl(var(--border));
            --border-radius: 1rem;
          }

          .auth-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            height: 3rem;
            margin-top: 0.5rem;
          }

          .consent-row {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            margin-top: 0.5rem;
          }

          .consent-checkbox {
            --size: 20px;
            --checkbox-background-checked: hsl(var(--primary));
            --border-color: hsl(var(--border));
            --border-color-checked: hsl(var(--primary));
            margin-top: 2px;
            flex-shrink: 0;
          }

          .consent-label {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            line-height: 1.5;
          }

          .consent-label a {
            color: hsl(var(--primary));
            text-decoration: none;
          }

          .consent-label a:hover {
            text-decoration: underline;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Signup;
