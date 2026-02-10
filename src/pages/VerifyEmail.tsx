import { useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonButton,
  IonText,
  IonSpinner,
} from '@ionic/react';
import { supabase } from '../services/supabase';

const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation<{ email?: string }>();
  const email = location.state?.email || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    setResent(false);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    setResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setResent(true);
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="verify-container">
          <div className="verify-icon">
            <svg
              width="80"
              height="80"
              viewBox="0 0 80 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="40" cy="40" r="40" fill="hsl(var(--primary) / 0.1)" />
              <circle cx="40" cy="40" r="28" fill="hsl(var(--primary) / 0.2)" />
              <path
                d="M28 35L37 44L52 29"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="verify-title">{t('verifyEmail.title')}</h1>

          <p className="verify-text">
            {t('verifyEmail.description', { email })}
          </p>

          <div className="resend-section">
            {resending ? (
              <IonSpinner name="crescent" className="resend-spinner" />
            ) : resent ? (
              <IonText color="success" className="resend-success">
                {t('verifyEmail.resent')}
              </IonText>
            ) : (
              <button
                className="resend-link"
                onClick={handleResend}
                disabled={!email}
              >
                {t('verifyEmail.resend')}
              </button>
            )}
          </div>

          {error && (
            <div className="verify-error">
              <IonText color="danger">{error}</IonText>
            </div>
          )}

          <IonButton
            expand="block"
            className="verify-button glow-primary"
            onClick={() => history.replace('/login')}
          >
            {t('verifyEmail.goToLogin')}
          </IonButton>
        </div>

        <style>{`
          .verify-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100%;
            max-width: 400px;
            margin: 0 auto;
            padding: 2rem;
            text-align: center;
          }

          .verify-icon {
            margin-bottom: 2rem;
          }

          .verify-title {
            font-size: 1.75rem;
            font-weight: 800;
            color: hsl(var(--foreground));
            margin: 0 0 1rem 0;
            letter-spacing: -0.02em;
          }

          .verify-text {
            font-size: 1rem;
            color: hsl(var(--muted-foreground));
            line-height: 1.6;
            margin: 0 0 2rem 0;
          }

          .verify-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            height: 3rem;
            width: 100%;
            margin-bottom: 1.5rem;
          }

          .resend-section {
            min-height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
          }

          .resend-link {
            background: none;
            border: none;
            color: hsl(var(--primary));
            font-size: 0.9rem;
            cursor: pointer;
            padding: 0.5rem;
            text-decoration: underline;
          }

          .resend-link:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .resend-spinner {
            --color: hsl(var(--primary));
            width: 1.25rem;
            height: 1.25rem;
          }

          .resend-success {
            font-size: 0.9rem;
          }

          .verify-error {
            background: hsl(var(--destructive) / 0.1);
            border: 1px solid hsl(var(--destructive) / 0.3);
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
            margin-bottom: 1rem;
            width: 100%;
          }

        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default VerifyEmail;
