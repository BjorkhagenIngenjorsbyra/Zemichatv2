import { useState, useEffect, useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonSpinner,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonSearchbar,
  IonButton,
  IonCheckbox,
  IonFooter,
} from '@ionic/react';
import { personOutline, personAddOutline, checkmarkCircle } from 'ionicons/icons';
import { getMyFriends, type FriendWithUser } from '../services/friend';
import { createChat } from '../services/chat';
import type { User } from '../types/database';

const NewChat: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const [contacts, setContacts] = useState<User[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Pre-select a user if navigated from Friends with ?add=userId
  const preselectedId = new URLSearchParams(location.search).get('add');

  const loadContacts = useCallback(async () => {
    const { friends } = await getMyFriends();
    const friendUsers = friends.map((f: FriendWithUser) => f.user);
    setContacts(friendUsers);
    setFilteredContacts(friendUsers);
    setIsLoading(false);

    if (preselectedId) {
      setSelectedIds(new Set([preselectedId]));
    }
  }, [preselectedId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const search = searchText.toLowerCase();
    const filtered = contacts.filter((c) => {
      const name = c.display_name?.toLowerCase() || '';
      const zemi = c.zemi_number?.toLowerCase() || '';
      return name.includes(search) || zemi.includes(search);
    });
    setFilteredContacts(filtered);
  }, [searchText, contacts]);

  const toggleContact = (contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handleCreateChat = async () => {
    if (isCreating || selectedIds.size === 0) return;

    setIsCreating(true);

    const memberIds = Array.from(selectedIds);
    const isGroup = memberIds.length > 1;

    const { chat, error } = await createChat({
      memberIds,
      isGroup,
    });

    if (error) {
      console.error('Failed to create chat:', error);
      setIsCreating(false);
      return;
    }

    if (chat) {
      history.replace(`/chat/${chat.id}`);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/chats" />
          </IonButtons>
          <IonTitle>{t('chat.newChat')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value || '')}
            placeholder={t('common.search') || 'Search...'}
            className="search-bar"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        {isLoading ? (
          <div className="loading-state">
            <IonSpinner name="crescent" />
          </div>
        ) : filteredContacts.length === 0 && contacts.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={personOutline} className="empty-icon" />
            <h2>{t('chat.noFriends')}</h2>
            <p>{t('chat.addFriendsFirst')}</p>
            <IonButton routerLink="/add-friend" className="add-friend-button">
              <IonIcon icon={personAddOutline} slot="start" />
              {t('friends.addFriend')}
            </IonButton>
          </div>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="selected-chips">
                {contacts
                  .filter((c) => selectedIds.has(c.id))
                  .map((c) => (
                    <button
                      key={c.id}
                      className="selected-chip"
                      onClick={() => toggleContact(c.id)}
                    >
                      <span className="chip-name">{c.display_name}</span>
                      <span className="chip-remove">&times;</span>
                    </button>
                  ))}
              </div>
            )}

            <p className="section-label">{t('chat.selectFriends')}</p>
            <IonList className="contact-list">
              {filteredContacts.map((contact) => {
                const isSelected = selectedIds.has(contact.id);
                return (
                  <IonItem
                    key={contact.id}
                    button
                    detail={false}
                    className={`contact-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleContact(contact.id)}
                    disabled={isCreating}
                  >
                    <IonAvatar slot="start" className="contact-avatar">
                      {contact.avatar_url ? (
                        <img src={contact.avatar_url} alt={contact.display_name || ''} />
                      ) : (
                        <div className="avatar-placeholder">
                          {contact.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </IonAvatar>
                    <IonLabel>
                      <h2 className="contact-name">
                        {contact.display_name || t('dashboard.unnamed')}
                      </h2>
                      <p className="contact-zemi">{contact.zemi_number}</p>
                    </IonLabel>
                    <IonCheckbox
                      slot="end"
                      checked={isSelected}
                      className="contact-checkbox"
                    />
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        <style>{`
          .loading-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 3rem;
            height: calc(100% - 100px);
          }

          .empty-icon {
            font-size: 4rem;
            color: hsl(var(--muted));
            margin-bottom: 1rem;
          }

          .empty-state h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.25rem;
            color: hsl(var(--foreground));
          }

          .empty-state p {
            margin: 0 0 1rem 0;
            color: hsl(var(--muted-foreground));
          }

          .add-friend-button {
            --border-radius: 9999px;
            font-weight: 600;
          }

          .selected-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .selected-chip {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border: none;
            border-radius: 9999px;
            padding: 0.375rem 0.75rem;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
          }

          .chip-remove {
            font-size: 1.1rem;
            line-height: 1;
            opacity: 0.8;
          }

          .section-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 1rem 0.5rem;
          }

          .search-bar {
            --background: hsl(var(--card));
            --border-radius: 1rem;
            --box-shadow: none;
          }

          .contact-list {
            background: transparent;
            padding: 0;
            padding-bottom: 5rem;
          }

          .contact-item {
            --background: hsl(var(--card));
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
            margin-bottom: 0.5rem;
            border-radius: 1rem;
            overflow: hidden;
          }

          .contact-item.selected {
            --background: hsla(var(--primary), 0.08);
            outline: 2px solid hsl(var(--primary));
          }

          .contact-item::part(native) {
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
          }

          .contact-avatar {
            width: 48px;
            height: 48px;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .contact-name {
            font-weight: 600;
            font-size: 1rem;
            color: hsl(var(--foreground));
            margin: 0 0 0.25rem 0;
          }

          .contact-zemi {
            font-family: monospace;
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
          }

          .contact-checkbox {
            --size: 24px;
            margin-right: 0.5rem;
          }

          .create-chat-footer {
            padding: 0.75rem 1rem;
            padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
            background: hsl(var(--card));
            border-top: 1px solid hsl(var(--border));
          }

          .create-chat-button {
            --border-radius: 1rem;
            font-weight: 700;
            font-size: 1rem;
            margin: 0;
            height: 48px;
          }
        `}</style>
      </IonContent>

      {selectedIds.size > 0 && (
        <IonFooter className="create-chat-footer">
          <IonButton
            expand="block"
            className="create-chat-button glow-primary"
            onClick={handleCreateChat}
            disabled={isCreating}
          >
            {isCreating ? (
              <IonSpinner name="crescent" />
            ) : (
              `${t('chat.createChat')} (${selectedIds.size})`
            )}
          </IonButton>
        </IonFooter>
      )}
    </IonPage>
  );
};

export default NewChat;
