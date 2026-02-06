import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonText,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import {
  logOutOutline,
  personAddOutline,
  chatbubblesOutline,
  settingsOutline,
  ellipseOutline,
  ellipse,
  eyeOutline,
} from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { getTeamMembers } from '../services/members';
import { CreateTexterModal } from '../components/CreateTexterModal';
import type { User } from '../types/database';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { profile, signOut, refreshProfile } = useAuthContext();
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateTexter, setShowCreateTexter] = useState(false);

  const loadMembers = useCallback(async () => {
    const { members: teamMembers } = await getTeamMembers();
    setMembers(teamMembers);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadMembers();
    await refreshProfile();
    event.detail.complete();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleTexterCreated = () => {
    loadMembers();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return { label: t('roles.owner'), color: 'primary' };
      case 'super':
        return { label: t('roles.super'), color: 'secondary' };
      case 'texter':
        return { label: t('roles.texter'), color: 'medium' };
      default:
        return { label: role, color: 'medium' };
    }
  };

  const otherMembers = members.filter((m) => m.id !== profile?.id);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('common.appName')}</IonTitle>
          <IonButton slot="end" fill="clear" onClick={handleSignOut}>
            <IonIcon icon={logOutOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="dashboard-container">
          {/* Profile Card */}
          <div className="profile-card">
            <IonAvatar className="profile-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name || 'Avatar'} />
              ) : (
                <div className="avatar-placeholder">
                  {profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </IonAvatar>
            <div className="profile-info">
              <h2 className="profile-name">{profile?.display_name || t('dashboard.user')}</h2>
              <p className="profile-zemi">{profile?.zemi_number}</p>
              <span className={`role-badge ${profile?.role}`}>
                {profile?.role === 'owner'
                  ? t('roles.teamOwner')
                  : profile?.role === 'super'
                    ? t('roles.super')
                    : t('roles.texter')}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="section">
            <h3 className="section-title">{t('dashboard.quickActions')}</h3>
            <IonList className="action-list">
              <IonItem button detail routerLink="/chats" className="action-item">
                <IonIcon icon={chatbubblesOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>{t('dashboard.chats')}</h3>
                  <p>{t('dashboard.chatsDescription')}</p>
                </IonLabel>
              </IonItem>
              <IonItem button detail className="action-item" onClick={() => setShowCreateTexter(true)}>
                <IonIcon icon={personAddOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>{t('dashboard.createTexter')}</h3>
                  <p>{t('dashboard.createTexterDescription')}</p>
                </IonLabel>
              </IonItem>
              <IonItem button detail routerLink="/oversight" className="action-item">
                <IonIcon icon={eyeOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>{t('dashboard.oversight')}</h3>
                  <p>{t('dashboard.oversightDescription')}</p>
                </IonLabel>
              </IonItem>
              <IonItem button detail className="action-item">
                <IonIcon icon={settingsOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>{t('dashboard.settings')}</h3>
                  <p>{t('dashboard.settingsDescription')}</p>
                </IonLabel>
              </IonItem>
            </IonList>
          </div>

          {/* Team Members */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">{t('dashboard.yourTeam')}</h3>
              <IonButton fill="clear" size="small" onClick={() => setShowCreateTexter(true)}>
                <IonIcon icon={personAddOutline} slot="start" />
                {t('dashboard.addMember')}
              </IonButton>
            </div>

            {isLoading ? (
              <div className="loading-state">
                <IonSpinner name="crescent" />
              </div>
            ) : otherMembers.length === 0 ? (
              <div className="empty-state">
                <IonIcon icon={personAddOutline} className="empty-icon" />
                <IonText>
                  <p>{t('dashboard.noMembers')}</p>
                </IonText>
                <IonButton className="invite-button glow-primary" onClick={() => setShowCreateTexter(true)}>
                  {t('dashboard.createFirstTexter')}
                </IonButton>
              </div>
            ) : (
              <IonList className="member-list">
                {otherMembers.map((member) => {
                  const badge = getRoleBadge(member.role);
                  const detailLink =
                    member.role === 'texter' ? `/texter/${member.id}` : undefined;
                  return (
                    <IonItem
                      key={member.id}
                      button
                      detail
                      routerLink={detailLink}
                      className="member-item"
                    >
                      <IonAvatar slot="start" className="member-avatar">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.display_name || 'Avatar'} />
                        ) : (
                          <div className="avatar-placeholder small">
                            {member.display_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      </IonAvatar>
                      <IonLabel>
                        <h3 className="member-name">
                          {member.display_name || t('dashboard.unnamed')}
                          <IonIcon
                            icon={member.is_active ? ellipse : ellipseOutline}
                            className={`status-dot ${member.is_active ? 'active' : 'inactive'}`}
                          />
                        </h3>
                        <p className="member-zemi">{member.zemi_number}</p>
                      </IonLabel>
                      <IonBadge slot="end" color={badge.color} className="role-badge-small">
                        {badge.label}
                      </IonBadge>
                    </IonItem>
                  );
                })}
              </IonList>
            )}
          </div>
        </div>

        {/* Create Texter Modal */}
        <CreateTexterModal
          isOpen={showCreateTexter}
          onClose={() => setShowCreateTexter(false)}
          teamId={profile?.team_id || ''}
          onCreated={handleTexterCreated}
        />

        <style>{`
          .dashboard-container {
            max-width: 600px;
            margin: 0 auto;
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
            width: 64px;
            height: 64px;
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
            font-size: 1.5rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .avatar-placeholder.small {
            font-size: 1rem;
          }

          .profile-info {
            flex: 1;
          }

          .profile-name {
            margin: 0 0 0.25rem 0;
            font-size: 1.25rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .profile-zemi {
            margin: 0 0 0.5rem 0;
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
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

          .section {
            margin-bottom: 2rem;
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }

          .section-header ion-button {
            --color: hsl(var(--primary));
            font-size: 0.875rem;
          }

          .section-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 1rem 0;
          }

          .section-header .section-title {
            margin: 0;
          }

          .action-list, .member-list {
            background: hsl(var(--card));
            border-radius: 1rem;
            overflow: hidden;
            padding: 0;
          }

          .action-item, .member-item {
            --background: transparent;
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
          }

          .action-item::part(native), .member-item::part(native) {
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
          }

          .action-icon {
            color: hsl(var(--primary));
            font-size: 1.5rem;
          }

          .action-item h3, .member-item h3 {
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .action-item p, .member-item p {
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .member-avatar {
            width: 40px;
            height: 40px;
          }

          .member-name {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .status-dot {
            font-size: 0.5rem;
          }

          .status-dot.active {
            color: hsl(var(--secondary));
          }

          .status-dot.inactive {
            color: hsl(var(--muted));
          }

          .member-zemi {
            font-family: monospace;
            font-size: 0.8rem !important;
          }

          .role-badge-small {
            font-size: 0.7rem;
            padding: 0.25rem 0.5rem;
          }

          .loading-state {
            display: flex;
            justify-content: center;
            padding: 2rem;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 2rem;
            background: hsl(var(--card));
            border: 1px dashed hsl(var(--border));
            border-radius: 1rem;
          }

          .empty-icon {
            font-size: 3rem;
            color: hsl(var(--muted));
            margin-bottom: 1rem;
          }

          .empty-state p {
            color: hsl(var(--muted-foreground));
            margin: 0 0 1rem 0;
          }

          .invite-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --border-radius: 9999px;
            font-weight: 700;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;
