import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonSpinner,
  IonIcon,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  RefresherEventDetail,
} from '@ionic/react';
import { personAddOutline, peopleOutline, timeOutline } from 'ionicons/icons';
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
import { FriendCard, FriendRequestCard } from '../components/friends';
import { UserRole } from '../types/database';

type TabValue = 'friends' | 'requests';

const Friends: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [activeTab, setActiveTab] = useState<TabValue>('friends');
  const [friends, setFriends] = useState<FriendWithUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingRequestWithUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    const [friendsResult, requestsResult] = await Promise.all([
      getMyFriends(),
      getPendingRequests(),
    ]);

    setFriends(friendsResult.friends);
    setIncomingRequests(requestsResult.incoming);
    setOutgoingRequests(requestsResult.outgoing);
    setIsLoading(false);
  }, []);

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
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
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
          <IonRefresherContent />
        </IonRefresher>

        {isLoading ? (
          <div className="loading-state">
            <IonSpinner name="crescent" />
          </div>
        ) : activeTab === 'friends' ? (
          <div className="friends-container">
            {friends.length === 0 ? (
              <div className="empty-state">
                <IonIcon icon={peopleOutline} className="empty-icon" />
                <h2>{t('friends.noFriends')}</h2>
                <p>{t('friends.addFriendsHint')}</p>
              </div>
            ) : (
              <IonList className="friends-list">
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
                <IonIcon icon={timeOutline} className="empty-icon" />
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

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton routerLink="/add-friend">
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
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Friends;
