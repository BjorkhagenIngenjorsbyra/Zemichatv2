import { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonSpinner,
  IonInput,
  IonText,
  IonIcon,
} from '@ionic/react';
import { shieldCheckmarkOutline, copyOutline, checkmarkCircle } from 'ionicons/icons';
import {
  enrollMFA,
  verifyMFAEnrollment,
  cancelMFAEnrollment,
  isMFAEnabled,
} from '../services/mfa';

type SetupStep = 'loading' | 'scan' | 'verify' | 'success';

const MFASetup: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [step, setStep] = useState<SetupStep>('loading');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    const initSetup = async () => {
      // Check if MFA is already enabled
      const { enabled } = await isMFAEnabled();
      if (enabled) {
        history.replace('/settings');
        return;
      }

      // Start enrollment
      const { factorId: fId, qrCode: qr, secret: sec, error: enrollError } = await enrollMFA();

      if (enrollError) {
        setError(enrollError.message);
        setStep('scan');
        return;
      }

      setFactorId(fId);
      setQrCode(qr);
      setSecret(sec);
      setStep('scan');
    };

    initSetup();
  }, [history]);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError(t('mfa.invalidCode'));
      return;
    }

    setIsVerifying(true);
    setError(null);

    const { error: verifyError } = await verifyMFAEnrollment(factorId, verificationCode);

    if (verifyError) {
      setError(verifyError.message);
      setIsVerifying(false);
      return;
    }

    setStep('success');
    setIsVerifying(false);
  };

  const handleCancel = async () => {
    if (factorId) {
      await cancelMFAEnrollment(factorId);
    }
    history.goBack();
  };

  const handleFinish = () => {
    history.replace('/dashboard');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>{t('mfa.setupTitle')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="mfa-setup-container">
          {step === 'loading' && (
            <div className="loading-state">
              <IonSpinner name="crescent" />
              <p>{t('common.loading')}</p>
            </div>
          )}

          {step === 'scan' && (
            <div className="scan-step">
              <div className="icon-container">
                <IonIcon icon={shieldCheckmarkOutline} className="shield-icon" />
              </div>

              <h2>{t('mfa.scanQRCode')}</h2>
              <p className="description">{t('mfa.scanDescription')}</p>

              {qrCode && (
                <div className="qr-container">
                  <img src={qrCode} alt="QR Code" className="qr-code" />
                </div>
              )}

              <div className="secret-section">
                <p className="secret-label">{t('mfa.manualEntry')}</p>
                <div className="secret-box">
                  <code className="secret-code">{secret}</code>
                  <IonButton fill="clear" size="small" onClick={handleCopySecret}>
                    <IonIcon icon={secretCopied ? checkmarkCircle : copyOutline} />
                  </IonButton>
                </div>
              </div>

              <IonButton expand="block" onClick={() => setStep('verify')} className="continue-button">
                {t('common.next')}
              </IonButton>

              <IonButton expand="block" fill="outline" color="medium" onClick={handleCancel}>
                {t('common.cancel')}
              </IonButton>
            </div>
          )}

          {step === 'verify' && (
            <div className="verify-step">
              <div className="icon-container">
                <IonIcon icon={shieldCheckmarkOutline} className="shield-icon" />
              </div>

              <h2>{t('mfa.enterCode')}</h2>
              <p className="description">{t('mfa.enterCodeDescription')}</p>

              <div className="code-input-container">
                <IonInput
                  value={verificationCode}
                  onIonInput={(e) => setVerificationCode(e.detail.value?.replace(/\D/g, '') || '')}
                  placeholder="000000"
                  maxlength={6}
                  inputmode="numeric"
                  className="code-input"
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

              <IonButton expand="block" fill="outline" color="medium" onClick={() => setStep('scan')}>
                {t('common.back')}
              </IonButton>
            </div>
          )}

          {step === 'success' && (
            <div className="success-step">
              <div className="icon-container success">
                <IonIcon icon={checkmarkCircle} className="success-icon" />
              </div>

              <h2>{t('mfa.setupComplete')}</h2>
              <p className="description">{t('mfa.setupCompleteDescription')}</p>

              <IonButton expand="block" onClick={handleFinish} className="finish-button">
                {t('common.done')}
              </IonButton>
            </div>
          )}
        </div>

        <style>{`
          .mfa-setup-container {
            max-width: 400px;
            margin: 0 auto;
            padding: 1rem 0;
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

          .icon-container.success .success-icon {
            font-size: 5rem;
            color: hsl(var(--secondary));
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
            margin: 0 0 1.5rem 0;
          }

          .qr-container {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
          }

          .qr-code {
            width: 200px;
            height: 200px;
            border-radius: 1rem;
            background: white;
            padding: 1rem;
          }

          .secret-section {
            margin-bottom: 1.5rem;
          }

          .secret-label {
            font-size: 0.85rem;
            color: hsl(var(--muted-foreground));
            text-align: center;
            margin: 0 0 0.5rem 0;
          }

          .secret-box {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
            padding: 0.5rem 1rem;
          }

          .secret-code {
            font-family: monospace;
            font-size: 0.9rem;
            letter-spacing: 0.1em;
            color: hsl(var(--foreground));
            word-break: break-all;
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

          .continue-button,
          .verify-button,
          .finish-button {
            --border-radius: 1rem;
            margin-bottom: 0.75rem;
            font-weight: 600;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default MFASetup;
