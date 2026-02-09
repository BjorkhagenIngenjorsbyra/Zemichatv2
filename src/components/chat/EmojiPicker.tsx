import { QUICK_REACTIONS } from '../../services/reaction';
import { hapticLight } from '../../utils/haptics';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const handleSelect = (emoji: string) => {
    hapticLight();
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="emoji-picker-backdrop" onClick={onClose}>
      <div
        className="emoji-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Select reaction"
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            className="emoji-button"
            onClick={() => handleSelect(emoji)}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <style>{`
        .emoji-picker-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .emoji-picker {
          display: flex;
          gap: 0.25rem;
          padding: 0.5rem;
          background: hsl(var(--card));
          border-radius: 9999px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          border: 1px solid hsl(var(--border));
          animation: scaleIn 0.15s ease-out;
        }

        @keyframes scaleIn {
          from { transform: scale(0.9); }
          to { transform: scale(1); }
        }

        .emoji-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 1.5rem;
          transition: all 0.15s;
        }

        .emoji-button:hover {
          background: hsl(var(--muted) / 0.5);
          transform: scale(1.2);
        }

        .emoji-button:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

export default EmojiPicker;
