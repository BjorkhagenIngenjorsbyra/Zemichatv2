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

interface TexterRequestGroup {
  texter: User;
  requests: PendingRequestWithUser[];
}

const OwnerApprovals: React.FC = () => {
  const { t } = useTranslation();
  const [texterGroups, setTexterGroups] = useState<TexterRequestGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showDenyConfirm, setShowDenyConfirm] = useState<{
    request: PendingRequestWithUser;
  } | null>(null);
  const [showActionSheet, setShowActionSheet] = useState<{
    request: PendingRequestWithUser;
  } | null>(null);

  const loadData = useCallback(async () => {
    const { requestsByTexter, totalCount: count, error } = await getAllTexterPendingRequests();

    if (error) {
      console.error('Failed to load approvals:', error);
      setIsLoading(false);
      return;
    }

    // Convert Map to array for rendering
    const groups: TexterRequestGroup[] = Array.from(requestsByTexter.values());
    setTexterGroups(groups);
    setTotalCount(count);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadData();
    event.detail.complete();
  };

  const handleApprove = async (request: PendingRequestWithUser) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));

    const { error } = await approveTexterRequest(request.id);

    if (error) {
      console.error('Failed to approve:', error);
    } else {
      // Remove from list
      setTexterGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            requests: group.requests.filter((r) => r.id !== request.id),
          }))
          .filter((group) => group.requests.length > 0)
      );
      setTotalCount((prev) => prev - 1);
    }

    setProcessingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(request.id);
      return newSet;
    });
  };

  const handleReject = async (request: PendingRequestWithUser) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));

    const { error } = await rejectTexterRequest(request.id);

    if (error) {
      console.error('Failed to reject:', error);
    } else {
      // Remove from list
      setTexterGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            requests: group.requests.filter((r) => r.id !== request.id),
          }))
          .filter((group) => group.requests.length > 0)
      );
      setTotalCount((prev) => prev - 1);
    }

    setProcessingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(request.id);
      return newSet;
    });
  };

  const handleDenyFuture = async (request: PendingRequestWithUser) => {
    setProcessingIds((prev) => new Set(prev).add(request.id));

    // First reject the request
    await rejectTexterRequest(request.id);

    // Then deny future requests
    const { error } = await denyFutureRequests(
      request.addressee_id,
      request.requester_id
    );

    if (error) {
      console.error('Failed to deny future:', error);
    } else {
      // Remove from list
      setTexterGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            requests: group.requests.filter((r) => r.id !== request.id),
          }))
          .filter((group) => group.requests.length > 0)
      );
      setTotalCount((prev) => prev - 1);
    }

    setProcessingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(request.id);
      return newSet;
    });

    setShowDenyConfirm(null);
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
                        src={group.texter.avatar_url}
                        alt={group.texter.display_name || ''}
                      />
                    ) : (
                      <div className="avatar-placeholder small">
                        {group.texter.display_name?.charAt(0)?.toUpperCase() || '?'}
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
                              src={request.requester.avatar_url}
                              alt={request.requester.display_name || ''}
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {request.requester.display_name
                                ?.charAt(0)
                                ?.toUpperCase() || '?'}
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
                            >
                              <IonIcon icon={close} slot="icon-only" />
                            </IonButton>
                            <IonButton
                              fill="solid"
                              color="primary"
                              size="small"
                              onClick={() => handleApprove(request)}
                              className="action-button"
                            >
                              <IonIcon icon={checkmark} slot="icon-only" />
                            </IonButton>
                            <IonButton
                              fill="clear"
                              color="medium"
                              size="small"
                              onClick={() => setShowActionSheet({ request })}
                              className="more-button"
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
