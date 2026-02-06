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
import { signIn } from '../services/auth';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signInError } = await signIn({ email, password });

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
            <p className="auth-subtitle">{t('auth.loginTitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <IonText color="danger">{error}</IonText>
              </div>
            )}

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
                placeholder={t('auth.password')}
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
              {isLoading ? <IonSpinner name="crescent" /> : t('auth.login')}
            </IonButton>

            <div className="auth-links">
              <IonButton
                fill="clear"
                size="small"
                routerLink="/forgot-password"
                className="auth-link"
              >
                {t('auth.forgotPassword')}
              </IonButton>
            </div>

            <div className="auth-divider">
              <span>{t('common.or')}</span>
            </div>

            <IonButton
              fill="outline"
              expand="block"
              routerLink="/signup"
              className="auth-secondary-button"
            >
              {t('auth.signup')}
            </IonButton>

            <IonButton
              fill="clear"
              expand="block"
              routerLink="/texter-login"
              className="auth-texter-link"
            >
              {t('texterLogin.title')}
            </IonButton>
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

          .auth-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --border-radius: 9999px;
            font-weight: 700;
            height: 3rem;
            margin-top: 0.5rem;
          }

          .auth-links {
            display: flex;
            justify-content: center;
            margin-top: 0.5rem;
          }

          .auth-link {
            --color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
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

          .auth-texter-link {
            --color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
            margin-top: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Login;
