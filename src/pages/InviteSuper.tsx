import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonToast,
} from '@ionic/react';
import { trashOutline, copyOutline } from 'ionicons/icons';
import {
  createInvitation,
  getTeamInvitations,
  deleteInvitation,
  sendInvitationEmail,
  type Invitation,
} from '../services/invitations';
import { getCurrentLanguage } from '../i18n';

const InviteSuper: React.FC = () => {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);

  const loadInvitations = useCallback(async () => {
    const { invitations: data } = await getTeamInvitations();
    setInvitations(data);
    setLoadingInvitations(false);
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setLinkCopied(true);
    } catch {
      // Fallback for older browsers/webviews
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setLinkCopied(true);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSentToEmail(null);
    setInviteLink(null);
    setIsCreating(true);

    const recipientEmail = email;

    const { invitation, error: createError } = await createInvitation(recipientEmail, displayName.trim() || undefined);

    if (createError) {
      setError(createError.message);
      setIsCreating(false);
      return;
    }

    if (invitation) {
      const link = `${window.location.origin}/invite/${invitation.token}?lang=${getCurrentLanguage()}`;

      // Try to send invitation email via Edge Function
      const { error: sendError } = await sendInvitationEmail(
        recipientEmail,
        invitation.id,
        link
      );

      if (sendError) {
        // Invitation was created but email failed — show link for manual sharing
        setInviteLink(link);
        setSentToEmail(recipientEmail);
        setEmail('');
        setDisplayName('');
        await loadInvitations();
        setIsCreating(false);
        return;
      }

      setSentToEmail(recipientEmail);
      setEmail('');
      setDisplayName('');
      await loadInvitations();
    }

    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    const { error: delError } = await deleteInvitation(id);
    if (!delError) {
      await loadInvitations();
    }
  };

  const getInvitationStatus = (inv: Invitation): { label: string; color: string } => {
    if (inv.claimed_at) {
      return { label: t('invite.claimed'), color: '#22C55E' };
    }
    if (new Date(inv.expires_at) < new Date()) {
      return { label: t('invite.expired'), color: '#EF4444' };
    }
    return {
      label: t('invite.expires', {
        date: new Date(inv.expires_at).toLocaleDateString(),
      }),
      color: '#F59E0B',
    };
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>{t('invite.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <div className="invite-super-container">
          <form onSubmit={handleCreate} className="invite-form">
            {error && (
              <div className="invite-error">
                <IonText color="danger">{error}</IonText>
              </div>
            )}

            <div className="input-group">
              <IonInput
                type="text"
                label={t('invite.nameLabel')}
                labelPlacement="stacked"
                placeholder={t('invite.namePlaceholder')}
                value={displayName}
                onIonInput={(e) => setDisplayName(e.detail.value || '')}
                className="invite-input"
                fill="outline"
                maxlength={50}
              />
            </div>

            <div className="input-group">
              <IonInput
                type="email"
                label={t('invite.emailLabel')}
                labelPlacement="stacked"
                placeholder={t('invite.emailPlaceholder')}
                value={email}
                onIonInput={(e) => setEmail(e.detail.value || '')}
                required
                className="invite-input"
                fill="outline"
              />
            </div>

            <IonButton
              type="submit"
              expand="block"
              className="invite-submit-btn"
              disabled={isCreating || !email}
            >
              {isCreating ? <IonSpinner name="crescent" /> : t('invite.sendInvite')}
            </IonButton>
          </form>

          {sentToEmail && !inviteLink && (
            <div className="invite-success">
              <div className="invite-success-header">
                <span className="invite-success-icon">&#x2705;</span>
                <span>{t('invite.inviteSentToEmail', { email: sentToEmail })}</span>
              </div>
            </div>
          )}

          {sentToEmail && inviteLink && (
            <div className="invite-link-fallback">
              <p className="invite-link-msg">
                {t('invite.emailFailed', { email: sentToEmail })}
              </p>
              <div className="invite-link-box">
                <span className="invite-link-text">{inviteLink}</span>
                <button
                  className="invite-copy-btn"
                  onClick={() => copyToClipboard(inviteLink)}
                  type="button"
                >
                  <IonIcon icon={copyOutline} />
                  {t('invite.copyLink')}
                </button>
              </div>
            </div>
          )}

          <div className="invite-pending-section">
            <h3 className="invite-pending-title">{t('invite.pendingInvites')}</h3>
            {loadingInvitations ? (
              <div className="invite-pending-loading">
                <IonSpinner name="dots" />
              </div>
            ) : invitations.length === 0 ? (
              <p className="invite-pending-empty">{t('invite.noPending')}</p>
            ) : (
              <IonList className="invite-list">
                {invitations.map((inv) => {
                  const status = getInvitationStatus(inv);
                  return (
                    <IonItem key={inv.id} className="invite-list-item">
                      <IonLabel>
                        <h3>{inv.email}</h3>
                        <p style={{ color: status.color, fontSize: '0.8rem' }}>
                          {status.label}
                        </p>
                      </IonLabel>
                      {!inv.claimed_at && new Date(inv.expires_at) >= new Date() && (
                        <IonButton
                          fill="clear"
                          color="danger"
                          slot="end"
                          onClick={() => handleDelete(inv.id)}
                        >
                          <IonIcon icon={trashOutline} />
                        </IonButton>
                      )}
                    </IonItem>
                  );
                })}
              </IonList>
            )}
          </div>
        </div>

        <style>{`
          .invite-super-container {
            max-width: 500px;
            margin: 0 auto;
          }
          .invite-form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 1.5rem;
          }
          .invite-error {
            background: hsl(var(--destructive) / 0.1);
            border: 1px solid hsl(var(--destructive) / 0.3);
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
          }
          .input-group {
            margin-bottom: 0.25rem;
          }
          .invite-input {
            --background: hsl(var(--card));
            --color: hsl(var(--foreground));
            --placeholder-color: hsl(var(--muted-foreground));
            --border-color: hsl(var(--border));
            --border-radius: 1rem;
            --padding-start: 1rem;
            --padding-end: 1rem;
            --highlight-color-focused: hsl(var(--primary));
          }
          .invite-submit-btn {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --border-radius: 9999px;
            font-weight: 700;
            height: 3rem;
          }
          .invite-success {
            background: hsl(142 76% 36% / 0.08);
            border: 1px solid hsl(142 76% 36% / 0.25);
            border-radius: 1rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
          }
          .invite-success-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
          }
          .invite-success-icon {
            font-size: 20px;
          }
          .invite-link-fallback {
            background: hsl(45 93% 47% / 0.08);
            border: 1px solid hsl(45 93% 47% / 0.25);
            border-radius: 1rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
          }
          .invite-link-msg {
            font-size: 0.9rem;
            color: hsl(var(--foreground));
            margin: 0 0 0.75rem 0;
          }
          .invite-link-box {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .invite-link-text {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            word-break: break-all;
            background: hsl(var(--card));
            padding: 0.5rem 0.75rem;
            border-radius: 0.5rem;
            border: 1px solid hsl(var(--border));
          }
          .invite-copy-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border: none;
            border-radius: 9999px;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
          }
          .invite-copy-btn ion-icon {
            font-size: 1rem;
          }
          .invite-pending-section {
            margin-top: 1rem;
          }
          .invite-pending-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
          }
          .invite-pending-loading {
            display: flex;
            justify-content: center;
            padding: 1rem;
          }
          .invite-pending-empty {
            color: hsl(var(--muted-foreground));
            text-align: center;
            padding: 1rem;
          }
          .invite-list {
            border-radius: 1rem;
            overflow: hidden;
          }
          .invite-list-item {
            --padding-start: 0;
          }
        `}</style>

        <IonToast
          isOpen={linkCopied}
          message={t('invite.linkCopied')}
          duration={2000}
          onDidDismiss={() => setLinkCopied(false)}
          color="success"
        />
      </IonContent>
    </IonPage>
  );
};

export default InviteSuper;
