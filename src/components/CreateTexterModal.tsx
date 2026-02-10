import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonInput,
  IonText,
  IonSpinner,
  IonButtons,
  IonIcon,
} from '@ionic/react';
import { close, checkmarkCircle, copyOutline } from 'ionicons/icons';
import { createTexter } from '../services/members';
import { createDefaultQuickMessages } from '../services/quickMessage';

interface CreateTexterModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  onCreated: () => void;
}

interface CreatedTexter {
  displayName: string;
  zemiNumber: string;
  password: string;
}

export const CreateTexterModal: React.FC<CreateTexterModalProps> = ({
  isOpen,
  onClose,
  teamId,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createdTexter, setCreatedTexter] = useState<CreatedTexter | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setDisplayName('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setCreatedTexter(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError(t('texter.enterName'));
      return;
    }

    if (password.length < 6) {
      setError(t('texter.passwordMin'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    setIsLoading(true);

    const { user: newTexter, zemiNumber, error: createError } = await createTexter({
      displayName: displayName.trim(),
      password,
      teamId,
    });

    setIsLoading(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    // Create default quick messages for the new Texter
    if (newTexter?.id) {
      const suggestions = t('quickMessages.suggestions', { returnObjects: true }) as string[];
      if (Array.isArray(suggestions)) {
        await createDefaultQuickMessages(newTexter.id, suggestions);
      }
    }

    // Show success with credentials
    setCreatedTexter({
      displayName: displayName.trim(),
      zemiNumber: zemiNumber!,
      password,
    });

    onCreated();
  };

  const copyCredentials = async () => {
    if (!createdTexter) return;

    const text = `${t('common.appName')} - ${createdTexter.displayName}:
${t('texter.zemiNumber')}: ${createdTexter.zemiNumber}
${t('texter.password')}: ${createdTexter.password}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{createdTexter ? t('texter.created') : t('texter.createTitle')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {createdTexter ? (
          <div className="success-container">
            <IonIcon icon={checkmarkCircle} className="success-icon" />
            <h2>{t('texter.created')}</h2>
            <p className="success-subtitle">
              {t('texter.giveCredentials', { name: createdTexter.displayName })}
            </p>

            <div className="credentials-box">
              <div className="credential-row">
                <span className="credential-label">{t('texter.zemiNumber')}:</span>
                <span className="credential-value">{createdTexter.zemiNumber}</span>
              </div>
              <div className="credential-row">
                <span className="credential-label">{t('texter.password')}:</span>
                <span className="credential-value">{createdTexter.password}</span>
              </div>
            </div>

            <IonButton expand="block" onClick={copyCredentials} className="copy-button">
              <IonIcon icon={copyOutline} slot="start" />
              {copied ? t('common.copied') : t('texter.copyCredentials')}
            </IonButton>

            <IonButton expand="block" fill="outline" onClick={handleClose} className="done-button">
              {t('common.done')}
            </IonButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-form">
            <p className="form-description">
              {t('texter.createDescription')}
            </p>

            {error && (
              <div className="form-error">
                <IonText color="danger">{error}</IonText>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">{t('texter.name')}</label>
              <IonInput
                type="text"
                placeholder={t('texter.namePlaceholder')}
                value={displayName}
                onIonInput={(e) => setDisplayName(e.detail.value || '')}
                className="form-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <label className="input-label">{t('texter.password')}</label>
              <IonInput
                type="password"
                placeholder={t('texter.passwordPlaceholder')}
                value={password}
                onIonInput={(e) => setPassword(e.detail.value || '')}
                className="form-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <label className="input-label">{t('auth.confirmPassword')}</label>
              <IonInput
                type="password"
                placeholder={t('texter.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onIonInput={(e) => setConfirmPassword(e.detail.value || '')}
                className="form-input"
                fill="outline"
              />
            </div>

            <IonButton
              type="submit"
              expand="block"
              className="submit-button glow-primary"
              disabled={isLoading}
            >
              {isLoading ? <IonSpinner name="crescent" /> : t('texter.createButton')}
            </IonButton>
          </form>
        )}

        <style>{`
          .success-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 1rem;
          }

          .success-icon {
            font-size: 4rem;
            color: hsl(var(--secondary));
            margin-bottom: 1rem;
          }

          .success-container h2 {
            margin: 0 0 0.5rem 0;
            color: #1f2937;
          }

          .success-subtitle {
            color: #374151;
            margin: 0 0 1.5rem 0;
          }

          .credentials-box {
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1.25rem;
            width: 100%;
            margin-bottom: 1.5rem;
          }

          .credential-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
          }

          .credential-row:not(:last-child) {
            border-bottom: 1px solid hsl(var(--border));
          }

          .credential-label {
            color: hsl(var(--muted-foreground));
            font-size: 0.9rem;
          }

          .credential-value {
            font-family: monospace;
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .copy-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            margin-bottom: 0.75rem;
          }

          .done-button {
            --border-color: #9ca3af;
            --color: #1f2937;
            --border-width: 1.5px;
            font-weight: 600;
          }

          .create-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding-bottom: 16rem;
          }

          .form-description {
            color: hsl(var(--muted-foreground));
            font-size: 0.9rem;
            line-height: 1.5;
            margin: 0 0 0.5rem 0;
          }

          .form-error {
            background: hsl(var(--destructive) / 0.1);
            border: 1px solid hsl(var(--destructive) / 0.3);
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
          }

          .input-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .input-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: #374151;
            margin-left: 0.25rem;
          }

          .form-input {
            --background: transparent;
            --border-color: #9ca3af;
            --border-radius: 1rem;
            --placeholder-color: #6b7280;
            --placeholder-opacity: 1;
          }

          .submit-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            height: 3rem;
            margin-top: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};
