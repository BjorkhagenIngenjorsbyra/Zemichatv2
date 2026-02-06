import { useState, useEffect, useCallback } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonAvatar,
  IonSpinner,
  IonIcon,
  IonButton,
  IonAlert,
  IonText,
} from '@ionic/react';
import {
  imageOutline,
  micOutline,
  videocamOutline,
  documentOutline,
  locationOutline,
  callOutline,
  desktopOutline,
  personOutline,
  banOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { supabase } from '../services/supabase';
import {
  getTexterSettings,
  updateTexterSettings,
  deactivateMember,
  reactivateMember,
} from '../services/members';
import { QuickMessageManager, QuietHoursManager } from '../components/owner';
import { type User, type TexterSettings } from '../types/database';

const TexterDetail: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<TexterSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeactivateAlert, setShowDeactivateAlert] = useState(false);
  const [showReactivateAlert, setShowReactivateAlert] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      history.replace('/dashboard');
      return;
    }

    setUser(userData as unknown as User);

    // Get texter settings
    const { settings: texterSettings } = await getTexterSettings(userId);
    setSettings(texterSettings);
    setIsLoading(false);
  }, [userId, history]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (field: keyof TexterSettings, value: boolean) => {
    if (!userId || !settings) return;

    setIsSaving(true);

    // Optimistic update
    setSettings({ ...settings, [field]: value });

    const { error } = await updateTexterSettings(userId, { [field]: value });

    if (error) {
      // Revert on error
      setSettings({ ...settings, [field]: !value });
      console.error('Failed to update setting:', error);
    }

    setIsSaving(false);
  };

  const handleDeactivate = async () => {
    if (!userId) return;

    setIsSaving(true);
    const { error } = await deactivateMember(userId);

    if (error) {
      console.error('Failed to deactivate member:', error);
    } else {
      setUser(user ? { ...user, is_active: false } : null);
    }

    setIsSaving(false);
    setShowDeactivateAlert(false);
  };

  const handleReactivate = async () => {
    if (!userId) return;

    setIsSaving(true);
    const { error } = await reactivateMember(userId);

    if (error) {
      console.error('Failed to reactivate member:', error);
    } else {
      setUser(user ? { ...user, is_active: true } : null);
    }

    setIsSaving(false);
    setShowReactivateAlert(false);
  };

  if (isLoading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/dashboard" />
            </IonButtons>
            <IonTitle>{t('common.loading')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="loading-state">
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!user) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/dashboard" />
            </IonButtons>
            <IonTitle>{t('common.error')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p>{t('texterDetail.notFound')}</p>
        </IonContent>
      </IonPage>
    );
  }

  const toggleItems = settings
    ? [
        {
          field: 'can_send_images' as const,
          label: t('texterDetail.canSendImages'),
          icon: imageOutline,
          value: settings.can_send_images,
        },
        {
          field: 'can_send_voice' as const,
          label: t('texterDetail.canSendVoice'),
          icon: micOutline,
          value: settings.can_send_voice,
        },
        {
          field: 'can_send_video' as const,
          label: t('texterDetail.canSendVideo'),
          icon: videocamOutline,
          value: settings.can_send_video,
        },
        {
          field: 'can_send_documents' as const,
          label: t('texterDetail.canSendDocuments'),
          icon: documentOutline,
          value: settings.can_send_documents,
        },
        {
          field: 'can_share_location' as const,
          label: t('texterDetail.canShareLocation'),
          icon: locationOutline,
          value: settings.can_share_location,
        },
        {
          field: 'can_voice_call' as const,
          label: t('texterDetail.canVoiceCall'),
          icon: callOutline,
          value: settings.can_voice_call,
        },
        {
          field: 'can_video_call' as const,
          label: t('texterDetail.canVideoCall'),
          icon: videocamOutline,
          value: settings.can_video_call,
        },
        {
          field: 'can_screen_share' as const,
          label: t('texterDetail.canScreenShare'),
          icon: desktopOutline,
          value: settings.can_screen_share,
        },
      ]
    : [];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>{t('texterDetail.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="texter-detail-container">
          {/* Profile Card */}
          <div className="profile-card">
            <IonAvatar className="profile-avatar">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.display_name || 'Avatar'} />
              ) : (
                <div className="avatar-placeholder">
                  {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </IonAvatar>
            <div className="profile-info">
              <h2 className="profile-name">{user.display_name || t('dashboard.unnamed')}</h2>
              <p className="profile-zemi">{user.zemi_number}</p>
              <div className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                <IonIcon icon={user.is_active ? checkmarkCircleOutline : banOutline} />
                <span>
                  {user.is_active ? t('texterDetail.active') : t('texterDetail.inactive')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="section">
            <h3 className="section-title">{t('texterDetail.quickActions')}</h3>
            <IonList className="action-list">
              <IonItem
                button
                detail
                routerLink={`/oversight?texter=${userId}`}
                className="action-item"
              >
                <IonIcon icon={personOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>{t('texterDetail.viewChats')}</h3>
                  <p>{t('texterDetail.viewChatsDescription')}</p>
                </IonLabel>
              </IonItem>
            </IonList>
          </div>

          {/* Quick Messages */}
          {userId && (
            <div className="section">
              <QuickMessageManager userId={userId} />
            </div>
          )}

          {/* Quiet Hours */}
          {userId && (
            <div className="section">
              <QuietHoursManager userId={userId} />
            </div>
          )}

          {/* Capability Toggles */}
          {settings && (
            <div className="section">
              <h3 className="section-title">{t('texterDetail.capabilities')}</h3>
              <IonList className="toggle-list">
                {toggleItems.map((item) => (
                  <IonItem key={item.field} className="toggle-item">
                    <IonIcon icon={item.icon} slot="start" className="toggle-icon" />
                    <IonLabel>{item.label}</IonLabel>
                    <IonToggle
                      checked={item.value}
                      onIonChange={(e) => handleToggle(item.field, e.detail.checked)}
                      disabled={isSaving}
                    />
                  </IonItem>
                ))}
              </IonList>
            </div>
          )}

          {/* Account Actions */}
          <div className="section">
            <h3 className="section-title">{t('texterDetail.accountActions')}</h3>
            {user.is_active ? (
              <IonButton
                expand="block"
                color="danger"
                fill="outline"
                onClick={() => setShowDeactivateAlert(true)}
                disabled={isSaving}
              >
                <IonIcon icon={banOutline} slot="start" />
                {t('texterDetail.deactivate')}
              </IonButton>
            ) : (
              <IonButton
                expand="block"
                color="success"
                onClick={() => setShowReactivateAlert(true)}
                disabled={isSaving}
              >
                <IonIcon icon={checkmarkCircleOutline} slot="start" />
                {t('texterDetail.reactivate')}
              </IonButton>
            )}
            <IonText color="medium" className="action-hint">
              <p>
                {user.is_active
                  ? t('texterDetail.deactivateHint')
                  : t('texterDetail.reactivateHint')}
              </p>
            </IonText>
          </div>
        </div>

        {/* Deactivate Alert */}
        <IonAlert
          isOpen={showDeactivateAlert}
          onDidDismiss={() => setShowDeactivateAlert(false)}
          header={t('texterDetail.deactivateTitle')}
          message={t('texterDetail.deactivateMessage', { name: user.display_name })}
          buttons={[
            {
              text: t('common.cancel'),
              role: 'cancel',
            },
            {
              text: t('texterDetail.deactivate'),
              role: 'destructive',
              handler: handleDeactivate,
            },
          ]}
        />

        {/* Reactivate Alert */}
        <IonAlert
          isOpen={showReactivateAlert}
          onDidDismiss={() => setShowReactivateAlert(false)}
          header={t('texterDetail.reactivateTitle')}
          message={t('texterDetail.reactivateMessage', { name: user.display_name })}
          buttons={[
            {
              text: t('common.cancel'),
              role: 'cancel',
            },
            {
              text: t('texterDetail.reactivate'),
              handler: handleReactivate,
            },
          ]}
        />

        <style>{`
          .texter-detail-container {
            max-width: 600px;
            margin: 0 auto;
          }

          .loading-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
          }

          .profile-card {
            display: flex;
            align-items: center;
            gap: 1rem;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1.5rem;
            padding: 1.5rem;
            margin-bottom: 2rem;
          }

          .profile-avatar {
            width: 80px;
            height: 80px;
            flex-shrink: 0;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .profile-info {
            flex: 1;
          }

          .profile-name {
            margin: 0 0 0.25rem 0;
            font-size: 1.5rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .profile-zemi {
            margin: 0 0 0.75rem 0;
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            font-family: monospace;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
          }

          .status-badge.active {
            background: hsl(var(--secondary) / 0.15);
            color: hsl(var(--secondary));
          }

          .status-badge.inactive {
            background: hsl(var(--destructive) / 0.15);
            color: hsl(var(--destructive));
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

          .action-list, .toggle-list {
            background: hsl(var(--card));
            border-radius: 1rem;
            overflow: hidden;
            padding: 0;
          }

          .action-item, .toggle-item {
            --background: transparent;
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 1rem;
          }

          .action-icon, .toggle-icon {
            color: hsl(var(--primary));
            font-size: 1.25rem;
          }

          .action-item h3 {
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .action-item p {
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .action-hint {
            display: block;
            text-align: center;
            margin-top: 0.75rem;
          }

          .action-hint p {
            margin: 0;
            font-size: 0.75rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default TexterDetail;
