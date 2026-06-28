import { useTranslation } from 'react-i18next';
import { hapticLight } from '../../utils/haptics';
import ReactEmojiPicker, { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();
  // Dismissal is handled by the backdrop onClick + inner stopPropagation; a
  // separate document mousedown listener was redundant (#485).

  const handleSelect = (emojiData: EmojiClickData) => {
    hapticLight();
    onSelect(emojiData.emoji);
    onClose();
  };

  return (
    <div className="full-emoji-backdrop" onClick={onClose}>
      <div
        className="full-emoji-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t('a11y.selectReaction')}
      >
        <ReactEmojiPicker
          onEmojiClick={handleSelect}
          theme={Theme.AUTO}
          /* Use native system emojis instead of CDN PNG sprites — see #5. */
          emojiStyle={EmojiStyle.NATIVE}
          searchPlaceholder={t('common.search')}
          width="100%"
          height={350}
          previewConfig={{ showPreview: false }}
        />
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
          animation: emojiPickerFadeIn 0.15s ease-out;
        }

        @keyframes emojiPickerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .full-emoji-picker {
          width: 100%;
          max-width: 420px;
          animation: emojiPickerSlideUp 0.2s ease-out;
          overflow: hidden;
          border-radius: 1.25rem 1.25rem 0 0;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: rgb(20, 24, 36);
        }

        @keyframes emojiPickerSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .full-emoji-picker .epr-main {
          --epr-bg-color: rgb(20, 24, 36) !important;
          --epr-category-label-bg-color: rgb(20, 24, 36) !important;
          --epr-search-input-bg-color: rgb(35, 40, 60) !important;
          --epr-hover-bg-color: hsl(var(--primary) / 0.2) !important;
          --epr-active-skin-tone-indicator-border-color: hsl(var(--primary)) !important;
          --epr-search-input-text-color: #f3f4f6 !important;
          --epr-text-color: #f3f4f6 !important;
          border: none !important;
          border-radius: 0 !important;
          font-family: 'Nunito', system-ui, sans-serif !important;
        }
      `}</style>
    </div>
  );
};

export default EmojiPicker;
