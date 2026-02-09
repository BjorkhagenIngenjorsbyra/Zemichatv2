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

const GifPicker: React.FC<GifPickerProps> = ({ isOpen, onClose, onSelect }) => {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadTrending = useCallback(async () => {
    setIsLoading(true);
    const { gifs: trending } = await getTrendingGifs(30, i18n.language);
    setGifs(trending);
    setIsLoading(false);
  }, [i18n.language]);

  useEffect(() => {
    if (isOpen && gifs.length === 0) {
      loadTrending();
    }
  }, [isOpen, loadTrending, gifs.length]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
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
            <IonIcon icon={search} className="search-icon" />
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
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .gif-picker {
          background: hsl(var(--card));
          border-top: 1px solid hsl(var(--border));
          border-radius: 1rem 1rem 0 0;
          max-height: 50vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 -4px 20px hsl(0 0% 0% / 0.15);
        }

        .gif-picker-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-bottom: 1px solid hsl(var(--border));
        }

        .gif-search-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: hsl(var(--muted) / 0.3);
          border-radius: 1rem;
          padding: 0.5rem 0.75rem;
        }

        .search-icon {
          color: hsl(var(--muted-foreground));
          font-size: 1rem;
          flex-shrink: 0;
        }

        .gif-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: hsl(var(--foreground));
          font-size: 0.9rem;
        }

        .gif-search-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .gif-close-btn {
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

        .gif-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 4px;
          overflow-y: auto;
          flex: 1;
          min-height: 200px;
          max-height: calc(50vh - 100px);
        }

        .gif-loading,
        .gif-empty {
          grid-column: 1 / -1;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 150px;
          color: hsl(var(--muted-foreground));
          font-size: 0.875rem;
        }

        .gif-item {
          background: hsl(var(--muted) / 0.2);
          border: none;
          cursor: pointer;
          padding: 0;
          overflow: hidden;
          border-radius: 0.25rem;
          aspect-ratio: 1;
        }

        .gif-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .gif-item:active {
          opacity: 0.7;
        }

        .gif-powered-by {
          text-align: center;
          font-size: 0.65rem;
          color: hsl(var(--muted-foreground));
          padding: 0.25rem;
          border-top: 1px solid hsl(var(--border));
        }
      `}</style>
    </div>
  );
};

export default GifPicker;
