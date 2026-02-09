import { type User } from '../../types/database';

interface MentionAutocompleteProps {
  query: string; // The text after @ that user typed
  members: { user_id: string; user: User }[];
  onSelect: (user: User) => void;
  visible: boolean;
}

const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  members,
  onSelect,
  visible,
}) => {
  if (!visible || members.length === 0) return null;

  const filtered = members.filter((m) => {
    const name = m.user?.display_name?.toLowerCase() || '';
    return name.includes(query.toLowerCase());
  });

  if (filtered.length === 0) return null;

  return (
    <div className="mention-autocomplete">
      {filtered.slice(0, 5).map((m) => (
        <button
          key={m.user_id}
          className="mention-item"
          onClick={() => onSelect(m.user)}
        >
          <div className="mention-avatar">
            {m.user?.avatar_url ? (
              <img src={m.user.avatar_url} alt="" />
            ) : (
              <span className="mention-initial">
                {(m.user?.display_name || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="mention-name">{m.user?.display_name || '?'}</span>
        </button>
      ))}

      <style>{`
        .mention-autocomplete {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          box-shadow: 0 -4px 12px hsl(0 0% 0% / 0.1);
          margin-bottom: 0.25rem;
          overflow: hidden;
          z-index: 50;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mention-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.6rem 1rem;
          background: transparent;
          border: none;
          cursor: pointer;
          color: hsl(var(--foreground));
          font-size: 0.9rem;
          transition: background 0.15s;
        }

        .mention-item:hover {
          background: hsl(var(--muted) / 0.3);
        }

        .mention-item:not(:last-child) {
          border-bottom: 1px solid hsl(var(--border));
        }

        .mention-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
        }

        .mention-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mention-initial {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-size: 0.75rem;
          font-weight: 700;
        }

        .mention-name {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default MentionAutocomplete;
