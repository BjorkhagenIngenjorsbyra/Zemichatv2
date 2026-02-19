import { useState, useEffect, FormEvent } from 'react';
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
import { supabase } from '../services/supabase';
import { updatePassword } from '../services/auth';
import '../theme/auth-forms.css';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    // This fires when the user clicks the reset link (hash fragment contains the token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsReady(true);
      }
    });

    // Also check if we already have a session (e.g. page reload after token was consumed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('auth.passwordTooShort', { min: 8 }));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    setIsLoading(true);

    const { error: updateError } = await updatePassword(password);

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      return;
    }

    // Sign out so user logs in fresh with new password
    await supabase.auth.signOut();

    history.replace('/password-changed');
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
            <h1 className="auth-title">{t('auth.newPasswordTitle')}</h1>
            <p className="auth-subtitle">{t('auth.newPasswordSubtitle')}</p>
          </div>

          {!isReady ? (
            <div className="auth-form" style={{ textAlign: 'center', padding: '2rem 0' }}>
              <IonSpinner name="crescent" />
              <p style={{ marginTop: '1rem', color: 'hsl(var(--muted-foreground))' }}>
                {t('auth.verifyingResetLink')}
              </p>
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
                  type="password"
                  placeholder={t('auth.newPassword')}
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

              <IonButton
                type="submit"
                expand="block"
                className="auth-button"
                disabled={isLoading || !password || !confirmPassword}
              >
                {isLoading ? <IonSpinner name="crescent" /> : t('auth.changePassword')}
              </IonButton>
            </form>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
