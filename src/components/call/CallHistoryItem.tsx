import { useTranslation } from 'react-i18next';
import { IonItem, IonAvatar, IonLabel, IonIcon } from '@ionic/react';
import {
  callOutline,
  videocamOutline,
  arrowDownOutline,
  arrowUpOutline,
} from 'ionicons/icons';
import { type CallHistoryEntry } from '../../services/callHistory';
import { CallStatus } from '../../types/database';

interface CallHistoryItemProps {
  entry: CallHistoryEntry;
  currentUserId: string;
  onCallback: (chatId: string) => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const CallHistoryItem: React.FC<CallHistoryItemProps> = ({
  entry,
  currentUserId,
  onCallback,
}) => {
  const { t } = useTranslation();
  const isOutgoing = entry.initiator_id === currentUserId;
  const isMissed = entry.status === CallStatus.MISSED && !isOutgoing;
  const isVideo = entry.type === 'video';

  // Determine display name + avatar
  const other = isOutgoing
    ? entry.otherParticipant || entry.initiator
    : entry.initiator;
  const displayName = other?.display_name || t('dashboard.unnamed');
  const avatarUrl = other?.avatar_url;

  return (
    <IonItem
      button
      detail={false}
      className="call-history-item"
      onClick={() => onCallback(entry.chat_id)}
    >
      <IonAvatar slot="start" className="call-avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} />
        ) : (
          <div className="call-avatar-placeholder">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </IonAvatar>

      <IonLabel>
        <h2 className={isMissed ? 'missed-name' : ''}>
          {displayName}
        </h2>
        <p className="call-meta">
          <IonIcon
            icon={isOutgoing ? arrowUpOutline : arrowDownOutline}
            className={`direction-icon ${isMissed ? 'missed' : ''}`}
          />
          <IonIcon icon={isVideo ? videocamOutline : callOutline} />
          <span>
            {isMissed
              ? t('calls.missed')
              : isOutgoing
                ? t('calls.outgoing')
                : t('calls.incoming')}
          </span>
          {entry.duration_seconds ? (
            <span className="call-duration">{formatDuration(entry.duration_seconds)}</span>
          ) : null}
        </p>
      </IonLabel>

      <span slot="end" className="call-time">
        {formatTime(entry.started_at)}
      </span>

      <style>{`
        .call-history-item {
          --background: hsl(var(--card));
          --border-color: hsl(var(--border));
        }

        .call-avatar {
          width: 44px;
          height: 44px;
        }

        .call-avatar-placeholder {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          border-radius: 50%;
        }

        .missed-name {
          color: hsl(var(--destructive)) !important;
        }

        .call-meta {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
        }

        .call-meta ion-icon {
          font-size: 0.85rem;
        }

        .direction-icon.missed {
          color: hsl(var(--destructive));
        }

        .call-duration {
          margin-left: 0.25rem;
          color: hsl(var(--foreground) / 0.5);
        }

        .call-time {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
        }
      `}</style>
    </IonItem>
  );
};

export default CallHistoryItem;
