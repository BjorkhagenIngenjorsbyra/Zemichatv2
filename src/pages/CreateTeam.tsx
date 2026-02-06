import { useState, FormEvent, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
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

const CreateTeam: React.FC = () => {
  const history = useHistory();
  const { authUser, hasProfile, refreshProfile } = useAuthContext();
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if user already has a team
  useEffect(() => {
    if (hasProfile) {
      history.replace('/dashboard');
    }
  }, [hasProfile, history]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authUser) {
      history.replace('/login');
    }
  }, [authUser, history]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!teamName.trim()) {
      setError('Ange ett teamnamn');
      return;
    }

    if (!authUser) {
      setError('Du maste vara inloggad');
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

    // Refresh profile to update the auth context
    await refreshProfile();

    // Redirect to dashboard
    history.replace('/dashboard');
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="create-team-container">
          <div className="create-team-header">
            <div className="step-indicator">
              <span className="step-badge">Steg 2 av 2</span>
            </div>
            <h1 className="create-team-title">Skapa ditt team</h1>
            <p className="create-team-subtitle">
              Ge ditt team ett namn - det kan vara din familj, organisation eller vad du vill
            </p>
          </div>

          <form onSubmit={handleSubmit} className="create-team-form">
            {error && (
              <div className="create-team-error">
                <IonText color="danger">{error}</IonText>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Teamnamn</label>
              <IonInput
                type="text"
                placeholder="t.ex. Familjen Andersson"
                value={teamName}
                onIonInput={(e) => setTeamName(e.detail.value || '')}
                required
                className="create-team-input"
                fill="outline"
              />
            </div>

            <div className="info-box">
              <p>
                <strong>Som Team Owner kan du:</strong>
              </p>
              <ul>
                <li>Bjuda in familjemedlemmar som Super eller Texter</li>
                <li>Se alla meddelanden fran dina Texters</li>
                <li>Hantera instellningar och behorigher</li>
                <li>Godkanna vanforfrågningar for Texters</li>
              </ul>
            </div>

            <IonButton
              type="submit"
              expand="block"
              className="create-team-button glow-primary"
              disabled={isLoading}
            >
              {isLoading ? <IonSpinner name="crescent" /> : 'Skapa team'}
            </IonButton>
          </form>
        </div>

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
            --background: hsl(var(--card));
            --color: hsl(var(--foreground));
            --placeholder-color: hsl(var(--muted-foreground));
            --border-color: hsl(var(--border));
            --border-radius: 1rem;
            --padding-start: 1rem;
            --padding-end: 1rem;
            --highlight-color-focused: hsl(var(--primary));
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
            --border-radius: 9999px;
            font-weight: 700;
            height: 3rem;
            margin-top: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default CreateTeam;
