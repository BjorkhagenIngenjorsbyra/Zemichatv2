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
import { claimInvitation } from '../services/invitations';
import '../theme/auth-forms.css';

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
      if (signInError.message === 'Account is deactivated') {
        setError(t('texterLogin.accountDeactivated'));
      } else if (signInError.message === 'Account is paused') {
        setError(t('auth.accountPaused'));
      } else {
        setError(signInError.message);
      }
      setIsLoading(false);
      return;
    }

    // Auto-claim pending invitation if one was stored during signup
    const pendingToken = localStorage.getItem('zemichat-pending-invite-token');
    if (pendingToken) {
      localStorage.removeItem('zemichat-pending-invite-token');
      await claimInvitation(pendingToken);
    }

    history.replace('/chats');
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container">
          <div className="auth-header">
            <img
              src="/favicon-192.png"
              alt="Zemichat"
              className="auth-logo"
            />
            <h1 className="auth-title">{t('common.appName')}</h1>
            <p className="auth-subtitle">{t('auth.loginTitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" data-testid="login-form">
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
              className="auth-button"
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

            <p className="auth-legal-links">
              <a href="/privacy">{t('settings.privacyPolicy')}</a>
              {' · '}
              <a href="/terms">{t('settings.termsOfService')}</a>
            </p>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
