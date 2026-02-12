import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon, IonSpinner } from '@ionic/react';
import { close, search } from 'ionicons/icons';
import { searchGifs, getTrendingGifs, type GifResult } from '../../services/gif';

interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string, width: number, height: number) => void;
}

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

const GifPicker: React.FC<GifPickerProps> = ({ isOpen, onClose, onSelect }) => {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadTrending = useCallback(async () => {
    setIsLoading(true);
    const { gifs: trending } = await getTrendingGifs(30, i18n.language);
    setGifs(trending);
    setIsLoading(false);
  }, [i18n.language]);

  const loadCategory = useCallback(async (categoryQuery: string) => {
    if (!categoryQuery) {
      loadTrending();
      return;
    }
    setIsLoading(true);
    const { gifs: results } = await searchGifs(categoryQuery, 30, i18n.language);
    setGifs(results);
    setIsLoading(false);
  }, [i18n.language, loadTrending]);

  useEffect(() => {
    if (isOpen && gifs.length === 0) {
      loadTrending();
    }
  }, [isOpen, loadTrending, gifs.length]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
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
      setIsLoading(true);
      const { gifs: results } = await searchGifs(value.trim(), 30, i18n.language);
      setGifs(results);
      setIsLoading(false);
    }, 400);
  }, [i18n.language, loadTrending]);

  const handleCategoryClick = (index: number) => {
    setActiveCategory(index);
    setQuery('');
    loadCategory(QUICK_CATEGORIES[index].query);
  };

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.url, gif.width, gif.height);
    onClose();
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="gif-picker-overlay">
      <div className="gif-picker">
        <div className="gif-picker-header">
          <div className="gif-search-bar">
            <IonIcon icon={search} className="gif-search-icon" />
            <input
              type="text"
              className="gif-search-input"
              placeholder={t('gif.searchPlaceholder')}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button className="gif-close-btn" onClick={onClose}>
            <IonIcon icon={close} />
          </button>
        </div>

        <div className="gif-categories">
          {QUICK_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              className={`gif-cat-chip ${i === activeCategory ? 'active' : ''}`}
              onClick={() => handleCategoryClick(i)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="gif-grid">
          {isLoading ? (
            <div className="gif-loading">
              <IonSpinner name="crescent" />
            </div>
          ) : gifs.length === 0 ? (
            <div className="gif-empty">{t('gif.noResults')}</div>
          ) : (
            gifs.map((gif) => (
              <button
                key={gif.id}
                className="gif-item"
                onClick={() => handleSelect(gif)}
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                />
              </button>
            ))
          )}
        </div>

        <div className="gif-powered-by">Powered by GIPHY</div>
      </div>

      <style>{`
        .gif-picker-overlay {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          animation: gif-slideUp 0.2s ease-out;
        }

        @keyframes gif-slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .gif-picker {
          background: hsl(var(--card));
          border-top: 1px solid hsl(var(--border));
          border-radius: 1rem 1rem 0 0;
          height: 60vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 -4px 20px hsl(0 0% 0% / 0.3);
        }

        .gif-picker-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          flex-shrink: 0;
        }

        .gif-search-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: hsl(var(--muted) / 0.3);
          border-radius: 1rem;
          padding: 0.6rem 0.75rem;
        }

        .gif-search-icon {
          color: hsl(var(--muted-foreground));
          font-size: 1.1rem;
          flex-shrink: 0;
        }

        .gif-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: hsl(var(--foreground));
          font-size: 0.95rem;
          font-family: inherit;
        }

        .gif-search-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .gif-close-btn {
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
        }

        .gif-categories {
          display: flex;
          gap: 0.35rem;
          padding: 0 0.75rem 0.5rem;
          overflow-x: auto;
          flex-shrink: 0;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .gif-categories::-webkit-scrollbar {
          display: none;
        }

        .gif-cat-chip {
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
          background: hsl(var(--muted) / 0.25);
          border: 1px solid hsl(var(--border));
          color: hsl(var(--muted-foreground));
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: inherit;
        }

        .gif-cat-chip.active {
          background: hsl(var(--primary) / 0.2);
          border-color: hsl(var(--primary));
          color: hsl(var(--primary));
        }

        .gif-cat-chip:hover:not(.active) {
          background: hsl(var(--muted) / 0.4);
        }

        .gif-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          padding: 6px;
          overflow-y: auto;
          flex: 1;
          -webkit-overflow-scrolling: touch;
        }

        .gif-loading,
        .gif-empty {
          grid-column: 1 / -1;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          color: hsl(var(--muted-foreground));
          font-size: 0.9rem;
        }

        .gif-item {
          background: hsl(var(--muted) / 0.2);
          border: none;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
          border-radius: 0.5rem;
          aspect-ratio: 4/3;
        }

        .gif-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .gif-item:active {
          opacity: 0.7;
          transform: scale(0.97);
        }

        .gif-powered-by {
          text-align: center;
          font-size: 0.65rem;
          color: hsl(var(--muted-foreground));
          padding: 0.35rem 0.35rem calc(0.35rem + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid hsl(var(--border));
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};

export default GifPicker;
