import { useState, useEffect } from 'react';
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
  const [availableMembers, setAvailableMembers] = useState<User[]>([]);

  useEffect(() => {
    if (!isOpen || !chatId) return;

    const fetchMembers = async () => {
      const { data } = await supabase
        .from('chat_members')
        .select('user_id, users:user_id(*)')
        .eq('chat_id', chatId)
        .is('left_at', null);

      if (!data) return;

      const members = (data as unknown as Array<{ user_id: string; users: User }>)
        .map((m) => m.users)
        .filter((u) => !currentParticipantIds.includes(u.id));

      setAvailableMembers(members);
    };

    fetchMembers();
  }, [isOpen, chatId, currentParticipantIds]);

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
        {availableMembers.length === 0 ? (
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
                    <img src={user.avatar_url} alt={user.display_name || ''} />
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
