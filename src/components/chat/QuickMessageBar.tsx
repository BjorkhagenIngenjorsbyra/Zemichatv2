import React, { useState, useEffect } from 'react';
import { IonButton, IonSpinner } from '@ionic/react';
import { getMyQuickMessages } from '../../services/quickMessage';
import { type QuickMessage } from '../../types/database';

interface QuickMessageBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

/**
 * Horizontal scrollable bar of quick message buttons.
 * One-tap to send a pre-configured message.
 */
export const QuickMessageBar: React.FC<QuickMessageBarProps> = ({
  onSend,
  disabled = false,
}) => {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const { messages: quickMsgs } = await getMyQuickMessages();
      setMessages(quickMsgs);
      setIsLoading(false);
    };

    loadMessages();
  }, []);

  const handleSend = async (message: QuickMessage) => {
    if (disabled || sendingId) return;

    setSendingId(message.id);
    onSend(message.content);

    // Brief feedback delay
    setTimeout(() => setSendingId(null), 300);
  };

  // Don't render if no quick messages
  if (!isLoading && messages.length === 0) {
    return null;
  }

  return (
    <div className="quick-message-bar">
      {isLoading ? (
        <div className="loading-indicator">
          <IonSpinner name="dots" />
        </div>
      ) : (
        <div className="quick-message-scroll">
          {messages.map((msg) => (
            <IonButton
              key={msg.id}
              fill="outline"
              size="small"
              className={`quick-message-button ${sendingId === msg.id ? 'sending' : ''}`}
              onClick={() => handleSend(msg)}
              disabled={disabled || !!sendingId}
            >
              {msg.content}
            </IonButton>
          ))}
        </div>
      )}

      <style>{`
        .quick-message-bar {
          padding: 0.5rem 0.5rem 0.25rem;
          background: hsl(var(--background));
          border-top: 1px solid hsl(var(--border));
        }

        .loading-indicator {
          display: flex;
          justify-content: center;
          padding: 0.25rem;
        }

        .quick-message-scroll {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .quick-message-scroll::-webkit-scrollbar {
          display: none;
        }

        .quick-message-button {
          --border-radius: 9999px;
          --padding-start: 0.75rem;
          --padding-end: 0.75rem;
          flex-shrink: 0;
          font-size: 0.85rem;
          font-weight: 500;
          transition: transform 0.1s ease;
        }

        .quick-message-button.sending {
          transform: scale(0.95);
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
};

export default QuickMessageBar;
