import { useTranslation } from 'react-i18next';

interface TypingIndicatorProps {
  typers: { userId: string; displayName: string }[];
  isGroup?: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typers, isGroup = false }) => {
  const { t } = useTranslation();

  if (typers.length === 0) return null;

  const names = typers.map((t) => t.displayName);
  const label = isGroup
    ? names.length === 1
      ? t('chat.typingOne', { name: names[0] })
      : t('chat.typingMultiple', { count: names.length })
    : t('chat.typing');

  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-label">{label}</span>

      <style>{`
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          animation: fade-slide-in 0.2s ease-out;
        }

        .typing-dots {
          display: flex;
          gap: 3px;
          align-items: center;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 1rem;
          padding: 0.5rem 0.75rem;
        }

        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: hsl(var(--muted-foreground));
          animation: typing-bounce 1.4s infinite ease-in-out;
        }

        .typing-dot:nth-child(1) { animation-delay: 0s; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }

        .typing-label {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;
