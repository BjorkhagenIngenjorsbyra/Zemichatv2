import { useState, FormEvent, useEffect, useRef } from 'react';
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
import { useAuthContext } from '../contexts/AuthContext';
import { createTeam } from '../services/team';
import { ConfettiAnimation } from '../components/ConfettiAnimation';
import { hapticSuccess } from '../utils/haptics';

const CreateTeam: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { authUser, hasProfile, refreshProfile } = useAuthContext();
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (hasProfile && !showConfetti) {
      history.replace('/dashboard');
    }
  }, [hasProfile, history, showConfetti]);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      history.replace('/login');
    }
  }, [authUser, history]);

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

    await refreshProfile();
    setShowConfetti(true);
    hapticSuccess();
    redirectTimer.current = setTimeout(() => history.replace('/dashboard'), 2000);
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="create-team-container">
          <div className="create-team-header">
            <div className="step-indicator">
              <span className="step-badge">{t('team.stepOf', { current: 2, total: 2 })}</span>
            </div>
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
          </form>
        </div>

        <ConfettiAnimation active={showConfetti} duration={2000} />

        <style>{`
          .create-team-container {
            display: flex;
            flex-direction: column;
            min-height: 100%;
            max-width: 480px;
            margin: 0 auto;
            padding: 2rem;
          }

          .create-team-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .step-indicator {
            margin-bottom: 1rem;
          }

          .step-badge {
            background: hsl(var(--primary) / 0.15);
            color: hsl(var(--primary));
            padding: 0.375rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 600;
          }

          .create-team-title {
            font-size: 2rem;
            font-weight: 800;
            color: hsl(var(--foreground));
            margin: 0 0 0.75rem 0;
            letter-spacing: -0.02em;
          }

          .create-team-subtitle {
            font-size: 1rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
            line-height: 1.5;
          }

          .create-team-form {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }

          .create-team-error {
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
            color: hsl(var(--foreground));
            margin-left: 0.25rem;
          }

          .create-team-input {
            --background: transparent;
            --border-color: hsl(var(--border) / 0.3);
            --border-radius: 1rem;
          }

          .info-box {
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1.25rem;
          }

          .info-box p {
            margin: 0 0 0.75rem 0;
            font-size: 0.9rem;
            color: hsl(var(--foreground));
          }

          .info-box ul {
            margin: 0;
            padding-left: 1.25rem;
          }

          .info-box li {
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            line-height: 1.6;
          }

          .create-team-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            height: 3rem;
            margin-top: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default CreateTeam;
