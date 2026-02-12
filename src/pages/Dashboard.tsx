import { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
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
  IonButtons,
  IonBackButton,
  IonRefresher,
  IonRefresherContent,
  type RefresherEventDetail,
} from '@ionic/react';
import {
  personAddOutline,
  ellipseOutline,
  ellipse,
  eyeOutline,
  checkmarkCircleOutline,
  mailOutline,
} from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { getTeamMembers } from '../services/members';
import { getAllTexterPendingRequests } from '../services/friend';
import { getUnacknowledgedAlerts, acknowledgeSosAlert, type SosAlertWithTexter } from '../services/sos';
import { CreateTexterModal } from '../components/CreateTexterModal';
import { SOSAlertCard } from '../components/sos';
import { type User, UserRole } from '../types/database';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile, refreshProfile } = useAuthContext();
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateTexter, setShowCreateTexter] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [sosAlerts, setSosAlerts] = useState<SosAlertWithTexter[]>([]);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);

  const isOwner = profile?.role === UserRole.OWNER;

  const loadMembers = useCallback(async () => {
    const { members: teamMembers } = await getTeamMembers();
    setMembers(teamMembers);
    setIsLoading(false);
  }, []);

  const loadApprovalsCount = useCallback(async () => {
    if (!isOwner) return;
    const { totalCount } = await getAllTexterPendingRequests();
    setPendingApprovalsCount(totalCount);
  }, [isOwner]);

  const loadSosAlerts = useCallback(async () => {
    if (!isOwner) return;
    const { alerts } = await getUnacknowledgedAlerts();
    setSosAlerts(alerts);
  }, [isOwner]);

  const handleAcknowledgeSos = async (alertId: string) => {
    setAcknowledgingAlertId(alertId);
    const { error } = await acknowledgeSosAlert(alertId);
    if (!error) {
      setSosAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
    setAcknowledgingAlertId(null);
  };

  useEffect(() => {
    loadMembers();
    loadApprovalsCount();
    loadSosAlerts();
  }, [loadMembers, loadApprovalsCount, loadSosAlerts]);

  // Redirect to first-login tour if not completed
  useEffect(() => {
    if (!profile) return;
    if (profile.role === UserRole.SUPER && !localStorage.getItem('zemichat-super-tour-done')) {
      history.replace('/super-tour');
    }
    if (profile.role === UserRole.TEXTER && !localStorage.getItem('zemichat-texter-tour-done')) {
      history.replace('/texter-tour');
    }
  }, [profile, history]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await Promise.all([loadMembers(), loadApprovalsCount(), loadSosAlerts()]);
    await refreshProfile();
    event.detail.complete();
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
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" />
          </IonButtons>
          <IonTitle>{t('settings.teamDashboard')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingText={t('refresh.pulling')}
            refreshingSpinner="crescent"
            refreshingText={t('refresh.refreshing')}
          />
        </IonRefresher>

        <div className="dashboard-container">
          {/* SOS Alerts (high priority, shown first for Owners) */}
          {isOwner && sosAlerts.length > 0 && (
            <div className="section sos-section">
              <h3 className="section-title sos-title">{t('sos.unacknowledged')}</h3>
              {sosAlerts.map((alert) => (
                <SOSAlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledgeSos}
                  isAcknowledging={acknowledgingAlertId === alert.id}
                />
              ))}
            </div>
          )}

          {/* Owner Management Actions */}
          <div className="section">
            <h3 className="section-title">{t('dashboard.quickActions')}</h3>
            <IonList className="action-list" data-testid="dashboard-actions">
              <IonItem button detail routerLink="/owner-approvals" className="action-item">
                <IonIcon icon={checkmarkCircleOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>{t('dashboard.approvals')}</h3>
                  <p>{t('dashboard.approvalsDescription')}</p>
                </IonLabel>
                {pendingApprovalsCount > 0 && (
                  <IonBadge slot="end" color="danger">
                    {pendingApprovalsCount}
                  </IonBadge>
                )}
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
              <IonItem button detail routerLink="/invite-super" className="action-item">
                <IonIcon icon={mailOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>{t('invite.title')}</h3>
                  <p>{t('dashboard.inviteSuperDescription')}</p>
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
              <SkeletonLoader variant="member-list" />
            ) : otherMembers.length === 0 ? (
              <div className="empty-state">
                <EmptyStateIllustration type="no-members" />
                <IonText>
                  <p>{t('dashboard.noMembers')}</p>
                </IonText>
                <IonButton className="invite-button glow-primary" onClick={() => setShowCreateTexter(true)}>
                  {t('dashboard.createFirstTexter')}
                </IonButton>
              </div>
            ) : (
              <IonList className="member-list" data-testid="member-list">
                {otherMembers.map((member, index) => {
                  const badge = getRoleBadge(member.role);
                  const detailLink =
                    member.role === 'texter' ? `/texter/${member.id}` : undefined;
                  return (
                    <IonItem
                      key={member.id}
                      button
                      detail
                      routerLink={detailLink}
                      className="member-item animate-fade-slide-in"
                      style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
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
                      {member.is_paused ? (
                        <IonBadge slot="end" color="warning" className="role-badge-small">
                          {t('dashboard.paused')}
                        </IonBadge>
                      ) : (
                        <IonBadge slot="end" color={badge.color} className="role-badge-small">
                          {badge.label}
                        </IonBadge>
                      )}
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

          .sos-section {
            margin-bottom: 1.5rem;
          }

          .sos-title {
            color: hsl(var(--destructive)) !important;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .avatar-placeholder.small {
            font-size: 1rem;
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
