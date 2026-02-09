import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
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
  IonText,
} from '@ionic/react';
import {
  downloadOutline,
  trashOutline,
  warningOutline,
} from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { getTeamMembers } from '../services/members';
import { exportUserData, deleteOwnerAccount, downloadJSON } from '../services/gdpr';
import { UserRole } from '../types/database';

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile, signOut } = useAuthContext();

  const isOwner = profile?.role === UserRole.OWNER;

  const [memberCount, setMemberCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmWord = t('settings.deleteAccountConfirmWord');
  const canDelete = confirmText === confirmWord;

  const loadMemberCount = useCallback(async () => {
    if (!isOwner) return;
    const { members } = await getTeamMembers();
    setMemberCount(members.length);
  }, [isOwner]);

  useEffect(() => {
    loadMemberCount();
  }, [loadMemberCount]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);

    const { data, error } = await exportUserData();

    if (error || !data) {
      setExportError(error?.message || t('settings.exportDataError'));
      setIsExporting(false);
      return;
    }

    const filename = `zemichat-data-${profile?.zemi_number || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJSON(data, filename);
    setExportSuccess(true);
    setIsExporting(false);
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    const { error } = await deleteOwnerAccount();

    if (error) {
      setDeleteError(error.message);
      setIsDeleting(false);
      return;
    }

    await signOut();
    history.replace('/login');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>{t('settings.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="settings-container">
          {/* Profile Section */}
          <div className="section">
            <h3 className="section-title">{t('settings.profile')}</h3>
            <div className="profile-card">
              <div className="profile-row">
                <span className="profile-label">{t('texter.name')}</span>
                <span className="profile-value">{profile?.display_name || '-'}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">{t('texter.zemiNumber')}</span>
                <span className="profile-value mono">{profile?.zemi_number}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">{t('roles.teamOwner')}</span>
                <span className={`role-badge ${profile?.role}`}>
                  {profile?.role === 'owner'
                    ? t('roles.teamOwner')
                    : profile?.role === 'super'
                      ? t('roles.super')
                      : t('roles.texter')}
                </span>
              </div>
            </div>
          </div>

          {/* Export Data Section */}
          <div className="section">
            <h3 className="section-title">{t('settings.exportData')}</h3>
            <div className="card">
              <p className="card-description">{t('settings.exportDataDescription')}</p>
              <IonButton
                expand="block"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <IonSpinner name="crescent" slot="start" />
                    {t('settings.exportDataProgress')}
                  </>
                ) : (
                  <>
                    <IonIcon icon={downloadOutline} slot="start" />
                    {t('settings.exportData')}
                  </>
                )}
              </IonButton>
              {exportSuccess && (
                <p className="success-text">{t('settings.exportDataSuccess')}</p>
              )}
              {exportError && (
                <p className="error-text">{exportError}</p>
              )}
            </div>
          </div>

          {/* Delete Account Section (Owner only) */}
          {isOwner && (
            <div className="section danger-section">
              <h3 className="section-title danger-title">{t('settings.deleteAccount')}</h3>
              <div className="card danger-card">
                <div className="warning-header">
                  <IonIcon icon={warningOutline} className="warning-icon" />
                  <IonText>
                    <p className="danger-description">
                      {t('settings.deleteAccountDescription', { count: memberCount })}
                    </p>
                    <p className="danger-warning">
                      {t('settings.deleteAccountWarning')}
                    </p>
                  </IonText>
                </div>

                <div className="confirm-input">
                  <label className="confirm-label">
                    {t('settings.deleteAccountConfirmLabel')}
                  </label>
                  <IonInput
                    value={confirmText}
                    onIonInput={(e) => setConfirmText(e.detail.value || '')}
                    placeholder={confirmWord}
                    className="confirm-field"
                    disabled={isDeleting}
                  />
                </div>

                <IonButton
                  expand="block"
                  color="danger"
                  onClick={handleDelete}
                  disabled={!canDelete || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <IonSpinner name="crescent" slot="start" />
                      {t('settings.deleteAccountProgress')}
                    </>
                  ) : (
                    <>
                      <IonIcon icon={trashOutline} slot="start" />
                      {t('settings.deleteAccountButton')}
                    </>
                  )}
                </IonButton>

                {deleteError && (
                  <p className="error-text">{deleteError}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <style>{`
          .settings-container {
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

          .profile-card, .card {
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1rem;
          }

          .profile-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
          }

          .profile-row:not(:last-child) {
            border-bottom: 1px solid hsl(var(--border));
          }

          .profile-label {
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .profile-value {
            color: hsl(var(--foreground));
            font-weight: 600;
          }

          .profile-value.mono {
            font-family: monospace;
          }

          .role-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
          }

          .role-badge.owner {
            background: hsl(var(--primary) / 0.15);
            color: hsl(var(--primary));
          }

          .role-badge.super {
            background: hsl(var(--secondary) / 0.15);
            color: hsl(var(--secondary));
          }

          .role-badge.texter {
            background: hsl(var(--muted) / 0.3);
            color: hsl(var(--muted-foreground));
          }

          .card-description {
            color: hsl(var(--muted-foreground));
            margin: 0 0 1rem 0;
            font-size: 0.875rem;
          }

          .success-text {
            color: hsl(var(--secondary));
            font-size: 0.875rem;
            margin: 0.75rem 0 0 0;
            text-align: center;
          }

          .error-text {
            color: hsl(var(--destructive));
            font-size: 0.875rem;
            margin: 0.75rem 0 0 0;
            text-align: center;
          }

          .danger-section {
            margin-top: 3rem;
          }

          .danger-title {
            color: hsl(var(--destructive)) !important;
          }

          .danger-card {
            border-color: hsl(var(--destructive) / 0.3);
          }

          .warning-header {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          }

          .warning-icon {
            color: hsl(var(--destructive));
            font-size: 1.5rem;
            flex-shrink: 0;
            margin-top: 0.125rem;
          }

          .danger-description {
            color: hsl(var(--foreground));
            margin: 0 0 0.5rem 0;
            font-size: 0.875rem;
          }

          .danger-warning {
            color: hsl(var(--destructive));
            font-weight: 700;
            margin: 0;
            font-size: 0.875rem;
          }

          .confirm-input {
            margin-bottom: 1rem;
          }

          .confirm-label {
            display: block;
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            margin-bottom: 0.5rem;
          }

          .confirm-field {
            --background: hsl(var(--background));
            --border-color: hsl(var(--border));
            --border-radius: 0.5rem;
            --padding-start: 0.75rem;
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
