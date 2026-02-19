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
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import { useAuthContext } from '../contexts/AuthContext';
import { useCallContext } from '../contexts/CallContext';
import { getCallHistory, type CallHistoryEntry } from '../services/callHistory';
import { createChat } from '../services/chat';
import { CallType } from '../types/call';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';
import CallHistoryItem from '../components/call/CallHistoryItem';

type TabValue = 'all' | 'missed';

const Calls: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const { initiateCall } = useCallContext();
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCalls = useCallback(async () => {
    const { calls: result } = await getCallHistory(activeTab);
    setCalls(result);
    setIsLoading(false);
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    loadCalls();
  }, [loadCalls]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadCalls();
    event.detail.complete();
  };

  const handleCallback = async (chatId: string) => {
    history.push(`/chat/${chatId}`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('calls.title')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as TabValue)}
          >
            <IonSegmentButton value="all">
              <IonLabel>{t('calls.all')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="missed">
              <IonLabel>{t('calls.missed')}</IonLabel>
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
        ) : calls.length === 0 ? (
          <div className="empty-state-calls">
            <EmptyStateIllustration type="no-friends" />
            <h2>{activeTab === 'missed' ? t('calls.noMissedCalls') : t('calls.noCalls')}</h2>
          </div>
        ) : (
          <IonList className="calls-list">
            {calls.map((call) => (
              <CallHistoryItem
                key={call.id}
                entry={call}
                currentUserId={profile?.id || ''}
                onCallback={handleCallback}
              />
            ))}
          </IonList>
        )}

        <style>{`
          .empty-state-calls {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 3rem;
            height: calc(100% - 100px);
          }

          .empty-state-calls h2 {
            margin: 0;
            font-size: 1.1rem;
            color: hsl(var(--foreground) / 0.7);
          }

          .calls-list {
            background: transparent;
            padding: 0;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Calls;
