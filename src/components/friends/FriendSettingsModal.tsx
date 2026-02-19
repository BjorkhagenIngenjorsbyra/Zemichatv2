import { useState, useEffect } from 'react';
import { IonAvatar, useIonToast } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { type User, FRIEND_CATEGORIES } from '../../types/database';
import { upsertFriendSettings } from '../../services/friendSettings';

interface FriendSettingsModalProps {
  isOpen: boolean;
  friend: User | null;
  initialNickname?: string;
  initialShowRealName?: boolean;
  initialCategories?: string[];
  onClose: () => void;
  onSaved: (friendUserId: string, nickname: string, showRealName: boolean, categories: string[]) => void;
}

export const FriendSettingsModal: React.FC<FriendSettingsModalProps> = ({
  isOpen,
  friend,
  initialNickname = '',
  initialShowRealName = false,
  initialCategories = [],
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [presentToast] = useIonToast();
  const [nickname, setNickname] = useState(initialNickname);
  const [showRealName, setShowRealName] = useState(initialShowRealName);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNickname(initialNickname);
      setShowRealName(initialShowRealName);
      setCategories(initialCategories);
    }
  }, [isOpen, initialNickname, initialShowRealName, initialCategories]);

  if (!isOpen || !friend) return null;

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await upsertFriendSettings(friend.id, {
      nickname: nickname.trim(),
      categories,
      show_real_name: showRealName,
    });
    setIsSaving(false);

    if (!error) {
      onSaved(friend.id, nickname.trim(), showRealName, categories);
      presentToast({
        message: t('friendSettings.saved'),
        duration: 1500,
        position: 'bottom',
        color: 'success',
      });
      onClose();
    }
  };

  return (
    <div className="fs-backdrop" onClick={onClose}>
      <div className="fs-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header with avatar */}
        <div className="fs-header">
          <IonAvatar className="fs-avatar">
            {friend.avatar_url ? (
              <img src={friend.avatar_url} alt={friend.display_name || ''} />
            ) : (
              <div className="fs-avatar-placeholder">
                {friend.display_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </IonAvatar>
          <h3 className="fs-name">{friend.display_name || t('dashboard.unnamed')}</h3>
        </div>

        {/* Nickname input */}
        <div className="fs-section">
          <label className="fs-label">{t('friendSettings.nickname')}</label>
          <input
            className="fs-input"
            type="text"
            placeholder={t('friendSettings.nicknamePlaceholder')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
          />
        </div>

        {/* Show real name toggle — only when nickname is set */}
        {nickname.trim() && (
          <div className="fs-toggle-row" onClick={() => setShowRealName(!showRealName)}>
            <span className="fs-toggle-label">{t('friendSettings.showRealName')}</span>
            <div className={`fs-toggle ${showRealName ? 'active' : ''}`}>
              <div className="fs-toggle-thumb" />
            </div>
          </div>
        )}

        {/* Category chips */}
        <div className="fs-section">
          <label className="fs-label">{t('friendSettings.categories')}</label>
          <div className="fs-chips">
            {FRIEND_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`fs-chip ${categories.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                {t(`friendSettings.${cat}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          className="fs-save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? t('common.loading') : t('common.save')}
        </button>
      </div>

      <style>{`
        .fs-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: fsFadeIn 0.15s ease-out;
        }

        @keyframes fsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .fs-modal {
          width: 100%;
          max-width: 400px;
          background: hsl(var(--card));
          border-radius: 1.25rem 1.25rem 0 0;
          padding: 1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
          animation: fsSlideUp 0.2s ease-out;
        }

        @keyframes fsSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .fs-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }

        .fs-avatar {
          width: 56px;
          height: 56px;
        }

        .fs-avatar-placeholder {
          width: 100%;
          height: 100%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 700;
          border-radius: 50%;
        }

        .fs-name {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .fs-section {
          margin-bottom: 1rem;
        }

        .fs-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: hsl(var(--foreground) / 0.7);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .fs-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 1rem;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
        }

        .fs-input:focus {
          border-color: hsl(var(--primary));
        }

        .fs-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .fs-chip {
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          border: 1.5px solid hsl(var(--border));
          background: transparent;
          color: hsl(var(--foreground));
          font-size: 0.85rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }

        .fs-chip.active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }

        .fs-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0;
          margin-bottom: 1rem;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .fs-toggle-label {
          font-size: 0.95rem;
          color: hsl(var(--foreground));
        }

        .fs-toggle {
          width: 44px;
          height: 26px;
          border-radius: 13px;
          background: hsl(var(--muted));
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .fs-toggle.active {
          background: hsl(var(--primary));
        }

        .fs-toggle-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .fs-toggle.active .fs-toggle-thumb {
          transform: translateX(18px);
        }

        .fs-save-btn {
          width: 100%;
          padding: 0.85rem;
          margin-top: 0.5rem;
          border: none;
          border-radius: 0.75rem;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .fs-save-btn:disabled {
          opacity: 0.6;
        }

        .fs-save-btn:active:not(:disabled) {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default FriendSettingsModal;
