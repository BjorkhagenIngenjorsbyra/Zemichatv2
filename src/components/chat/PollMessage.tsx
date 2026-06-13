import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../../contexts/AuthContext';
import { getPollByMessageId, castPollVote, unvotePoll } from '../../services/poll';
import type { PollWithOptions } from '../../types/database';
import './PollMessage.css';

interface PollMessageProps {
  messageId: string;
  isOwn: boolean;
}

const PollMessage: React.FC<PollMessageProps> = ({ messageId, isOwn }) => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [poll, setPoll] = useState<PollWithOptions | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const loadPoll = useCallback(async () => {
    const { poll: pollData } = await getPollByMessageId(messageId);
    if (pollData) {
      setPoll(pollData);
    }
  }, [messageId]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  const handleVote = async (optionId: string) => {
    if (!poll || isVoting) return;

    setIsVoting(true);

    const hasVoted = poll.options.some(
      (o) => o.id === optionId && o.votes.some((v) => v.user_id === profile?.id)
    );

    if (hasVoted) {
      await unvotePoll(poll.id, optionId);
    } else {
      // Atomic on the server — for single-choice polls it clears the user's
      // other votes and inserts in one transaction (no partial-failure window).
      await castPollVote(poll.id, optionId);
    }

    await loadPoll();
    setIsVoting(false);
  };

  if (!poll) return null;

  const hasVoted = poll.options.some((o) =>
    o.votes.some((v) => v.user_id === profile?.id)
  );

  return (
    <div className={`poll-message ${isOwn ? 'own' : ''}`}>
      <div className="poll-question">{poll.question}</div>

      <div className="poll-options-list">
        {poll.options.map((option) => {
          const voteCount = option.votes.length;
          const percentage = poll.totalVotes > 0
            ? Math.round((voteCount / poll.totalVotes) * 100)
            : 0;
          const myVote = option.votes.some((v) => v.user_id === profile?.id);

          return (
            <button
              key={option.id}
              className={`poll-option-btn ${myVote ? 'voted' : ''}`}
              onClick={() => handleVote(option.id)}
              disabled={isVoting}
            >
              <div
                className="poll-option-fill"
                style={{ width: hasVoted ? `${percentage}%` : '0%' }}
              />
              <span className="poll-option-text">{option.text}</span>
              {hasVoted && (
                <span className="poll-option-count">
                  {percentage}%
                </span>
              )}
              {myVote && <span className="poll-check">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="poll-footer">
        <span className="poll-total">
          {poll.totalVotes} {poll.totalVotes === 1 ? t('poll.vote') : t('poll.votes')}
        </span>
        {poll.allows_multiple && (
          <span className="poll-multi-hint">{t('poll.multipleAllowed')}</span>
        )}
      </div>
    </div>
  );
};

export default PollMessage;
