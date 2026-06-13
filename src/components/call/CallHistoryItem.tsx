import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { IonItem, IonAvatar, IonLabel, IonIcon } from '@ionic/react';
import { getDisplayName, getInitial, getAvatarColor } from '../../utils/userDisplay';
import {
  callOutline,
  videocamOutline,
  arrowDownOutline,
  arrowUpOutline,
} from 'ionicons/icons';
import { type CallHistoryEntry } from '../../services/callHistory';
import { CallStatus } from '../../types/database';
import { formatTimeOrDate } from '../../utils/datetime';
import './CallHistoryItem.css';

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
  return formatTimeOrDate(dateStr);
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

  // Determine display name + avatar. For an outgoing call the initiator IS the
  // current user, so falling back to it showed the user themselves as the
  // counterpart — use only otherParticipant (getDisplayName handles null).
  const other = isOutgoing ? entry.otherParticipant : entry.initiator;
  const displayName = getDisplayName(other);
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
          <img src={avatarUrl} alt={displayName} loading="lazy" decoding="async" />
        ) : (
          <div className="call-avatar-placeholder" style={{ background: getAvatarColor(other) }}>
            {getInitial(other)}
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
    </IonItem>
  );
};

export default memo(CallHistoryItem);
