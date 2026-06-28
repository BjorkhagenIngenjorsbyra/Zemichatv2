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
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonAlert,
  IonActionSheet,
  useIonToast,
  RefresherEventDetail,
} from '@ionic/react';
import {
  checkmark,
  close,
  banOutline,
  ellipsisVertical,
} from 'ionicons/icons';
import {
  getAllTexterPendingRequests,
  approveTexterRequest,
  rejectTexterRequest,
  denyFutureRequests,
  type PendingRequestWithUser,
} from '../services/friend';
import { type User } from '../types/database';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';
import { getInitial, getAvatarColor } from '../utils/userDisplay';
import { getOptimizedAvatarUrl } from '../utils/imageUrl';

interface TexterRequestGroup {
  texter: User;
  requests: PendingRequestWithUser[];
}

const OwnerApprovals: React.FC = () => {
  const { t } = useTranslation();
  const [present] = useIonToast();
  const [texterGroups, setTexterGroups] = useState<TexterRequestGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Derived from the grouped list — no separate counter to keep in sync.
  const totalCount = texterGroups.reduce((n, g) => n + g.requests.length, 0);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showDenyConfirm, setShowDenyConfirm] = useState<{
    request: PendingRequestWithUser;
  } | null>(null);
  const [showActionSheet, setShowActionSheet] = useState<{
    request: PendingRequestWithUser;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { requestsByTexter, error } = await getAllTexterPendingRequests();

      if (error) {
        console.error('Failed to load approvals:', error);
        present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
        return;
      }

      // Convert Map to array for rendering
      const groups: TexterRequestGroup[] = Array.from(requestsByTexter.values());
      setTexterGroups(groups);
    } catch (err) {
      // A thrown rejection previously left the skeleton loader up forever.
      console.error('Failed to load approvals:', err);
      present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
    } finally {
      setIsLoading(false);
    }
  }, [present, t]);

  // Remove a handled request from the grouped list (totalCount derives from it).
  const removeRequestFromList = useCallback((id: string) => {
    setTexterGroups((prev) =>
      prev
        .map((group) => ({
          ...group,
          requests: group.requests.filter((r) => r.id !== id),
        }))
        .filter((group) => group.requests.length > 0)
    );
  }, []);

  // Shared processing-set bookkeeping + error feedback for approve/reject so a
  // failed action surfaces to the Owner instead of silently leaving the row.
  const processRequest = useCallback(
    async (id: string, action: () => Promise<{ error: unknown }>): Promise<boolean> => {
      setProcessingIds((prev) => new Set(prev).add(id));
      try {
        const { error } = await action();
        if (error) {
          console.error('Approval action failed:', error);
          present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
          return false;
        }
        removeRequestFromList(id);
        return true;
      } catch (err) {
        console.error('Approval action threw:', err);
        present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
        return false;
      } finally {
        setProcessingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    },
    [present, t, removeRequestFromList]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadData();
    event.detail.complete();
  };

  const handleApprove = (request: PendingRequestWithUser) =>
    processRequest(request.id, () => approveTexterRequest(request.id));

  const handleReject = (request: PendingRequestWithUser) =>
    processRequest(request.id, () => rejectTexterRequest(request.id));

  const handleDenyFuture = async (request: PendingRequestWithUser) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));

    try {
      // First reject the request. Only proceed to deny future requests if the
      // reject actually succeeded — otherwise we'd report "denied" while the
      // pending request is still live.
      const { error: rejectError } = await rejectTexterRequest(request.id);

      if (rejectError) {
        console.error('Failed to reject request before denying future:', rejectError);
        present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
        return;
      }

      const { error } = await denyFutureRequests(
        request.addressee_id,
        request.requester_id
      );

      if (error) {
        console.error('Failed to deny future:', error);
        present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
        return;
      }

      removeRequestFromList(request.id);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(request.id);
        return newSet;
      });
      setShowDenyConfirm(null);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>
            {t('ownerApprovals.title')}
            {totalCount > 0 && ` (${totalCount})`}
          </IonTitle>
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
          <SkeletonLoader variant="approval-list" />
        ) : texterGroups.length === 0 ? (
          <div className="empty-state">
            <EmptyStateIllustration type="no-requests" />
            <h2>{t('ownerApprovals.noRequests')}</h2>
            <p>{t('ownerApprovals.noRequestsDescription')}</p>
          </div>
        ) : (
          <div className="approvals-container">
            {texterGroups.map((group) => (
              <div key={group.texter.id} className="texter-group">
                <div className="texter-header">
                  <IonAvatar className="texter-avatar">
                    {group.texter.avatar_url ? (
                      <img
                        src={getOptimizedAvatarUrl(group.texter.avatar_url, 48)}
                        alt={group.texter.display_name || ''}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="avatar-placeholder small" style={{ background: getAvatarColor(group.texter) }}>
                        {getInitial(group.texter)}
                      </div>
                    )}
                  </IonAvatar>
                  <div className="texter-info">
                    <h3>{group.texter.display_name || t('dashboard.unnamed')}</h3>
                    <p>
                      {t('ownerApprovals.requestCount', {
                        count: group.requests.length,
                      })}
                    </p>
                  </div>
                </div>

                <IonList className="request-list">
                  {group.requests.map((request) => {
                    const isProcessing = processingIds.has(request.id);

                    return (
                      <IonItem key={request.id} className="request-item">
                        <IonAvatar slot="start" className="requester-avatar">
                          {request.requester.avatar_url ? (
                            <img
                              src={getOptimizedAvatarUrl(request.requester.avatar_url, 48)}
                              alt={request.requester.display_name || ''}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="avatar-placeholder" style={{ background: getAvatarColor(request.requester) }}>
                              {getInitial(request.requester)}
                            </div>
                          )}
                        </IonAvatar>

                        <IonLabel>
                          <h2 className="requester-name">
                            {request.requester.display_name || t('dashboard.unnamed')}
                          </h2>
                          <p className="requester-zemi">
                            {request.requester.zemi_number}
                          </p>
                          {request.requesterOwnerInfo && (
                            <p className="requester-guardian">
                              {t('ownerApprovals.guardian', {
                                ownerName: request.requesterOwnerInfo.owner_display_name || request.requesterOwnerInfo.owner_email,
                                teamName: request.requesterOwnerInfo.team_name,
                                email: request.requesterOwnerInfo.owner_email,
                              })}
                            </p>
                          )}
                        </IonLabel>

                        {isProcessing ? (
                          <IonSpinner slot="end" name="crescent" />
                        ) : (
                          <div slot="end" className="action-buttons">
                            <IonButton
                              fill="outline"
                              color="medium"
                              size="small"
                              onClick={() => handleReject(request)}
                              className="action-button"
                              aria-label={t('ownerApprovals.reject')}
                            >
                              <IonIcon icon={close} slot="icon-only" />
                            </IonButton>
                            <IonButton
                              fill="solid"
                              color="primary"
                              size="small"
                              onClick={() => handleApprove(request)}
                              className="action-button"
                              aria-label={t('ownerApprovals.approve')}
                            >
                              <IonIcon icon={checkmark} slot="icon-only" />
                            </IonButton>
                            <IonButton
                              fill="clear"
                              color="medium"
                              size="small"
                              onClick={() => setShowActionSheet({ request })}
                              className="more-button"
                              aria-label={t('ownerApprovals.moreActions')}
                            >
                              <IonIcon icon={ellipsisVertical} slot="icon-only" />
                            </IonButton>
                          </div>
                        )}
                      </IonItem>
                    );
                  })}
                </IonList>
              </div>
            ))}
          </div>
        )}

        <IonActionSheet
          isOpen={!!showActionSheet}
          onDidDismiss={() => setShowActionSheet(null)}
          header={t('ownerApprovals.moreActions')}
          buttons={[
            {
              text: t('ownerApprovals.denyFuture'),
              role: 'destructive',
              icon: banOutline,
              handler: () => {
                if (showActionSheet) {
                  setShowDenyConfirm({ request: showActionSheet.request });
                }
              },
            },
            {
              text: t('common.cancel'),
              role: 'cancel',
            },
          ]}
        />

        <IonAlert
          isOpen={!!showDenyConfirm}
          onDidDismiss={() => setShowDenyConfirm(null)}
          header={t('ownerApprovals.denyFutureTitle')}
          message={t('ownerApprovals.denyFutureMessage', {
            requester: showDenyConfirm?.request.requester.display_name,
            texter: showDenyConfirm?.request.addressee.display_name,
          })}
          buttons={[
            {
              text: t('common.cancel'),
              role: 'cancel',
            },
            {
              text: t('ownerApprovals.denyFuture'),
              role: 'destructive',
              handler: () => {
                if (showDenyConfirm) {
                  handleDenyFuture(showDenyConfirm.request);
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

          .approvals-container {
            padding: 1rem;
          }

          .texter-group {
            margin-bottom: 1.5rem;
          }

          .texter-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            background: hsl(var(--primary) / 0.1);
            border-radius: 1rem 1rem 0 0;
          }

          .texter-avatar {
            width: 36px;
            height: 36px;
          }

          .texter-info h3 {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .texter-info p {
            margin: 0;
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
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
            font-size: 0.9rem;
          }

          .request-list {
            background: hsl(var(--card));
            border-radius: 0 0 1rem 1rem;
            padding: 0;
            overflow: hidden;
          }

          .request-item {
            --background: transparent;
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 0.5rem;
          }

          .requester-avatar {
            width: 40px;
            height: 40px;
          }

          .requester-name {
            font-weight: 600;
            font-size: 0.95rem;
            color: hsl(var(--foreground));
            margin: 0 0 0.2rem 0;
          }

          .requester-zemi {
            font-family: monospace;
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
          }

          .requester-guardian {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            margin: 0.15rem 0 0 0;
          }

          .action-buttons {
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }

          .action-button {
            --border-radius: 50%;
            width: 36px;
            height: 36px;
          }

          .more-button {
            width: 32px;
            height: 32px;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default OwnerApprovals;
