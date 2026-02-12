import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon, IonSpinner } from '@ionic/react';
import { close, search } from 'ionicons/icons';
import ReactEmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { searchGifs, getTrendingGifs, type GifResult } from '../../services/gif';
import { hapticLight } from '../../utils/haptics';

interface EmojiGifPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiInsert: (emoji: string) => void;
  onGifSelect: (url: string, width: number, height: number) => void;
}

type TabType = 'emoji' | 'gif';

const QUICK_CATEGORIES = [
  { label: 'Trending', query: '' },
  { label: 'Reactions', query: 'reactions' },
  { label: 'Love', query: 'love' },
  { label: 'Funny', query: 'funny' },
  { label: 'Happy', query: 'happy' },
  { label: 'Sad', query: 'sad' },
  { label: 'Yes', query: 'yes' },
  { label: 'No', query: 'no' },
  { label: 'Thanks', query: 'thank you' },
  { label: 'Wow', query: 'wow' },
];

const EmojiGifPanel: React.FC<EmojiGifPanelProps> = ({
  isOpen,
  onClose,
  onEmojiInsert,
  onGifSelect,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('emoji');

  // GIF state
  const [gifQuery, setGifQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadTrending = useCallback(async () => {
    setIsLoadingGifs(true);
    const { gifs: trending } = await getTrendingGifs(30, i18n.language);
    setGifs(trending);
    setIsLoadingGifs(false);
  }, [i18n.language]);

  const loadCategory = useCallback(async (categoryQuery: string) => {
    if (!categoryQuery) {
      loadTrending();
      return;
    }
    setIsLoadingGifs(true);
    const { gifs: results } = await searchGifs(categoryQuery, 30, i18n.language);
    setGifs(results);
    setIsLoadingGifs(false);
  }, [i18n.language, loadTrending]);

  useEffect(() => {
    if (isOpen && activeTab === 'gif' && gifs.length === 0) {
      loadTrending();
    }
  }, [isOpen, activeTab, loadTrending, gifs.length]);

  const handleGifSearch = useCallback((value: string) => {
    setGifQuery(value);
    setActiveCategory(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      setActiveCategory(0);
      loadTrending();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoadingGifs(true);
      const { gifs: results } = await searchGifs(value.trim(), 30, i18n.language);
      setGifs(results);
      setIsLoadingGifs(false);
    }, 400);
  }, [i18n.language, loadTrending]);

  const handleCategoryClick = (index: number) => {
    setActiveCategory(index);
    setGifQuery('');
    loadCategory(QUICK_CATEGORIES[index].query);
  };

  const handleGifSelect = (gif: GifResult) => {
    onGifSelect(gif.url, gif.width, gif.height);
    onClose();
    setGifQuery('');
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    hapticLight();
    onEmojiInsert(emojiData.emoji);
  };

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'gif' && gifs.length === 0) {
      loadTrending();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="emoji-gif-panel">
      {/* Tab bar */}
      <div className="egp-tabs">
        <button
          className={`egp-tab ${activeTab === 'emoji' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('emoji')}
        >
          {t('chat.emojis')}
        </button>
        <button
          className={`egp-tab ${activeTab === 'gif' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('gif')}
        >
          {t('chat.gifs')}
        </button>
        <button className="egp-close-btn" onClick={onClose}>
          <IonIcon icon={close} />
        </button>
      </div>

      {/* Emoji tab */}
      {activeTab === 'emoji' && (
        <div className="egp-emoji-container">
          <ReactEmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.DARK}
            searchPlaceholder={t('common.search')}
            width="100%"
            height={300}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* GIF tab */}
      {activeTab === 'gif' && (
        <div className="egp-gif-container">
          <div className="egp-gif-search-bar">
            <IonIcon icon={search} className="egp-search-icon" />
            <input
              type="text"
              className="egp-search-input"
              placeholder={t('gif.searchPlaceholder')}
              value={gifQuery}
              onChange={(e) => handleGifSearch(e.target.value)}
            />
          </div>

          <div className="egp-gif-categories">
            {QUICK_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                className={`egp-cat-chip ${i === activeCategory ? 'active' : ''}`}
                onClick={() => handleCategoryClick(i)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="egp-gif-grid">
            {isLoadingGifs ? (
              <div className="egp-gif-loading">
                <IonSpinner name="crescent" />
              </div>
            ) : gifs.length === 0 ? (
              <div className="egp-gif-empty">{t('gif.noResults')}</div>
            ) : (
              gifs.map((gif) => (
                <button
                  key={gif.id}
                  className="egp-gif-item"
                  onClick={() => handleGifSelect(gif)}
                >
                  <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
                </button>
              ))
            )}
          </div>

          <div className="egp-powered-by">Powered by GIPHY</div>
        </div>
      )}

      <style>{`
        .emoji-gif-panel {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          background: hsl(var(--card));
          border-top: 1px solid hsl(var(--border));
          border-radius: 1rem 1rem 0 0;
          height: 50vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 -4px 20px hsl(0 0% 0% / 0.3);
          animation: egpSlideUp 0.2s ease-out;
        }

        @keyframes egpSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .egp-tabs {
          display: flex;
          align-items: center;
          border-bottom: 1px solid hsl(var(--border));
          flex-shrink: 0;
        }

        .egp-tab {
          flex: 1;
          padding: 0.75rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: hsl(var(--muted-foreground));
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }

        .egp-tab.active {
          color: hsl(var(--primary));
          border-bottom-color: hsl(var(--primary));
        }

        .egp-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          background: hsl(var(--muted) / 0.3);
          border: none;
          cursor: pointer;
          color: hsl(var(--foreground));
          font-size: 1.2rem;
          margin-right: 0.5rem;
          flex-shrink: 0;
        }

        /* Emoji tab */
        .egp-emoji-container {
          flex: 1;
          overflow: hidden;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        .egp-emoji-container .epr-main {
          --epr-bg-color: hsl(var(--card)) !important;
          --epr-category-label-bg-color: hsl(var(--card)) !important;
          --epr-search-input-bg-color: hsl(var(--muted) / 0.3) !important;
          --epr-hover-bg-color: rgba(124, 58, 237, 0.2) !important;
          --epr-active-skin-tone-indicator-border-color: rgb(124, 58, 237) !important;
          --epr-search-input-text-color: hsl(var(--foreground)) !important;
          --epr-text-color: hsl(var(--foreground)) !important;
          border: none !important;
          border-radius: 0 !important;
          font-family: 'Outfit', system-ui, sans-serif !important;
        }

        /* GIF tab */
        .egp-gif-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .egp-gif-search-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: hsl(var(--muted) / 0.3);
          border-radius: 1rem;
          padding: 0.5rem 0.75rem;
          margin: 0.5rem 0.75rem 0;
          flex-shrink: 0;
        }

        .egp-search-icon {
          color: hsl(var(--muted-foreground));
          font-size: 1rem;
          flex-shrink: 0;
        }

        .egp-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: hsl(var(--foreground));
          font-size: 0.9rem;
          font-family: inherit;
        }

        .egp-search-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .egp-gif-categories {
          display: flex;
          gap: 0.3rem;
          padding: 0.5rem 0.75rem;
          overflow-x: auto;
          flex-shrink: 0;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .egp-gif-categories::-webkit-scrollbar {
          display: none;
        }

        .egp-cat-chip {
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
          background: hsl(var(--muted) / 0.25);
          border: 1px solid hsl(var(--border));
          color: hsl(var(--muted-foreground));
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: inherit;
        }

        .egp-cat-chip.active {
          background: hsl(var(--primary) / 0.2);
          border-color: hsl(var(--primary));
          color: hsl(var(--primary));
        }

        .egp-gif-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4px;
          padding: 4px;
          overflow-y: auto;
          flex: 1;
          -webkit-overflow-scrolling: touch;
        }

        .egp-gif-loading,
        .egp-gif-empty {
          grid-column: 1 / -1;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 120px;
          color: hsl(var(--muted-foreground));
          font-size: 0.85rem;
        }

        .egp-gif-item {
          background: hsl(var(--muted) / 0.2);
          border: none;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
          border-radius: 0.4rem;
          aspect-ratio: 4/3;
        }

        .egp-gif-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .egp-gif-item:active {
          opacity: 0.7;
          transform: scale(0.97);
        }

        .egp-powered-by {
          text-align: center;
          font-size: 0.6rem;
          color: hsl(var(--muted-foreground));
          padding: 0.25rem 0.25rem calc(0.25rem + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid hsl(var(--border));
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};

export default EmojiGifPanel;
