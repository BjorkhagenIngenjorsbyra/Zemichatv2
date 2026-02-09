import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
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
} from '@ionic/react';
import { copyOutline, checkmarkOutline, trashOutline } from 'ionicons/icons';
import {
  createInvitation,
  getTeamInvitations,
  deleteInvitation,
  type Invitation,
} from '../services/invitations';

const InviteSuper: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedLink(null);
    setIsCreating(true);

    const { invitation, error: createError } = await createInvitation(
      email,
      displayName || undefined
    );

    if (createError) {
      setError(createError.message);
      setIsCreating(false);
      return;
    }

    if (invitation) {
      const link = `${window.location.origin}/invite/${invitation.token}`;
      setCreatedLink(link);
      setEmail('');
      setDisplayName('');
      await loadInvitations();
    }

    setIsCreating(false);
  };

  const handleCopyLink = async () => {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = createdLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
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

          {createdLink && (
            <div className="invite-success">
              <div className="invite-success-header">
                <span className="invite-success-icon">✅</span>
                <span>{t('invite.inviteSent')}</span>
              </div>
              <div className="invite-link-container">
                <code className="invite-link-text">{createdLink}</code>
                <IonButton
                  fill="outline"
                  size="small"
                  onClick={handleCopyLink}
                  className="invite-copy-btn"
                >
                  <IonIcon
                    icon={linkCopied ? checkmarkOutline : copyOutline}
                    slot="start"
                  />
                  {linkCopied ? t('invite.linkCopied') : t('invite.copyLink')}
                </IonButton>
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
                        <h3>{inv.display_name || inv.email}</h3>
                        <p>{inv.email}</p>
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
            margin-bottom: 8px;
          }
          .invite-success-icon {
            font-size: 20px;
          }
          .invite-link-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .invite-link-text {
            display: block;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
            padding: 8px 12px;
            font-size: 0.8rem;
            word-break: break-all;
            color: hsl(var(--foreground));
          }
          .invite-copy-btn {
            --border-radius: 9999px;
            align-self: flex-start;
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
      </IonContent>
    </IonPage>
  );
};

export default InviteSuper;
