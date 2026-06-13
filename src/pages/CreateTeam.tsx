import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
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
} from '@ionic/react';
import { checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { createTeam } from '../services/team';
import { PlanType } from '../types/database';
import { validateReferralCode, submitReferral } from '../services/referral';
import { ConfettiAnimation } from '../components/ConfettiAnimation';
import { hapticSuccess } from '../utils/haptics';
import './CreateTeam.css';

const CreateTeam: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { authUser, hasProfile, refreshProfile, signOut } = useAuthContext();
  const { startTrial } = useSubscription();
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Referral step state
  const [showReferralStep, setShowReferralStep] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralTeamName, setReferralTeamName] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);

  const redirectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const validateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (hasProfile && !showConfetti && !showReferralStep) {
      history.replace('/chats');
    }
  }, [hasProfile, history, showConfetti, showReferralStep]);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
      if (validateTimer.current) clearTimeout(validateTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      history.replace('/login');
    }
  }, [authUser, history]);

  const handleFinish = useCallback(async () => {
    await startTrial(PlanType.PRO);
    history.replace('/chats');
  }, [startTrial, history]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!teamName.trim()) {
      setError(t('team.enterTeamName'));
      return;
    }

    if (!authUser) {
      setError(t('common.error'));
      return;
    }

    setIsLoading(true);

    const displayName = authUser.user_metadata?.display_name as string | undefined;

    const { error: createError } = await createTeam({
      name: teamName.trim(),
      ownerId: authUser.id,
      ownerDisplayName: displayName,
    });

    if (createError) {
      setError(createError.message);
      setIsLoading(false);
      return;
    }

    setShowConfetti(true);
    hapticSuccess();
    await refreshProfile();

    // Show referral step after confetti
    redirectTimer.current = setTimeout(() => {
      setShowReferralStep(true);
    }, 2000);
  };

  const handleReferralCodeChange = (value: string) => {
    const code = value.toUpperCase();
    setReferralCode(code);
    setReferralValid(null);
    setReferralTeamName(null);

    if (validateTimer.current) clearTimeout(validateTimer.current);

    if (code.length >= 5) {
      setIsValidating(true);
      validateTimer.current = setTimeout(async () => {
        const { valid, teamName: name } = await validateReferralCode(code);
        setReferralValid(valid);
        setReferralTeamName(name);
        setIsValidating(false);
      }, 500);
    }
  };

  const handleContinueWithReferral = async () => {
    if (!referralValid || !referralCode) return;
    setIsSubmittingReferral(true);
    await submitReferral(referralCode);
    setIsSubmittingReferral(false);
    await handleFinish();
  };

  const handleSkipReferral = async () => {
    await handleFinish();
  };

  // Referral step view (shown after team creation + confetti)
  if (showReferralStep) {
    return (
      <IonPage>
        <IonContent className="ion-padding" fullscreen>
          <div className="create-team-container">
            <div className="create-team-header">
              <h1 className="create-team-title">{t('referral.haveCode')}</h1>
            </div>

            <div className="referral-form">
              <div className="input-group">
                <label className="input-label">{t('referral.enterCode')}</label>
                <IonInput
                  type="text"
                  placeholder="ZEMI-XXXXXX"
                  value={referralCode}
                  onIonInput={(e) => handleReferralCodeChange(e.detail.value || '')}
                  className="create-team-input"
                  fill="outline"
                  maxlength={11}
                />
              </div>

              {isValidating && (
                <div className="referral-status">
                  <IonSpinner name="crescent" />
                </div>
              )}

              {!isValidating && referralValid === true && referralTeamName && (
                <div className="referral-status referral-valid">
                  <IonIcon icon={checkmarkCircleOutline} />
                  <span>{t('referral.codeValid', { teamName: referralTeamName })}</span>
                </div>
              )}

              {!isValidating && referralValid === false && referralCode.length >= 5 && (
                <div className="referral-status referral-invalid">
                  <IonIcon icon={closeCircleOutline} />
                  <span>{t('referral.codeInvalid')}</span>
                </div>
              )}

              <IonButton
                expand="block"
                className="create-team-button glow-primary"
                disabled={!referralValid || isSubmittingReferral}
                onClick={handleContinueWithReferral}
              >
                {isSubmittingReferral ? <IonSpinner name="crescent" /> : t('referral.continue')}
              </IonButton>

              <button
                className="skip-link"
                onClick={handleSkipReferral}
                type="button"
              >
                {t('referral.skip')}
              </button>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="create-team-container">
          <div className="create-team-header">
            <h1 className="create-team-title">{t('team.createTitle')}</h1>
            <p className="create-team-subtitle">{t('team.createSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="create-team-form">
            {error && (
              <div className="create-team-error">
                <IonText color="danger">{error}</IonText>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">{t('team.teamName')}</label>
              <IonInput
                type="text"
                placeholder={t('team.teamNamePlaceholder')}
                value={teamName}
                onIonInput={(e) => setTeamName(e.detail.value || '')}
                required
                className="create-team-input"
                fill="outline"
              />
            </div>

            <div className="info-box">
              <p>
                <strong>{t('team.ownerCapabilities')}</strong>
              </p>
              <ul>
                <li>{t('team.capability1')}</li>
                <li>{t('team.capability2')}</li>
                <li>{t('team.capability3')}</li>
                <li>{t('team.capability4')}</li>
              </ul>
            </div>

            <IonButton
              type="submit"
              expand="block"
              className="create-team-button glow-primary"
              disabled={isLoading || showConfetti}
            >
              {isLoading ? <IonSpinner name="crescent" /> : t('team.createButton')}
            </IonButton>

            <button
              className="create-team-signout-link"
              onClick={async () => {
                await signOut();
                history.replace('/login');
              }}
              type="button"
            >
              {t('auth.logout')}
            </button>
          </form>
        </div>

        <ConfettiAnimation active={showConfetti} duration={2000} />
      </IonContent>
    </IonPage>
  );
};

export default CreateTeam;
