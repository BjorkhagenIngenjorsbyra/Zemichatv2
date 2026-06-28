import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon } from '@ionic/react';
import { close } from 'ionicons/icons';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

// Sticker packs: large emojis organized by category
const STICKER_PACKS = {
  smileys: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '😇', '🤗', '🤔', '😴', '🤯', '😱', '🥺', '😭', '😤', '🤮', '💀', '👻', '🤡'],
  gestures: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🙏', '❤️', '💔', '💯', '🔥', '⭐', '🎉', '🎊', '🏆', '🥇', '💎', '🌟'],
  animals: ['🐶', '🐱', '🐻', '🐼', '🦊', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🦄', '🐝', '🦋', '🐢', '🐬', '🐙', '🦖', '🦩', '🐾'],
  food: ['🍕', '🍔', '🍟', '🌮', '🍣', '🍩', '🎂', '🍰', '🍦', '🍫', '🍪', '☕', '🧃', '🍎', '🍉', '🍓', '🥑', '🌽', '🍿', '🧁'],
};

type PackKey = keyof typeof STICKER_PACKS;

const PACK_LABELS: Record<PackKey, string> = {
  smileys: '😀',
  gestures: '👍',
  animals: '🐶',
  food: '🍕',
};

// Accessible names for the pack tabs (the visible label is just an emoji).
const PACK_A11Y: Record<PackKey, string> = {
  smileys: 'Smileys',
  gestures: 'Gestures',
  animals: 'Animals',
  food: 'Food',
};

const StickerPicker: React.FC<StickerPickerProps> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();
  const [activePack, setActivePack] = useState<PackKey>('smileys');

  // Allow Escape to dismiss (keyboard / screen-reader users).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stickers = STICKER_PACKS[activePack];

  return (
    <>
      <div className="sticker-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sticker-picker-overlay">
      <div
        className="sticker-picker"
        role="dialog"
        aria-modal="true"
        aria-label={t('sticker.title')}
      >
        <div className="sticker-picker-header">
          <span className="sticker-title">{t('sticker.title')}</span>
          <button className="sticker-close-btn" onClick={onClose} aria-label={t('common.close')}>
            <IonIcon icon={close} />
          </button>
        </div>

        {/* Pack tabs */}
        <div className="sticker-tabs">
          {(Object.keys(STICKER_PACKS) as PackKey[]).map((key) => (
            <button
              key={key}
              className={`sticker-tab ${activePack === key ? 'active' : ''}`}
              onClick={() => setActivePack(key)}
              aria-label={PACK_A11Y[key]}
              aria-pressed={activePack === key}
            >
              {PACK_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Sticker grid */}
        <div className="sticker-grid">
          {stickers.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              className="sticker-item"
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .sticker-picker-overlay {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          animation: slideUp 0.2s ease-out;
        }

        .sticker-picker {
          background: hsl(var(--card));
          border-top: 1px solid hsl(var(--border));
          border-radius: 1rem 1rem 0 0;
          max-height: 45vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 -4px 20px hsl(0 0% 0% / 0.15);
        }

        .sticker-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid hsl(var(--border));
        }

        .sticker-title {
          font-weight: 600;
          font-size: 0.9rem;
          color: hsl(var(--foreground));
        }

        .sticker-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: hsl(var(--muted) / 0.3);
          border: none;
          cursor: pointer;
          color: hsl(var(--foreground));
          font-size: 1.1rem;
        }

        .sticker-tabs {
          display: flex;
          gap: 0.25rem;
          padding: 0.5rem;
          border-bottom: 1px solid hsl(var(--border));
        }

        .sticker-tab {
          flex: 1;
          padding: 0.5rem;
          background: transparent;
          border: none;
          border-radius: 0.5rem;
          font-size: 1.25rem;
          cursor: pointer;
          transition: background 0.15s;
        }

        .sticker-tab.active {
          background: hsl(var(--primary) / 0.15);
        }

        .sticker-tab:hover {
          background: hsl(var(--muted) / 0.3);
        }

        .sticker-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          padding: 0.5rem 0.5rem calc(0.5rem + env(safe-area-inset-bottom, 0px));
          overflow-y: auto;
          flex: 1;
        }

        .sticker-item {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 2.5rem;
          padding: 0.5rem;
          border-radius: 0.5rem;
          transition: background 0.15s, transform 0.1s;
        }

        .sticker-item:hover {
          background: hsl(var(--muted) / 0.3);
        }

        .sticker-item:active {
          transform: scale(1.2);
        }

        .sticker-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.2);
          z-index: 199;
        }
      `}</style>
    </div>
    </>
  );
};

export default StickerPicker;
