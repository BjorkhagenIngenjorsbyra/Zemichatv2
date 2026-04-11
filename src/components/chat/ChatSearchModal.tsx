import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonSearchbar,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonSpinner,
  IonButtons,
  IonButton,
  IonIcon,
} from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { searchInChat, searchGlobal, type SearchResultMessage } from '../../services/search';
import { useAuthContext } from '../../contexts/AuthContext';
import { getAvatarColor, getInitial } from '../../utils/userDisplay';

interface ChatSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string; // If provided, search within this chat only
  onSelectMessage?: (message: SearchResultMessage) => void;
}

export const ChatSearchModal: React.FC<ChatSearchModalProps> = ({
  isOpen,
  onClose,
  chatId,
  onSelectMessage,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const searchbarRef = useRef<HTMLIonSearchbarElement>(null);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      const { results: searchResults, error } = chatId
        ? await searchInChat(chatId, searchQuery)
        : await searchGlobal(searchQuery);

      if (!error) {
        setResults(searchResults);
      }

      setIsSearching(false);
    },
    [chatId]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // Focus searchbar when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchbarRef.current?.setFocus();
      }, 300);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  const handleSelectResult = (message: SearchResultMessage) => {
    if (onSelectMessage) {
      onSelectMessage(message);
    } else {
      // Navigate to the chat if global search
      history.push(`/chat/${message.chat_id}`);
    }
    onClose();
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!text || !query) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <mark className="search-highlight">{text.slice(index, index + query.length)}</mark>
        {text.slice(index + query.length)}
      </>
    );
  };

  const getChatName = (message: SearchResultMessage): string => {
    // Group chat: use the chat name
    if (message.chat?.name) return message.chat.name;
    // 1-on-1 chat: derive from the other member
    const other = message.chat?.members?.find((m) => m.user_id !== profile?.id);
    if (other?.user) {
      return other.user.display_name || other.user.zemi_number || t('chat.newChat');
    }
    return t('chat.newChat');
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonSearchbar
            ref={searchbarRef}
            value={query}
            onIonInput={(e) => setQuery(e.detail.value || '')}
            placeholder={chatId ? t('search.inChat') : t('search.global')}
            debounce={0}
            showCancelButton="never"
          />
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {isSearching ? (
          <div className="search-loading">
            <IonSpinner name="crescent" />
            <p>{t('search.searching')}</p>
          </div>
        ) : query.trim().length < 2 ? (
          <div className="search-hint">
            <p>{t('search.placeholder')}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="search-empty">
            <p>{t('search.noResults')}</p>
          </div>
        ) : (
          <>
            <div className="results-count">
              <span>
                {t('search.results', { count: results.length })}
              </span>
            </div>
            <IonList className="search-results">
              {results.map((result) => (
                <IonItem
                  key={result.id}
                  button
                  detail={false}
                  onClick={() => handleSelectResult(result)}
                  className="search-result-item"
                >
                  <IonAvatar slot="start" className="result-avatar">
                    {result.sender?.avatar_url ? (
                      <img src={result.sender.avatar_url} alt="" />
                    ) : (
                      <div
                        className="avatar-placeholder"
                        style={{ background: getAvatarColor(result.sender) }}
                      >
                        {getInitial(result.sender)}
                      </div>
                    )}
                  </IonAvatar>
                  <IonLabel>
                    <div className="result-header">
                      <span className="sender-name">
                        {result.sender?.id === profile?.id
                          ? t('common.you', 'Du')
                          : result.sender?.display_name || result.sender?.zemi_number || t('dashboard.unnamed')}
                      </span>
                      {!chatId && (
                        <span className="chat-name">{getChatName(result)}</span>
                      )}
                      <span className="result-time">{formatTime(result.created_at)}</span>
                    </div>
                    <p className="result-content">
                      {highlightMatch(result.content || '', query)}
                    </p>
                  </IonLabel>
                </IonItem>
              ))}
            </IonList>
          </>
        )}

        <style>{`
          /* Override Ionic's default dark modal background that comes from
             --ion-background-color = dark navy. Use the app's light theme. */
          ion-modal {
            --background: hsl(var(--background));
            --color: hsl(var(--foreground));
          }
          ion-modal ion-content {
            --background: hsl(var(--background));
            --color: hsl(var(--foreground));
          }
          ion-modal ion-toolbar {
            --background: hsl(var(--background));
            --color: hsl(var(--foreground));
            --border-color: hsl(var(--border));
          }
          ion-modal ion-searchbar {
            --background: hsl(var(--muted)) !important;
            --color: hsl(var(--foreground)) !important;
            --placeholder-color: hsl(var(--muted-foreground)) !important;
            --icon-color: hsl(var(--muted-foreground)) !important;
            --clear-button-color: hsl(var(--muted-foreground)) !important;
            --box-shadow: none !important;
          }

          .search-loading,
          .search-hint,
          .search-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: hsl(var(--muted-foreground));
            gap: 0.5rem;
          }

          .results-count {
            padding: 0.5rem 1rem;
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            letter-spacing: 0.02em;
            letter-spacing: 0.05em;
          }

          .search-results {
            background: transparent;
          }

          .search-result-item {
            --background: transparent;
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
            --border-color: hsl(var(--border));
          }

          .result-avatar {
            width: 40px;
            height: 40px;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            border-radius: 50%;
          }

          .result-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.25rem;
          }

          .sender-name {
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .chat-name {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            padding: 0.125rem 0.5rem;
            background: hsl(var(--muted) / 0.3);
            border-radius: 9999px;
          }

          .result-time {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            margin-left: auto;
          }

          .result-content {
            font-size: 0.9rem;
            color: hsl(var(--foreground));
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .search-highlight {
            background: hsl(var(--primary) / 0.3);
            color: hsl(var(--foreground));
            padding: 0 0.125rem;
            border-radius: 0.25rem;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};
