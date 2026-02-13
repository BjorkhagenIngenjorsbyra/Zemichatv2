import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonTextarea,
  IonSpinner,
} from '@ionic/react';
import { closeOutline, imageOutline, closeCircle } from 'ionicons/icons';
import { useAuthContext } from '../../contexts/AuthContext';
import { UserRole } from '../../types/database';
import { getTexterSettings } from '../../services/members';
import { createWallPost, uploadWallImage } from '../../services/wall';

interface NewPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

const NewPostModal: React.FC<NewPostModalProps> = ({ isOpen, onClose, onPostCreated }) => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canPublish = content.trim().length > 0 || imageFile !== null;

  const handleImagePick = async () => {
    // Check permission for texters
    if (profile?.role === UserRole.TEXTER) {
      const { settings } = await getTexterSettings(profile.id);
      if (!settings?.can_send_images) {
        setImageError(t('wall.imageNotAllowed'));
        return;
      }
    }
    setImageError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const handlePublish = async () => {
    if (!canPublish || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let mediaUrl: string | undefined;
      let mediaMetadata: Record<string, unknown> | undefined;

      if (imageFile) {
        const result = await uploadWallImage(imageFile);
        if (result.error) {
          setIsSubmitting(false);
          return;
        }
        mediaUrl = result.url;
        mediaMetadata = result.metadata as unknown as Record<string, unknown>;
      }

      const { error } = await createWallPost({
        content: content.trim() || undefined,
        mediaUrl,
        mediaMetadata: mediaMetadata as never,
      });

      if (!error) {
        // Reset state
        setContent('');
        removeImage();
        onPostCreated();
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setContent('');
    removeImage();
    setImageError(null);
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>{t('wall.newPost')}</IonTitle>
          <IonButtons slot="end">
            <IonButton
              strong
              disabled={!canPublish || isSubmitting}
              onClick={handlePublish}
            >
              {isSubmitting ? <IonSpinner name="crescent" /> : t('wall.publish')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonTextarea
          placeholder={t('wall.postPlaceholder')}
          value={content}
          onIonInput={(e) => setContent(e.detail.value || '')}
          autoGrow
          rows={4}
          className="post-textarea"
        />

        {imagePreview && (
          <div className="image-preview-container">
            <img src={imagePreview} alt="" className="image-preview" />
            <button className="remove-image-btn" onClick={removeImage}>
              <IonIcon icon={closeCircle} />
            </button>
          </div>
        )}

        {imageError && (
          <p className="image-error">{imageError}</p>
        )}

        <div className="post-actions-row">
          <IonButton fill="clear" size="small" onClick={handleImagePick}>
            <IonIcon icon={imageOutline} slot="start" />
            {t('wall.addImage')}
          </IonButton>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <style>{`
          .post-textarea {
            --background: hsl(var(--card));
            --padding-start: 1rem;
            --padding-end: 1rem;
            --padding-top: 0.75rem;
            --padding-bottom: 0.75rem;
            border-radius: 0.75rem;
            font-size: 1rem;
          }

          .image-preview-container {
            position: relative;
            margin-top: 1rem;
            border-radius: 0.75rem;
            overflow: hidden;
          }

          .image-preview {
            width: 100%;
            max-height: 300px;
            object-fit: cover;
            border-radius: 0.75rem;
          }

          .remove-image-btn {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: rgba(0, 0, 0, 0.5);
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: white;
            font-size: 1.25rem;
          }

          .image-error {
            color: hsl(var(--destructive));
            font-size: 0.85rem;
            margin: 0.5rem 0;
          }

          .post-actions-row {
            display: flex;
            align-items: center;
            margin-top: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};

export default NewPostModal;
