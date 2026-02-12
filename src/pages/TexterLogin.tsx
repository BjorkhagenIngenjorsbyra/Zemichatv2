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
import '../theme/auth-forms.css';

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
      if (signInError.message === 'Account is deactivated') {
        setError(t('texterLogin.accountDeactivated'));
      } else {
        setError(signInError.message);
      }
      setIsLoading(false);
      return;
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
              className="auth-button"
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
      </IonContent>
    </IonPage>
  );
};

export default TexterLogin;
