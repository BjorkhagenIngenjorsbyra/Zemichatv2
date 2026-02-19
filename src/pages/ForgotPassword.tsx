import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
} from '@ionic/react';
import { resetPassword } from '../services/auth';
import '../theme/auth-forms.css';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: resetError } = await resetPassword(email);

    if (resetError) {
      setError(resetError.message);
      setIsLoading(false);
      return;
    }

    setIsSent(true);
    setIsLoading(false);
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
            <h1 className="auth-title">{t('auth.resetPasswordTitle')}</h1>
            <p className="auth-subtitle">{t('auth.resetPasswordSubtitle')}</p>
          </div>

          {isSent ? (
            <div className="auth-form">
              <div className="auth-success">
                <IonText color="success">
                  <p>{t('auth.resetEmailSent')}</p>
                </IonText>
              </div>
              <IonButton
                fill="outline"
                expand="block"
                routerLink="/login"
                className="auth-secondary-button"
              >
                {t('auth.backToLogin')}
              </IonButton>
            </div>
          ) : (
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

              <IonButton
                type="submit"
                expand="block"
                className="auth-button"
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? <IonSpinner name="crescent" /> : t('auth.sendResetEmail')}
              </IonButton>

              <div className="auth-links">
                <IonButton
                  fill="clear"
                  size="small"
                  routerLink="/login"
                  className="auth-link"
                >
                  {t('auth.backToLogin')}
                </IonButton>
              </div>
            </form>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ForgotPassword;
