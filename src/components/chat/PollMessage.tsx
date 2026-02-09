import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../../contexts/AuthContext';
import { getPollByMessageId, votePoll, unvotePoll } from '../../services/poll';
import type { PollWithOptions } from '../../types/database';

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
      // If single choice, remove other votes first
      if (!poll.allows_multiple) {
        for (const opt of poll.options) {
          const myVote = opt.votes.find((v) => v.user_id === profile?.id);
          if (myVote) {
            await unvotePoll(poll.id, opt.id);
          }
        }
      }
      await votePoll(poll.id, optionId);
    }

    await loadPoll();
    setIsVoting(false);
  };

  if (!poll) return null;

  const hasVoted = poll.options.some((o) =>
    o.votes.some((v) => v.user_id === profile?.id)
  );

  return (
    <div className="poll-message">
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

      <style>{`
        .poll-message {
          min-width: 220px;
          max-width: 100%;
        }

        .poll-question {
          font-weight: 600;
          font-size: 0.95rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
        }

        .poll-options-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .poll-option-btn {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0.6rem 0.75rem;
          background: ${isOwn ? 'hsl(var(--primary-foreground) / 0.15)' : 'hsl(var(--muted) / 0.3)'};
          border: 1px solid ${isOwn ? 'hsl(var(--primary-foreground) / 0.2)' : 'hsl(var(--border))'};
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.85rem;
          color: inherit;
          overflow: hidden;
          transition: all 0.15s;
        }

        .poll-option-btn.voted {
          border-color: ${isOwn ? 'hsl(var(--primary-foreground) / 0.4)' : 'hsl(var(--primary) / 0.5)'};
        }

        .poll-option-btn:active {
          transform: scale(0.98);
        }

        .poll-option-fill {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          background: ${isOwn ? 'hsl(var(--primary-foreground) / 0.2)' : 'hsl(var(--primary) / 0.15)'};
          border-radius: 0.5rem;
          transition: width 0.4s ease-out;
        }

        .poll-option-text {
          position: relative;
          flex: 1;
          text-align: left;
          z-index: 1;
        }

        .poll-option-count {
          position: relative;
          font-weight: 600;
          font-size: 0.8rem;
          margin-left: 0.5rem;
          z-index: 1;
        }

        .poll-check {
          position: relative;
          margin-left: 0.25rem;
          font-weight: 700;
          z-index: 1;
        }

        .poll-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 0.5rem;
          font-size: 0.7rem;
          opacity: 0.7;
        }

        .poll-total {
          font-weight: 500;
        }

        .poll-multi-hint {
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default PollMessage;
