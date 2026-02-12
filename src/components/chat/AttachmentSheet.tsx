import { useTranslation } from 'react-i18next';
import { IonToast } from '@ionic/react';
import { useState } from 'react';

interface AttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onGallery: () => void;
  onLocation: () => void;
  onDocument: () => void;
  onPoll?: () => void;
}

const AttachmentSheet: React.FC<AttachmentSheetProps> = ({
  isOpen,
  onClose,
  onGallery,
  onLocation,
  onDocument,
  onPoll,
}) => {
  const { t } = useTranslation();
  const [showLocationToast, setShowLocationToast] = useState(false);

  if (!isOpen) return null;

  const handleLocation = () => {
    onLocation();
    setShowLocationToast(true);
    onClose();
  };

  return (
    <>
      <div className="attachment-backdrop" onClick={onClose} />
      <div className="attachment-sheet">
        <div className="attachment-grid">
          <button className="attachment-option" onClick={() => { onGallery(); onClose(); }}>
            <span className="attachment-icon">🖼️</span>
            <span className="attachment-label">{t('chat.gallery')}</span>
          </button>
          <button className="attachment-option" onClick={handleLocation}>
            <span className="attachment-icon">📍</span>
            <span className="attachment-label">{t('chat.location')}</span>
          </button>
          <button className="attachment-option" onClick={() => { onDocument(); onClose(); }}>
            <span className="attachment-icon">📄</span>
            <span className="attachment-label">{t('chat.document')}</span>
          </button>
          {onPoll && (
            <button className="attachment-option" onClick={() => { onPoll(); onClose(); }}>
              <span className="attachment-icon">📊</span>
              <span className="attachment-label">{t('chat.poll')}</span>
            </button>
          )}
        </div>

        <style>{`
          .attachment-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            z-index: 199;
            animation: attachFadeIn 0.15s ease-out;
          }

          @keyframes attachFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .attachment-sheet {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 200;
            background: hsl(var(--card));
            border-top: 1px solid hsl(var(--border));
            border-radius: 1rem 1rem 0 0;
            padding: 1.25rem 1rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
            box-shadow: 0 -4px 20px hsl(0 0% 0% / 0.3);
            animation: attachSlideUp 0.2s ease-out;
          }

          @keyframes attachSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .attachment-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.75rem;
          }

          .attachment-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 0.25rem;
            background: transparent;
            border: none;
            cursor: pointer;
            border-radius: 0.75rem;
            transition: background 0.15s;
          }

          .attachment-option:hover {
            background: hsl(var(--muted) / 0.3);
          }

          .attachment-option:active {
            background: hsl(var(--muted) / 0.5);
            transform: scale(0.95);
          }

          .attachment-icon {
            font-size: 1.75rem;
          }

          .attachment-label {
            font-size: 0.7rem;
            font-weight: 500;
            color: hsl(var(--muted-foreground));
          }
        `}</style>
      </div>

      <IonToast
        isOpen={showLocationToast}
        message={t('chat.locationComingSoon')}
        duration={2000}
        onDidDismiss={() => setShowLocationToast(false)}
        color="medium"
      />
    </>
  );
};

export default AttachmentSheet;
