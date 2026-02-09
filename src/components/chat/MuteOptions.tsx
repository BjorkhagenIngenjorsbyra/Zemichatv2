import { useTranslation } from 'react-i18next';
import { IonActionSheet } from '@ionic/react';

interface MuteOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (duration: 'hour' | '8hours' | 'week' | 'always') => void;
}

const MuteOptions: React.FC<MuteOptionsProps> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();

  return (
    <IonActionSheet
      isOpen={isOpen}
      onDidDismiss={onClose}
      header={t('muteOptions.title')}
      buttons={[
        {
          text: t('muteOptions.oneHour'),
          handler: () => onSelect('hour'),
        },
        {
          text: t('muteOptions.eightHours'),
          handler: () => onSelect('8hours'),
        },
        {
          text: t('muteOptions.oneWeek'),
          handler: () => onSelect('week'),
        },
        {
          text: t('muteOptions.always'),
          handler: () => onSelect('always'),
        },
        {
          text: t('common.cancel'),
          role: 'cancel',
        },
      ]}
    />
  );
};

export default MuteOptions;
