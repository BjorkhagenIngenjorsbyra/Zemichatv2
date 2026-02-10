import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonCheckbox,
} from '@ionic/react';
import { signUp } from '../services/auth';
import { getInvitationByToken, claimInvitation, type InvitationPublicInfo } from '../services/invitations';
import { PasswordStrength } from '../components/PasswordStrength';

const SuperInvite: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const history = useHistory();

  const [invitation, setInvitation] = useState<InvitationPublicInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      const { invitation: inv, error: err } = await getInvitationByToken(token);
      if (err) {
        const msg = err.message;
        if (msg.includes('expired')) {
          setLoadError(t('invite.tokenExpired'));
        } else if (msg.includes('claimed')) {
          setLoadError(t('invite.alreadyHasAccount'));
        } else {
          setLoadError(t('invite.invalidToken'));
        }
      } else {
        setInvitation(inv);
        if (inv?.email) {
          setEmail(inv.email);
        }
        if (inv?.invited_display_name) {
          setDisplayName(inv.invited_display_name);
        }
      }
      setLoadingInvite(false);
    }
    loadInvitation();
  }, [token, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordTooShort', { min: 8 }));
      return;
    }

    if (!consentAccepted) {
      setError(t('auth.consentRequired'));
      return;
    }

    setIsLoading(true);

    // Step 1: Sign up the user
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
      setError(t('common.error'));
      setIsLoading(false);
      return;
    }

    // Step 2: Claim the invitation (creates user profile in team)
    const { error: claimError } = await claimInvitation(token);

    if (claimError) {
      setError(claimError.message);
      setIsLoading(false);
      return;
    }

    // Step 3: Redirect to Super tour
    history.replace('/super-tour');
  };

  if (loadingInvite) {
    return (
      <IonPage>
        <IonContent className="ion-padding" fullscreen>
          <div className="invite-loading">
            <IonSpinner name="crescent" />
          </div>
          <style>{`
            .invite-loading {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100%;
            }
          `}</style>
        </IonContent>
      </IonPage>
    );
  }

  if (loadError) {
    return (
      <IonPage>
        <IonContent className="ion-padding" fullscreen>
          <div className="invite-error-container">
            <div className="invite-error-icon">😔</div>
            <h2>{t('invite.invalidToken')}</h2>
            <p>{loadError}</p>
            <IonButton expand="block" onClick={() => history.push('/login')}>
              {t('auth.login')}
            </IonButton>
          </div>
          <style>{`
            .invite-error-container {
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
            .invite-error-icon {
              font-size: 64px;
              margin-bottom: 16px;
            }
            .invite-error-container h2 {
              font-size: 1.5rem;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .invite-error-container p {
              color: hsl(0 0% 45%);
              margin-bottom: 24px;
            }
          `}</style>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container">
          <div className="invite-header">
            <div className="invite-icon">🎉</div>
            <h1 className="invite-title">{t('invite.claimTitle')}</h1>
            <p className="invite-desc">
              {t('invite.claimDesc', {
                inviter: invitation?.inviter_name || '',
                team: invitation?.team_name || '',
              })}
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
                placeholder={t('auth.yourName')}
                value={displayName}
                onIonInput={(e) => setDisplayName(e.detail.value || '')}
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="input-group">
              <IonInput
                type="email"
                placeholder={t('auth.email')}
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
                placeholder={t('auth.passwordMinLength')}
                value={password}
                onIonInput={(e) => setPassword(e.detail.value || '')}
                required
                className="auth-input"
                fill="outline"
              />
              <PasswordStrength password={password} />
            </div>

            <div className="input-group">
              <IonInput
                type="password"
                placeholder={t('auth.confirmPassword')}
                value={confirmPassword}
                onIonInput={(e) => setConfirmPassword(e.detail.value || '')}
                required
                className="auth-input"
                fill="outline"
              />
            </div>

            <div className="consent-row">
              <IonCheckbox
                checked={consentAccepted}
                onIonChange={(e) => setConsentAccepted(e.detail.checked)}
                className="consent-checkbox"
              />
              <label className="consent-label">
                {t('auth.consentLabel')}{' '}
                <a href="/terms">{t('auth.termsLink')}</a> {t('common.and')}{' '}
                <a href="/privacy">{t('auth.privacyLink')}</a>
              </label>
            </div>

            <IonButton
              type="submit"
              expand="block"
              className="auth-button glow-primary"
              disabled={isLoading || !consentAccepted}
            >
              {isLoading ? <IonSpinner name="crescent" /> : t('invite.claimButton')}
            </IonButton>
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
          .invite-header {
            text-align: center;
            margin-bottom: 2rem;
            padding-top: 2rem;
          }
          .invite-icon {
            font-size: 56px;
            margin-bottom: 12px;
          }
          .invite-title {
            font-size: 1.75rem;
            font-weight: 800;
            color: hsl(var(--primary));
            margin: 0 0 0.5rem 0;
          }
          .invite-desc {
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
          }
          .auth-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            height: 3rem;
            margin-top: 0.5rem;
          }
          .consent-row {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            margin-top: 0.5rem;
          }
          .consent-checkbox {
            --size: 20px;
            --checkbox-background-checked: hsl(var(--primary));
            --border-color: hsl(var(--border));
            --border-color-checked: hsl(var(--primary));
            margin-top: 2px;
            flex-shrink: 0;
          }
          .consent-label {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            line-height: 1.5;
          }
          .consent-label a {
            color: hsl(var(--primary));
            text-decoration: none;
          }
          .consent-label a:hover {
            text-decoration: underline;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default SuperInvite;
