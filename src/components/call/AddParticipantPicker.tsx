import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonSpinner,
} from '@ionic/react';
import { supabase } from '../../services/supabase';
import type { User } from '../../types/database';

interface AddParticipantPickerProps {
  isOpen: boolean;
  chatId: string;
  currentParticipantIds: string[];
  onClose: () => void;
  onSelect: (userId: string) => void;
}

const AddParticipantPicker: React.FC<AddParticipantPickerProps> = ({
  isOpen,
  chatId,
  currentParticipantIds,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [allMembers, setAllMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Fetch on open/chat change only — NOT on currentParticipantIds identity,
  // which the parent often passes as a fresh array each render (would hammer
  // Supabase during an active call). Filtering happens in the memo below.
  useEffect(() => {
    if (!isOpen || !chatId) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('chat_members')
          .select('user_id, users:user_id(*)')
          .eq('chat_id', chatId)
          .is('left_at', null);

        if (cancelled) return;
        if (error || !data) {
          console.error('Failed to load chat members:', error);
          setLoadError(true);
          return;
        }

        const members = (data as unknown as Array<{ user_id: string; users: User }>)
          .map((m) => m.users);
        setAllMembers(members);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load chat members:', err);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, chatId]);

  const availableMembers = useMemo(
    () => allMembers.filter((u) => !currentParticipantIds.includes(u.id)),
    [allMembers, currentParticipantIds]
  );

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>{t('common.cancel')}</IonButton>
          </IonButtons>
          <IonTitle>{t('call.addParticipant')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : loadError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
            <p>{t('errors.generic')}</p>
          </div>
        ) : availableMembers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
            {t('call.maxParticipants')}
          </div>
        ) : (
          <IonList>
            {availableMembers.map((user) => (
              <IonItem
                key={user.id}
                button
                onClick={() => {
                  onSelect(user.id);
                  onClose();
                }}
              >
                <IonAvatar slot="start">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name || ''} loading="lazy" decoding="async" />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      fontWeight: 700,
                    }}>
                      {(user.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </IonAvatar>
                <IonLabel>{user.display_name || t('dashboard.unnamed')}</IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonModal>
  );
};

export default AddParticipantPicker;
