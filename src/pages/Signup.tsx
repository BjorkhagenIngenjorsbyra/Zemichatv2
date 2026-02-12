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
import '../theme/auth-forms.css';

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
        <div className="auth-container" style={{ justifyContent: 'flex-start', paddingTop: '1rem' }}>
          <IonButton
            fill="clear"
            className="auth-back-button"
            onClick={() => history.goBack()}
          >
            <IonIcon icon={arrowBack} slot="start" />
            {t('common.back')}
          </IonButton>

          <div className="auth-header">
            <img
              src="/favicon-192.png"
              alt="Zemichat"
              className="auth-logo"
            />
            <h1 className="auth-title" style={{ fontSize: '2rem' }}>{t('auth.signupTitle')}</h1>
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
              className="auth-button"
              disabled={isLoading || !consentAccepted}
            >
              {isLoading ? <IonSpinner name="crescent" /> : t('auth.signup')}
            </IonButton>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Signup;
