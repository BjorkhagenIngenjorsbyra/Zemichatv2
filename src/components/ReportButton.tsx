import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonRadio,
  IonRadioGroup,
  IonTextarea,
  IonIcon,
  IonText,
  IonSpinner,
} from '@ionic/react';
import { flagOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { ReportCategory } from '../types/database';
import {
  reportChat,
  reportMessage,
  reportUser,
  REPORT_CATEGORY_ORDER,
} from '../services/report';

type ReportTarget =
  | { kind: 'message'; messageId: string }
  | { kind: 'chat'; chatId: string }
  | { kind: 'user'; userId: string };

interface ReportButtonProps {
  /** What is being reported. Determines which service call we make. */
  target: ReportTarget;
  /**
   * Visual style. `link` is plain inline text (e.g. inside a context
   * menu); `button` is a standalone button. Defaults to `link`.
   */
  variant?: 'link' | 'button';
  /** Optional override label; falls back to the translated default. */
  label?: string;
  /** Called after the user has either submitted or cancelled. */
  onClose?: () => void;
  /** Hides the trigger and forces the modal open — handy when the
   * caller wants to drive the lifecycle (e.g. from a long-press menu
   * that already closed). */
  forceOpen?: boolean;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  target,
  variant = 'link',
  label,
  onClose,
  forceOpen,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const open = forceOpen ?? isOpen;

  const defaultLabel =
    target.kind === 'message'
      ? t('report.reportMessage')
      : target.kind === 'chat'
        ? t('report.reportChat')
        : t('report.reportUser');

  const trigger = label ?? defaultLabel;

  const close = () => {
    setIsOpen(false);
    setCategory(null);
    setDescription('');
    setSubmitting(false);
    setSubmitted(false);
    setErrorMessage(null);
    onClose?.();
  };

  const submit = async () => {
    if (!category || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const trimmed = description.trim();
    const desc = trimmed.length > 0 ? trimmed : undefined;

    let res;
    if (target.kind === 'message') {
      res = await reportMessage(target.messageId, category, desc);
    } else if (target.kind === 'chat') {
      res = await reportChat(target.chatId, category, desc);
    } else {
      res = await reportUser(target.userId, category, desc);
    }

    setSubmitting(false);
    if (res.error) {
      setErrorMessage(t('report.errorGeneric'));
      return;
    }
    setSubmitted(true);
  };

  return (
    <>
      {!forceOpen && (
        variant === 'button' ? (
          <IonButton
            fill="outline"
            color="danger"
            onClick={() => setIsOpen(true)}
          >
            <IonIcon slot="start" icon={flagOutline} />
            {trigger}
          </IonButton>
        ) : (
          <button
            type="button"
            className="report-link"
            onClick={() => setIsOpen(true)}
          >
            <IonIcon icon={flagOutline} />
            <span>{trigger}</span>
            <style>{`
              .report-link {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: transparent;
                border: none;
                color: var(--ion-color-danger, #eb445a);
                padding: 0.5rem 0.75rem;
                font: inherit;
                cursor: pointer;
              }
              .report-link:active { opacity: 0.6; }
            `}</style>
          </button>
        )
      )}

      <IonModal
        isOpen={open}
        onDidDismiss={close}
        breakpoints={[0, 0.6, 1]}
        initialBreakpoint={0.85}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('report.title')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={close}>{t('report.cancel')}</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {submitted ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                padding: '2rem 1rem',
                textAlign: 'center',
              }}
            >
              <IonIcon
                icon={checkmarkCircleOutline}
                style={{ fontSize: '3rem', color: 'var(--ion-color-success)' }}
              />
              <IonText>{t('report.success')}</IonText>
              <IonButton onClick={close}>{t('report.cancel')}</IonButton>
            </div>
          ) : (
            <>
              <IonItem lines="none">
                <IonLabel>
                  <strong>{t('report.categoryLabel')}</strong>
                </IonLabel>
              </IonItem>
              <IonRadioGroup
                value={category}
                onIonChange={(e) =>
                  setCategory((e.detail.value as ReportCategory) ?? null)
                }
              >
                {REPORT_CATEGORY_ORDER.map((c) => (
                  <IonItem key={c}>
                    <IonRadio
                      slot="start"
                      value={c}
                      aria-label={t(`report.categories.${c}`)}
                    />
                    <IonLabel>{t(`report.categories.${c}`)}</IonLabel>
                  </IonItem>
                ))}
              </IonRadioGroup>

              <IonItem lines="none" style={{ marginTop: '1rem' }}>
                <IonLabel position="stacked">
                  {t('report.descriptionLabel')}
                </IonLabel>
                <IonTextarea
                  value={description}
                  onIonInput={(e) =>
                    setDescription((e.detail.value as string) ?? '')
                  }
                  placeholder={t('report.descriptionPlaceholder')}
                  maxlength={2000}
                  autoGrow
                  rows={4}
                />
              </IonItem>

              {errorMessage && (
                <IonText color="danger">
                  <p style={{ padding: '0 1rem' }}>{errorMessage}</p>
                </IonText>
              )}

              <div style={{ padding: '1rem' }}>
                <IonButton
                  expand="block"
                  color="danger"
                  onClick={submit}
                  disabled={!category || submitting}
                >
                  {submitting ? (
                    <>
                      <IonSpinner slot="start" name="crescent" />
                      {t('report.submitting')}
                    </>
                  ) : (
                    t('report.submit')
                  )}
                </IonButton>
              </div>
            </>
          )}
        </IonContent>
      </IonModal>
    </>
  );
};

export default ReportButton;
