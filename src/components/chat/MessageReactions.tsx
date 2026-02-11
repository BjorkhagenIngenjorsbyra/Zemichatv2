import { type GroupedReaction } from '../../services/reaction';

interface MessageReactionsProps {
  reactions: GroupedReaction[];
  onToggle?: (emoji: string) => void;
}

const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  onToggle,
}) => {
  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className="message-reactions">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          className={`reaction-chip ${reaction.hasReacted ? 'active' : ''}`}
          onClick={() => onToggle?.(reaction.emoji)}
          title={reaction.users.map((u) => u.display_name || 'User').join(', ')}
        >
          <span className="reaction-emoji">{reaction.emoji}</span>
          <span className="reaction-count">{reaction.count}</span>
        </button>
      ))}

      <style>{`
        .message-reactions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.2rem;
          margin-top: 0.35rem;
        }

        .reaction-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          padding: 0.1rem 0.4rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 0.75rem;
        }

        .reaction-chip:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .reaction-chip.active {
          border-color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.2);
        }

        .reaction-emoji {
          font-size: 0.9rem;
        }

        .reaction-count {
          font-size: 0.7rem;
          font-weight: 500;
          color: inherit;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default MessageReactions;
