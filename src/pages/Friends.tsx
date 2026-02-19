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
  IonIcon,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  IonActionSheet,
  RefresherEventDetail,
} from '@ionic/react';
import { personAddOutline, peopleOutline, timeOutline, chatbubbleOutline, call, videocam, settingsOutline } from 'ionicons/icons';
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
import { getAllFriendSettings } from '../services/friendSettings';
import { createChat } from '../services/chat';
import { FriendCard, FriendRequestCard, FriendSettingsModal, AddToChatPicker } from '../components/friends';
import { type FriendSettings, type User, UserRole, FRIEND_CATEGORIES } from '../types/database';
import { CallType } from '../types/call';
import { useCallContext } from '../contexts/CallContext';
import { useNotifications } from '../contexts/NotificationContext';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';

type TabValue = 'friends' | 'requests';

const Friends: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const { initiateCall } = useCallContext();
  const { refreshCounts } = useNotifications();
  const [activeTab, setActiveTab] = useState<TabValue>('friends');
  const [friends, setFriends] = useState<FriendWithUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingRequestWithUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unfriendTarget, setUnfriendTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    userId: string;
    name: string;
    user: User;
  } | null>(null);
  const [friendSettingsMap, setFriendSettingsMap] = useState<Map<string, FriendSettings>>(new Map());
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [settingsTarget, setSettingsTarget] = useState<User | null>(null);
  const [addToChatTarget, setAddToChatTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    const [friendsResult, requestsResult, settingsResult] = await Promise.all([
      getMyFriends(),
      getPendingRequests(),
      getAllFriendSettings(),
    ]);

    setFriends(friendsResult.friends);
    setIncomingRequests(requestsResult.incoming);
    setOutgoingRequests(requestsResult.outgoing);
    setFriendSettingsMap(settingsResult.settings);

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
      refreshCounts();
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    const { error } = await rejectFriendRequest(friendshipId);
    if (!error) {
      setIncomingRequests((prev) => prev.filter((r) => r.id !== friendshipId));
      refreshCounts();
    }
  };

  const handleStartChat = async (userId: string) => {
    const { chat, error } = await createChat({
      memberIds: [userId],
      isGroup: false,
    });
    if (!error && chat) {
      history.push(`/chat/${chat.id}`);
    }
  };

  const handleCall = async (userId: string, type: 'voice' | 'video') => {
    const { chat, error } = await createChat({
      memberIds: [userId],
      isGroup: false,
    });
    if (!error && chat) {
      history.push(`/chat/${chat.id}`);
      await initiateCall(chat.id, type === 'video' ? CallType.VIDEO : CallType.VOICE);
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
              <>
                {/* Category filter bar */}
                <div className="category-filter-bar">
                  <button
                    className={`category-chip ${activeCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('all')}
                  >
                    {t('friendSettings.all')}
                  </button>
                  {FRIEND_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {t(`friendSettings.${cat}`)}
                    </button>
                  ))}
                </div>

                <IonList className="friends-list" data-testid="friends-list">
                  {friends
                    .filter((friend) => {
                      if (activeCategory === 'all') return true;
                      const settings = friendSettingsMap.get(friend.user.id);
                      return settings?.categories?.includes(activeCategory) ?? false;
                    })
                    .map((friend) => {
                      const settings = friendSettingsMap.get(friend.user.id);
                      return (
                        <FriendCard
                          key={friend.id}
                          user={friend.user}
                          friendshipId={friend.id}
                          nickname={settings?.nickname}
                          categories={settings?.categories}
                          onUnfriend={() =>
                            setUnfriendTarget({
                              id: friend.id,
                              name: friend.user.display_name || t('dashboard.unnamed'),
                            })
                          }
                          onClick={() =>
                            setActionTarget({
                              userId: friend.user.id,
                              name: friend.user.display_name || t('dashboard.unnamed'),
                              user: friend.user,
                            })
                          }
                        />
                      );
                    })}
                </IonList>
              </>
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

        <IonActionSheet
          isOpen={!!actionTarget}
          onDidDismiss={() => setActionTarget(null)}
          header={actionTarget?.name}
          buttons={[
            {
              text: t('friends.startNewChat'),
              icon: chatbubbleOutline,
              handler: () => {
                if (actionTarget) {
                  handleStartChat(actionTarget.userId);
                }
              },
            },
            {
              text: t('call.voiceCall'),
              icon: call,
              handler: () => {
                if (actionTarget) {
                  handleCall(actionTarget.userId, 'voice');
                }
              },
            },
            {
              text: t('call.videoCall'),
              icon: videocam,
              handler: () => {
                if (actionTarget) {
                  handleCall(actionTarget.userId, 'video');
                }
              },
            },
            {
              text: t('friends.addToExistingChat'),
              icon: peopleOutline,
              handler: () => {
                if (actionTarget) {
                  setAddToChatTarget({
                    userId: actionTarget.userId,
                    name: actionTarget.name,
                  });
                }
              },
            },
            {
              text: t('friends.settings'),
              icon: settingsOutline,
              handler: () => {
                if (actionTarget) {
                  setSettingsTarget(actionTarget.user);
                }
              },
            },
            {
              text: t('common.cancel'),
              role: 'cancel',
            },
          ]}
        />

        <FriendSettingsModal
          isOpen={!!settingsTarget}
          friend={settingsTarget}
          initialNickname={settingsTarget ? (friendSettingsMap.get(settingsTarget.id)?.nickname ?? '') : ''}
          initialCategories={settingsTarget ? (friendSettingsMap.get(settingsTarget.id)?.categories ?? []) : []}
          onClose={() => setSettingsTarget(null)}
          onSaved={(friendUserId, nickname, categories) => {
            setFriendSettingsMap((prev) => {
              const next = new Map(prev);
              const existing = next.get(friendUserId);
              next.set(friendUserId, {
                id: existing?.id ?? '',
                user_id: existing?.user_id ?? '',
                friend_user_id: friendUserId,
                nickname,
                categories,
                created_at: existing?.created_at ?? new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              return next;
            });
          }}
        />

        <AddToChatPicker
          isOpen={!!addToChatTarget}
          userId={addToChatTarget?.userId ?? null}
          userName={addToChatTarget?.name ?? null}
          onClose={() => setAddToChatTarget(null)}
          onAdded={(chatId) => {
            setAddToChatTarget(null);
            history.push(`/chat/${chatId}`);
          }}
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
            color: hsl(var(--foreground) / 0.7);
          }

          .section {
            margin-bottom: 2rem;
          }

          .section-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: hsl(var(--foreground) / 0.7);
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
            color: hsl(var(--foreground) / 0.7);
            margin: 0.75rem 0 0 0;
            padding: 0 1rem;
          }

          .category-filter-bar {
            display: flex;
            gap: 0.5rem;
            overflow-x: auto;
            padding-bottom: 0.75rem;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          .category-filter-bar::-webkit-scrollbar {
            display: none;
          }

          .category-chip {
            flex-shrink: 0;
            padding: 0.4rem 0.85rem;
            border-radius: 999px;
            border: 1.5px solid hsl(var(--border));
            background: transparent;
            color: hsl(var(--foreground));
            font-size: 0.85rem;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.15s;
            white-space: nowrap;
          }

          .category-chip.active {
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border-color: hsl(var(--primary));
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
