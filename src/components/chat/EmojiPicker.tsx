import { useState } from 'react';
import { hapticLight } from '../../utils/haptics';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗',
      '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝',
      '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨',
      '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬',
      '😮‍💨', '🤥', '🫠', '😌', '😔', '😪', '🤤', '😴',
      '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴',
      '😵', '🤯', '🥳', '🥸', '😎', '🤓', '🧐', '😕',
      '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
      '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
      '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
      '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
    ],
  },
  {
    label: 'Gestures',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳',
      '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '💪', '🦾',
    ],
  },
  {
    label: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '💟', '♥️', '🫀', '💋',
    ],
  },
  {
    label: 'Celebration',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🎂', '🍰', '🧁', '🥂',
      '🍾', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🌟',
      '⭐', '🌈', '🔥', '✨', '💫', '💥', '💯', '🎯',
      '🙈', '🙉', '🙊', '💐', '🌹', '🌸', '🪷', '🌺',
    ],
  },
  {
    label: 'Animals',
    icon: '🐱',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
      '🐔', '🐧', '🐦', '🦅', '🦆', '🦉', '🐴', '🦄',
      '🐝', '🐛', '🦋', '🐌', '🐙', '🦑', '🐠', '🐬',
    ],
  },
  {
    label: 'Food',
    icon: '🍕',
    emojis: [
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍒', '🍑', '🥝', '🍕', '🍔', '🍟', '🌭', '🍿',
      '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🍦', '🍩',
      '🍪', '🎂', '🍰', '☕', '🍵', '🧃', '🍺', '🍷',
    ],
  },
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState(0);

  const handleSelect = (emoji: string) => {
    hapticLight();
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="full-emoji-backdrop" onClick={onClose}>
      <div
        className="full-emoji-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Select reaction"
      >
        {/* Category tabs */}
        <div className="emoji-category-tabs">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              className={`emoji-cat-tab ${i === activeCategory ? 'active' : ''}`}
              onClick={() => setActiveCategory(i)}
              aria-label={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        {/* Category label */}
        <div className="emoji-category-label">
          {EMOJI_CATEGORIES[activeCategory].label}
        </div>

        {/* Emoji grid */}
        <div className="emoji-grid">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button
              key={emoji}
              className="emoji-grid-btn"
              onClick={() => handleSelect(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .full-emoji-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          justify-content: center;
          align-items: flex-end;
          z-index: 1100;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .full-emoji-picker {
          width: 100%;
          max-width: 420px;
          max-height: 50vh;
          background: hsl(var(--card));
          border-radius: 1.25rem 1.25rem 0 0;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
          border: 1px solid hsl(var(--border));
          border-bottom: none;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.2s ease-out;
          overflow: hidden;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .emoji-category-tabs {
          display: flex;
          gap: 0;
          padding: 0.5rem 0.5rem 0;
          border-bottom: 1px solid hsl(var(--border));
          flex-shrink: 0;
        }

        .emoji-cat-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 1.25rem;
          transition: all 0.15s;
          border-radius: 0.5rem 0.5rem 0 0;
        }

        .emoji-cat-tab.active {
          border-bottom-color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.1);
        }

        .emoji-cat-tab:hover:not(.active) {
          background: hsl(var(--muted) / 0.3);
        }

        .emoji-category-label {
          padding: 0.5rem 1rem 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 0.125rem;
          padding: 0.25rem 0.5rem 1rem;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .emoji-grid-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          aspect-ratio: 1;
          border-radius: 0.5rem;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 1.5rem;
          transition: all 0.1s;
          padding: 0;
        }

        .emoji-grid-btn:hover {
          background: hsl(var(--muted) / 0.5);
          transform: scale(1.15);
        }

        .emoji-grid-btn:active {
          transform: scale(0.9);
        }
      `}</style>
    </div>
  );
};

export default EmojiPicker;
