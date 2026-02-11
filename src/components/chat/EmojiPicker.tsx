import { useEffect, useRef } from 'react';
import { hapticLight } from '../../utils/haptics';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiMartEmoji {
  native: string;
  id: string;
  name: string;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSelect = (emoji: EmojiMartEmoji) => {
    hapticLight();
    onSelect(emoji.native);
    onClose();
  };

  return (
    <div className="full-emoji-backdrop" onClick={onClose}>
      <div
        ref={pickerRef}
        className="full-emoji-picker"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Select reaction"
      >
        <Picker
          data={data}
          onEmojiSelect={handleSelect}
          theme="dark"
          set="native"
          perLine={8}
          emojiSize={28}
          emojiButtonSize={36}
          maxFrequentRows={2}
          previewPosition="none"
          skinTonePosition="search"
          navPosition="top"
          categories={[
            'frequent',
            'people',
            'nature',
            'foods',
            'activity',
            'places',
            'objects',
            'symbols',
            'flags',
          ]}
          locale="sv"
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
        }

        @keyframes emojiPickerSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        /* Override emoji-mart styles for Zemichat dark theme */
        .full-emoji-picker em-emoji-picker {
          width: 100% !important;
          max-width: 100% !important;
          height: 55vh !important;
          max-height: 55vh !important;
          --rgb-background: 20, 24, 36;
          --rgb-input: 35, 40, 60;
          --rgb-color: 243, 244, 246;
          --rgb-accent: 124, 58, 237;
          --font-family: 'Outfit', system-ui, sans-serif;
          --font-size: 14px;
          --shadow: none;
          border: none !important;
          border-radius: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default EmojiPicker;
