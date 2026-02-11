import { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonAvatar,
  IonBadge,
  IonIcon,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  RefresherEventDetail,
} from '@ionic/react';
import { personAddOutline, peopleOutline, timeOutline, ellipse, ellipseOutline } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import {
  getMyFriends,
  getPendingRequests,
  unfriend,
  acceptFriendRequest,
  rejectFriendRequest,
  type FriendWithUser,
  type PendingRequestWithUser,
} from '../services/friend';
import { getTeamMembers } from '../services/members';
import { FriendCard, FriendRequestCard } from '../components/friends';
import { type User, UserRole } from '../types/database';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';

type TabValue = 'friends' | 'requests';

const Friends: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const [activeTab, setActiveTab] = useState<TabValue>('friends');
  const [friends, setFriends] = useState<FriendWithUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingRequestWithUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingRequestWithUser[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isOwner = profile?.role === UserRole.OWNER;

  const loadData = useCallback(async () => {
    const promises: Promise<unknown>[] = [
      getMyFriends(),
      getPendingRequests(),
    ];
    if (isOwner) {
      promises.push(getTeamMembers());
    }

    const results = await Promise.all(promises);
    const friendsResult = results[0] as Awaited<ReturnType<typeof getMyFriends>>;
    const requestsResult = results[1] as Awaited<ReturnType<typeof getPendingRequests>>;

    setFriends(friendsResult.friends);
    setIncomingRequests(requestsResult.incoming);
    setOutgoingRequests(requestsResult.outgoing);

    if (isOwner && results[2]) {
      const membersResult = results[2] as Awaited<ReturnType<typeof getTeamMembers>>;
      setTeamMembers(membersResult.members.filter((m) => m.id !== profile?.id));
    }

    setIsLoading(false);
  }, [isOwner, profile?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadData();
    event.detail.complete();
  };

  const handleUnfriend = async (friendshipId: string) => {
    const { error } = await unfriend(friendshipId);
    if (!error) {
      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    }
    setUnfriendTarget(null);
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    const { error } = await acceptFriendRequest(friendshipId);
    if (!error) {
      await loadData();
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    const { error } = await rejectFriendRequest(friendshipId);
    if (!error) {
      setIncomingRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    }
  };

  const requestCount = incomingRequests.length + outgoingRequests.length;

  // Check if user is Texter (they cannot accept requests directly)
  const isTexter = profile?.role === UserRole.TEXTER;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('friends.title')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as TabValue)}
          >
            <IonSegmentButton value="friends">
              <IonIcon icon={peopleOutline} />
              <IonLabel>{t('friends.myFriends')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="requests">
              <IonIcon icon={timeOutline} />
              <IonLabel>
                {t('friends.requests')}
                {requestCount > 0 && ` (${requestCount})`}
              </IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingText={t('refresh.pulling')}
            refreshingSpinner="crescent"
            refreshingText={t('refresh.refreshing')}
          />
        </IonRefresher>

        {/* My Team section - Owner only */}
        {isOwner && teamMembers.length > 0 && (
          <div className="team-section">
            <h3 className="section-title">{t('friends.myTeam')}</h3>
            <IonList className="team-list">
              {teamMembers.map((member) => {
                const isTexter = member.role === 'texter';
                return (
                  <IonItem
                    key={member.id}
                    button={isTexter}
                    detail={isTexter}
                    onClick={isTexter ? () => history.push(`/texter/${member.id}`) : undefined}
                    className="team-member-item"
                  >
                    <IonAvatar slot="start" className="team-member-avatar">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.display_name || ''} />
                      ) : (
                        <div className="team-avatar-placeholder">
                          {member.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </IonAvatar>
                    <IonLabel>
                      <h3 className="team-member-name">
                        {member.display_name || t('dashboard.unnamed')}
                        <IonIcon
                          icon={member.is_active ? ellipse : ellipseOutline}
                          className={`status-dot ${member.is_active ? 'active' : 'inactive'}`}
                        />
                      </h3>
                      <p className="team-member-zemi">{member.zemi_number}</p>
                    </IonLabel>
                    <IonBadge
                      slot="end"
                      color={member.role === 'super' ? 'secondary' : 'medium'}
                      className="team-role-badge"
                    >
                      {member.role === 'super' ? t('roles.super') : t('roles.texter')}
                    </IonBadge>
                  </IonItem>
                );
              })}
            </IonList>
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: '1rem' }}>
            <SkeletonLoader variant="friend-list" />
          </div>
        ) : activeTab === 'friends' ? (
          <div className="friends-container">
            {friends.length === 0 ? (
              <div className="empty-state">
                <EmptyStateIllustration type="no-friends" />
                <h2>{t('friends.noFriends')}</h2>
                <p>{t('friends.addFriendsHint')}</p>
              </div>
            ) : (
              <IonList className="friends-list" data-testid="friends-list">
                {friends.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    user={friend.user}
                    friendshipId={friend.id}
                    onUnfriend={() =>
                      setUnfriendTarget({
                        id: friend.id,
                        name: friend.user.display_name || t('dashboard.unnamed'),
                      })
                    }
                  />
                ))}
              </IonList>
            )}
          </div>
        ) : (
          <div className="requests-container">
            {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
              <div className="empty-state">
                <EmptyStateIllustration type="no-requests" />
                <h2>{t('friends.noRequests')}</h2>
              </div>
            ) : (
              <>
                {incomingRequests.length > 0 && (
                  <div className="section">
                    <h3 className="section-title">{t('friends.incomingRequests')}</h3>
                    <IonList className="request-list">
                      {incomingRequests.map((request) => (
                        <FriendRequestCard
                          key={request.id}
                          requester={request.requester}
                          addressee={request.addressee}
                          friendshipId={request.id}
                          direction="incoming"
                          onAccept={isTexter ? undefined : handleAcceptRequest}
                          onReject={isTexter ? undefined : handleRejectRequest}
                          showOwnerApprovalNote={isTexter}
                        />
                      ))}
                    </IonList>
                    {isTexter && (
                      <p className="texter-note">{t('friends.texterApprovalNote')}</p>
                    )}
                  </div>
                )}

                {outgoingRequests.length > 0 && (
                  <div className="section">
                    <h3 className="section-title">{t('friends.outgoingRequests')}</h3>
                    <IonList className="request-list">
                      {outgoingRequests.map((request) => (
                        <FriendRequestCard
                          key={request.id}
                          requester={request.requester}
                          addressee={request.addressee}
                          friendshipId={request.id}
                          direction="outgoing"
                          showOwnerApprovalNote
                        />
                      ))}
                    </IonList>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <IonFab
          vertical="bottom"
          horizontal="end"
          slot="fixed"
          className="safe-fab"
        >
          <IonFabButton routerLink="/add-friend" data-testid="add-friend-fab">
            <IonIcon icon={personAddOutline} />
          </IonFabButton>
        </IonFab>

        <IonAlert
          isOpen={!!unfriendTarget}
          onDidDismiss={() => setUnfriendTarget(null)}
          header={t('friends.unfriendTitle')}
          message={t('friends.unfriendMessage', { name: unfriendTarget?.name })}
          buttons={[
            {
              text: t('common.cancel'),
              role: 'cancel',
            },
            {
              text: t('friends.unfriend'),
              role: 'destructive',
              handler: () => {
                if (unfriendTarget) {
                  handleUnfriend(unfriendTarget.id);
                }
              },
            },
          ]}
        />

        <style>{`
          .loading-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
          }

          .friends-container,
          .requests-container {
            padding: 1rem;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 3rem;
            height: calc(100% - 100px);
          }

          .empty-icon {
            font-size: 4rem;
            color: hsl(var(--muted));
            margin-bottom: 1rem;
          }

          .empty-state h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.25rem;
            color: hsl(var(--foreground));
          }

          .empty-state p {
            margin: 0;
            color: hsl(var(--muted-foreground));
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
            margin: 0 0 0.75rem 0.5rem;
          }

          .friends-list,
          .request-list {
            background: transparent;
            padding: 0;
            border-radius: 1rem;
            overflow: hidden;
          }

          .texter-note {
            text-align: center;
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            margin: 0.75rem 0 0 0;
            padding: 0 1rem;
          }

          .team-section {
            padding: 1rem 1rem 0 1rem;
            margin-bottom: 0.5rem;
          }

          .team-list {
            background: hsl(var(--card));
            border-radius: 1rem;
            overflow: hidden;
            padding: 0;
          }

          .team-member-item {
            --background: transparent;
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
          }

          .team-member-avatar {
            width: 36px;
            height: 36px;
          }

          .team-avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .team-member-name {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .team-member-zemi {
            font-family: monospace;
            font-size: 0.8rem !important;
            color: hsl(var(--muted-foreground));
          }

          .team-role-badge {
            font-size: 0.7rem;
            padding: 0.25rem 0.5rem;
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

          .safe-fab {
            bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Friends;
