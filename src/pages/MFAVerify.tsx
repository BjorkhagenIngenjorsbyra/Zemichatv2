import { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonSpinner,
  IonInput,
  IonText,
  IonIcon,
} from '@ionic/react';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import {
  getVerifiedFactor,
  createMFAChallenge,
  verifyMFAChallenge,
  type MFAFactor,
} from '../services/mfa';
import { useAuthContext } from '../contexts/AuthContext';

const MFAVerify: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { signOut, refreshProfile } = useAuthContext();
  const [factor, setFactor] = useState<MFAFactor | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const initVerification = async () => {
      // Get the verified factor
      const { factor: verifiedFactor, error: factorError } = await getVerifiedFactor();

      if (factorError || !verifiedFactor) {
        // No MFA factor, proceed to dashboard
        history.replace('/dashboard');
        return;
      }

      setFactor(verifiedFactor);

      // Create a challenge
      const { challenge, error: challengeError } = await createMFAChallenge(verifiedFactor.id);

      if (challengeError || !challenge) {
        setError(challengeError?.message || 'Failed to create challenge');
        setIsLoading(false);
        return;
      }

      setChallengeId(challenge.id);
      setIsLoading(false);
    };

    initVerification();
  }, [history]);

  const handleVerify = async () => {
    if (!factor || !challengeId || verificationCode.length !== 6) {
      setError(t('mfa.invalidCode'));
      return;
    }

    setIsVerifying(true);
    setError(null);

    const { error: verifyError } = await verifyMFAChallenge(
      factor.id,
      challengeId,
      verificationCode
    );

    if (verifyError) {
      setError(verifyError.message);
      setIsVerifying(false);

      // Create a new challenge for retry
      const { challenge } = await createMFAChallenge(factor.id);
      if (challenge) {
        setChallengeId(challenge.id);
      }
      return;
    }

    // Refresh profile and proceed
    await refreshProfile();
    history.replace('/dashboard');
  };

  const handleCancel = async () => {
    await signOut();
    history.replace('/login');
  };

  const handleResendCode = async () => {
    if (!factor) return;

    setError(null);

    const { challenge, error: challengeError } = await createMFAChallenge(factor.id);

    if (challengeError) {
      setError(challengeError.message);
      return;
    }

    if (challenge) {
      setChallengeId(challenge.id);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('mfa.verifyTitle')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="mfa-verify-container">
          {isLoading ? (
            <div className="loading-state">
              <IonSpinner name="crescent" />
              <p>{t('common.loading')}</p>
            </div>
          ) : (
            <div className="verify-content">
              <div className="icon-container">
                <IonIcon icon={shieldCheckmarkOutline} className="shield-icon" />
              </div>

              <h2>{t('mfa.verifyTitle')}</h2>
              <p className="description">{t('mfa.verifyDescription')}</p>

              <div className="code-input-container">
                <IonInput
                  value={verificationCode}
                  onIonInput={(e) => setVerificationCode(e.detail.value?.replace(/\D/g, '') || '')}
                  placeholder="000000"
                  maxlength={6}
                  inputmode="numeric"
                  className="code-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && verificationCode.length === 6) {
                      handleVerify();
                    }
                  }}
                />
              </div>

              {error && (
                <IonText color="danger" className="error-text">
                  <p>{error}</p>
                </IonText>
              )}

              <IonButton
                expand="block"
                onClick={handleVerify}
                disabled={verificationCode.length !== 6 || isVerifying}
                className="verify-button"
              >
                {isVerifying ? <IonSpinner name="crescent" /> : t('mfa.verify')}
              </IonButton>

              <IonButton
                expand="block"
                fill="outline"
                color="medium"
                onClick={handleResendCode}
                disabled={isVerifying}
              >
                {t('mfa.newCode')}
              </IonButton>

              <div className="cancel-section">
                <IonButton fill="clear" color="medium" onClick={handleCancel}>
                  {t('mfa.useAnotherAccount')}
                </IonButton>
              </div>
            </div>
          )}
        </div>

        <style>{`
          .mfa-verify-container {
            max-width: 400px;
            margin: 0 auto;
            padding: 2rem 0;
          }

          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 300px;
            gap: 1rem;
          }

          .icon-container {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
          }

          .shield-icon {
            font-size: 4rem;
            color: hsl(var(--primary));
          }

          h2 {
            text-align: center;
            font-size: 1.5rem;
            font-weight: 700;
            color: hsl(var(--foreground));
            margin: 0 0 0.5rem 0;
          }

          .description {
            text-align: center;
            color: hsl(var(--muted-foreground));
            margin: 0 0 2rem 0;
          }

          .code-input-container {
            margin-bottom: 1.5rem;
          }

          .code-input {
            --background: hsl(var(--card));
            --border-radius: 1rem;
            --padding-start: 1rem;
            --padding-end: 1rem;
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            font-size: 2rem;
            font-family: monospace;
            text-align: center;
            letter-spacing: 0.5em;
          }

          .code-input input {
            text-align: center !important;
          }

          .error-text {
            display: block;
            text-align: center;
            margin-bottom: 1rem;
          }

          .verify-button {
            --border-radius: 1rem;
            margin-bottom: 0.75rem;
            font-weight: 600;
          }

          .cancel-section {
            text-align: center;
            margin-top: 2rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default MFAVerify;
