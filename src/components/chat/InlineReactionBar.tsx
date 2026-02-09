import { useEffect, useRef } from 'react';
import { QUICK_REACTIONS } from '../../services/reaction';
import { hapticLight } from '../../utils/haptics';

interface InlineReactionBarProps {
  targetRect: { top: number; left: number; width: number; bottom: number };
  isOwn: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const InlineReactionBar: React.FC<InlineReactionBarProps> = ({
  targetRect,
  isOwn,
  onSelect,
  onClose,
}) => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay listener to avoid immediate close from the same long-press event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  const handleSelect = (emoji: string) => {
    hapticLight();
    onSelect(emoji);
    onClose();
  };

  // Position above the message bubble
  const BAR_HEIGHT = 48;
  const BAR_WIDTH = QUICK_REACTIONS.length * 44 + 16; // approx width
  const GAP = 8;

  let top = targetRect.top - BAR_HEIGHT - GAP;
  // If not enough space above, position below
  if (top < 60) {
    top = targetRect.bottom + GAP;
  }

  // Horizontal: align with message bubble
  let left = isOwn
    ? targetRect.left + targetRect.width - BAR_WIDTH
    : targetRect.left;

  // Clamp to viewport
  const viewportWidth = window.innerWidth;
  if (left < 8) left = 8;
  if (left + BAR_WIDTH > viewportWidth - 8) left = viewportWidth - BAR_WIDTH - 8;

  return (
    <div className="inline-reaction-backdrop">
      <div
        ref={barRef}
        className="inline-reaction-bar"
        style={{ top: `${top}px`, left: `${left}px` }}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            className="reaction-btn"
            onClick={() => handleSelect(emoji)}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <style>{`
        .inline-reaction-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
        }

        .inline-reaction-bar {
          position: fixed;
          display: flex;
          gap: 0.25rem;
          padding: 0.5rem;
          background: hsl(var(--card));
          border-radius: 9999px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          border: 1px solid hsl(var(--border));
          animation: reaction-bar-in 0.15s ease-out;
          z-index: 1000;
        }

        @keyframes reaction-bar-in {
          from { opacity: 0; transform: scale(0.9) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .reaction-btn {
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
          padding: 0;
        }

        .reaction-btn:hover {
          background: hsl(var(--muted) / 0.5);
          transform: scale(1.2);
        }

        .reaction-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

export default InlineReactionBar;
