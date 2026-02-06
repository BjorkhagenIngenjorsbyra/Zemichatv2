import { useState, FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { signUp } from '../services/auth';

const Signup: React.FC = () => {
  const history = useHistory();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Losenorden matchar inte');
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Losenordet maste vara minst 8 tecken');
      return;
    }

    setIsLoading(true);

    const { error: signUpError, user } = await signUp({
      email,
      password,
      displayName: displayName || undefined,
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    if (!user) {
      setError('Kunde inte skapa konto');
      setIsLoading(false);
      return;
    }

    // Redirect to create team page
    history.replace('/create-team');
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container">
          <IonButton
            fill="clear"
            className="back-button"
            onClick={() => history.goBack()}
          >
            <IonIcon icon={arrowBack} slot="start" />
            Tillbaka
          </IonButton>

          <div className="auth-header">
            <h1 className="auth-title">Skapa konto</h1>
            <p className="auth-subtitle">
              Registrera dig som Team Owner och bjud in din familj
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <IonText color="danger">{error}</IonText>
              </div>
            )}

            <div className="input-group">
              <IonInput
                type="text"
                placeholder="Ditt namn"
                value={displayName}
                onIonInput={(e) => setDisplayName(e.detail.value || '')}
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <IonInput
                type="email"
                placeholder="E-postadress"
                value={email}
                onIonInput={(e) => setEmail(e.detail.value || '')}
                required
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <IonInput
                type="password"
                placeholder="Losenord (minst 8 tecken)"
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
                placeholder="Bekrafta losenord"
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
              className="auth-button glow-primary"
              disabled={isLoading}
            >
              {isLoading ? <IonSpinner name="crescent" /> : 'Skapa konto'}
            </IonButton>

            <p className="auth-terms">
              Genom att skapa ett konto godkanner du vara{' '}
              <a href="/terms">anvandarvillkor</a> och{' '}
              <a href="/privacy">integritetspolicy</a>.
            </p>
          </form>
        </div>

        <style>{`
          .auth-container {
            display: flex;
            flex-direction: column;
            min-height: 100%;
            max-width: 400px;
            margin: 0 auto;
            padding: 1rem 2rem 2rem;
          }

          .back-button {
            --color: hsl(var(--muted-foreground));
            align-self: flex-start;
            margin-left: -0.5rem;
            margin-bottom: 1rem;
          }

          .auth-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .auth-title {
            font-size: 2rem;
            font-weight: 800;
            color: hsl(var(--primary));
            margin: 0 0 0.5rem 0;
            letter-spacing: -0.02em;
          }

          .auth-subtitle {
            font-size: 1rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
            line-height: 1.5;
          }

          .auth-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .auth-error {
            background: hsl(var(--destructive) / 0.1);
            border: 1px solid hsl(var(--destructive) / 0.3);
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
            margin-bottom: 0.5rem;
          }

          .input-group {
            margin-bottom: 0.25rem;
          }

          .auth-input {
            --background: hsl(var(--card));
            --color: hsl(var(--foreground));
            --placeholder-color: hsl(var(--muted-foreground));
            --border-color: hsl(var(--border));
            --border-radius: 1rem;
            --padding-start: 1rem;
            --padding-end: 1rem;
            --highlight-color-focused: hsl(var(--primary));
          }

          .auth-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --border-radius: 9999px;
            font-weight: 700;
            height: 3rem;
            margin-top: 0.5rem;
          }

          .auth-terms {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            text-align: center;
            line-height: 1.5;
            margin-top: 0.5rem;
          }

          .auth-terms a {
            color: hsl(var(--primary));
            text-decoration: none;
          }

          .auth-terms a:hover {
            text-decoration: underline;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Signup;
