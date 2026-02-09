import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonInput,
  IonTextarea,
  IonAccordionGroup,
  IonAccordion,
  IonItem,
  IonLabel,
} from '@ionic/react';
import {
  mailOutline,
  imageOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { SupportRequestType } from '../types/database';
import { buildMailtoUrl, submitSupportRequest } from '../services/support';

const Support: React.FC = () => {
  const { t } = useTranslation();

  // Form state
  const [selectedType, setSelectedType] = useState<SupportRequestType>(SupportRequestType.SUPPORT);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && email.trim().includes('@');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const { error } = await submitSupportRequest({
      type: selectedType,
      subject: subject.trim(),
      description: description.trim(),
      email: email.trim(),
      screenshotFile: screenshot || undefined,
    });

    setIsSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    setSubmitted(true);
    setSubject('');
    setDescription('');
    setEmail('');
    setScreenshot(null);
  };

  const faqKeys = ['inviteFamily', 'howSos', 'whyVisible', 'upgradePro', 'deleteAccount'] as const;

  const typeOptions: { value: SupportRequestType; labelKey: string }[] = [
    { value: SupportRequestType.BUG, labelKey: 'support.typeBug' },
    { value: SupportRequestType.SUGGESTION, labelKey: 'support.typeSuggestion' },
    { value: SupportRequestType.SUPPORT, labelKey: 'support.typeSupport' },
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" />
          </IonButtons>
          <IonTitle>{t('support.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="support-container">
          {/* FAQ Section */}
          <div className="section">
            <h3 className="section-title">{t('support.faqTitle')}</h3>
            <IonAccordionGroup>
              {faqKeys.map((key) => (
                <IonAccordion key={key} value={key}>
                  <IonItem slot="header">
                    <IonLabel className="faq-question">
                      {t(`support.faq.${key}.question`)}
                    </IonLabel>
                  </IonItem>
                  <div className="faq-answer" slot="content">
                    <p>{t(`support.faq.${key}.answer`)}</p>
                  </div>
                </IonAccordion>
              ))}
            </IonAccordionGroup>
          </div>

          {/* Contact Section */}
          <div className="section">
            <h3 className="section-title">{t('support.contactTitle')}</h3>
            <div className="card">
              <p className="card-description">{t('support.contactDescription')}</p>
              <IonButton expand="block" fill="outline" href={buildMailtoUrl()}>
                <IonIcon icon={mailOutline} slot="start" />
                {t('support.contactButton')}
              </IonButton>
            </div>
          </div>

          {/* Feedback Form */}
          <div className="section">
            <h3 className="section-title">{t('support.feedbackTitle')}</h3>
            <div className="card">
              {submitted ? (
                <div className="success-container">
                  <IonIcon icon={checkmarkCircleOutline} className="success-icon" />
                  <p className="success-text">{t('support.successMessage')}</p>
                </div>
              ) : (
                <>
                  <p className="card-description">{t('support.feedbackDescription')}</p>

                  {/* Type selector */}
                  <div className="type-selector">
                    {typeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        className={`type-pill ${selectedType === opt.value ? 'active' : ''}`}
                        onClick={() => setSelectedType(opt.value)}
                      >
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </div>

                  {/* Subject */}
                  <div className="form-field">
                    <label className="field-label">{t('support.subjectLabel')}</label>
                    <IonInput
                      value={subject}
                      onIonInput={(e) => setSubject(e.detail.value || '')}
                      placeholder={t('support.subjectPlaceholder')}
                      maxlength={200}
                      className="form-input"
                    />
                  </div>

                  {/* Description */}
                  <div className="form-field">
                    <label className="field-label">{t('support.descriptionLabel')}</label>
                    <IonTextarea
                      value={description}
                      onIonInput={(e) => setDescription(e.detail.value || '')}
                      placeholder={t('support.descriptionPlaceholder')}
                      maxlength={5000}
                      rows={4}
                      className="form-input"
                    />
                  </div>

                  {/* Email */}
                  <div className="form-field">
                    <label className="field-label">{t('support.emailLabel')}</label>
                    <IonInput
                      type="email"
                      value={email}
                      onIonInput={(e) => setEmail(e.detail.value || '')}
                      placeholder={t('support.emailPlaceholder')}
                      className="form-input"
                    />
                  </div>

                  {/* Screenshot */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <IonButton
                    fill="outline"
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    className="screenshot-btn"
                  >
                    <IonIcon icon={imageOutline} slot="start" />
                    {screenshot ? screenshot.name : t('support.attachScreenshot')}
                  </IonButton>

                  {/* Submit */}
                  <IonButton
                    expand="block"
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    className="submit-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <IonSpinner name="crescent" slot="start" />
                        {t('support.submitting')}
                      </>
                    ) : (
                      t('support.submitButton')
                    )}
                  </IonButton>

                  {submitError && (
                    <p className="error-text">{submitError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <style>{`
          .support-container {
            max-width: 600px;
            margin: 0 auto;
          }

          .section {
            margin-bottom: 2rem;
          }

          .section-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 1rem 0;
          }

          .card {
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1rem;
          }

          .card-description {
            color: hsl(var(--muted-foreground));
            margin: 0 0 1rem 0;
            font-size: 0.875rem;
          }

          .faq-question {
            font-weight: 500;
            font-size: 0.9rem;
          }

          .faq-answer {
            padding: 0 1rem 1rem 1rem;
          }

          .faq-answer p {
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
            line-height: 1.6;
            margin: 0;
          }

          .type-selector {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .type-pill {
            flex: 1;
            padding: 0.5rem 0.75rem;
            border-radius: 9999px;
            border: 1px solid hsl(var(--border));
            background: transparent;
            color: hsl(var(--foreground));
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .type-pill.active {
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border-color: hsl(var(--primary));
          }

          .form-field {
            margin-bottom: 1rem;
          }

          .field-label {
            display: block;
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            margin-bottom: 0.5rem;
          }

          .form-input {
            --background: hsl(var(--background));
            --border-color: hsl(var(--border));
            --border-radius: 0.5rem;
            --padding-start: 0.75rem;
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
          }

          .screenshot-btn {
            margin-bottom: 1rem;
            --border-radius: 0.5rem;
            font-size: 0.8rem;
          }

          .submit-btn {
            margin-top: 0.5rem;
          }

          .success-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem 1rem;
            gap: 1rem;
          }

          .success-icon {
            font-size: 3rem;
            color: hsl(var(--secondary));
          }

          .success-text {
            color: hsl(var(--secondary));
            font-size: 0.875rem;
            margin: 0;
            text-align: center;
          }

          .error-text {
            color: hsl(var(--destructive));
            font-size: 0.875rem;
            margin: 0.75rem 0 0 0;
            text-align: center;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Support;
