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
import { signUp, signIn } from '../services/auth';
import { getInvitationByToken, claimInvitation, type InvitationPublicInfo } from '../services/invitations';
import { PasswordStrength } from '../components/PasswordStrength';
import '../theme/auth-forms.css';

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
  const [emailSent, setEmailSent] = useState(false);

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

    // Step 2: Try to sign in (may fail if email confirmation is required)
    const { error: signInError } = await signIn({ email, password });

    if (signInError) {
      // Email not confirmed — this is expected when email verification is enabled
      // Store the token so we can claim the invitation after email verification + login
      localStorage.setItem('zemichat-pending-invite-token', token);
      setEmailSent(true);
      setIsLoading(false);
      return;
    }

    // Step 3: Claim the invitation (creates user profile in team)
    const { error: claimError } = await claimInvitation(token);

    if (claimError) {
      setError(claimError.message);
      setIsLoading(false);
      return;
    }

    // Step 4: Redirect to Super tour
    history.replace('/super-tour');
  };

  if (loadingInvite) {
    return (
      <IonPage>
        <IonContent className="ion-padding" fullscreen>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (loadError) {
    return (
      <IonPage>
        <IonContent className="ion-padding" fullscreen>
          <div className="auth-container" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>😔</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>{t('invite.invalidToken')}</h2>
            <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '24px' }}>{loadError}</p>
            <IonButton expand="block" className="auth-button" onClick={() => history.push('/login')}>
              {t('auth.login')}
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (emailSent) {
    return (
      <IonPage>
        <IonContent className="ion-padding" fullscreen>
          <div className="auth-container" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📧</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>{t('invite.verificationSentTitle')}</h2>
            <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '24px' }}>{t('invite.verificationSentDesc')}</p>
            <IonButton expand="block" className="auth-button" onClick={() => history.push('/login')}>
              {t('auth.login')}
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container" style={{ justifyContent: 'flex-start', paddingTop: '1rem' }}>
          <div className="auth-header" style={{ paddingTop: '2rem' }}>
            <div style={{ fontSize: '56px', marginBottom: '12px' }}>🎉</div>
            <h1 className="auth-title" style={{ fontSize: '1.75rem' }}>{t('invite.claimTitle')}</h1>
            <p className="auth-subtitle">
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
              className="auth-button"
              disabled={isLoading || !consentAccepted}
            >
              {isLoading ? <IonSpinner name="crescent" /> : t('invite.claimButton')}
            </IonButton>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SuperInvite;
