import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon } from '@ionic/react';
import { happyOutline, attachOutline, cameraOutline, send } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import VoiceRecorder from './VoiceRecorder';
import MentionAutocomplete from './MentionAutocomplete';
import type { ChatWithDetails } from '../../services/chat';

interface ChatInputToolbarProps {
  messageText: string;
  onMessageTextChange: (value: string) => void;
  onSend: () => void;
  onVoiceRecord: (blob: Blob, duration: number, mimeType: string) => Promise<void>;
  onCameraCapture: (file: File) => void;
  onToggleEmojiPanel: () => void;
  onToggleAttachmentSheet: () => void;
  isEmojiPanelOpen: boolean;
  isSending: boolean;
  disabled?: boolean;
  placeholder?: string;
  editingMessage: boolean;
  onEditCancel: () => void;
  canSendVoice: boolean;
  chat: ChatWithDetails | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  // Mention state
  mentionQuery: string;
  showMentions: boolean;
  onMentionSelect: (user: { display_name: string | null }) => void;
  onMentionQueryChange: (query: string, show: boolean) => void;
  // Typing indicator
  onTyping: () => void;
  // Image blocked handling
  imageBlocked?: boolean;
  onImageBlocked?: () => void;
}

const ChatInputToolbar: React.FC<ChatInputToolbarProps> = ({
  messageText,
  onMessageTextChange,
  onSend,
  onVoiceRecord,
  onCameraCapture,
  onToggleEmojiPanel,
  onToggleAttachmentSheet,
  isEmojiPanelOpen,
  isSending,
  placeholder,
  editingMessage,
  onEditCancel,
  canSendVoice,
  chat,
  inputRef,
  mentionQuery,
  showMentions,
  onMentionSelect,
  onMentionQueryChange,
  onTyping,
  imageBlocked = false,
  onImageBlocked,
}) => {
  const { t } = useTranslation();
  const textareaContainerRef = useRef<HTMLDivElement>(null);

  // Auto-grow textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 96; // ~6rem
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputRef]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [messageText, adjustTextareaHeight]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    onMessageTextChange(value);

    // Detect @mention
    const cursorPos = e.target.selectionStart || value.length;
    const textUpToCursor = value.slice(0, cursorPos);
    const atMatch = textUpToCursor.match(/@(\w*)$/);

    if (atMatch && chat?.is_group) {
      onMentionQueryChange(atMatch[1], true);
    } else {
      onMentionQueryChange('', false);
    }

    // Typing indicator
    onTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter = newline (no send). Only Escape for edit cancel.
    if (e.key === 'Escape' && editingMessage) {
      onEditCancel();
    }
  };

  const handleCameraClick = async () => {
    if (imageBlocked) {
      onImageBlocked?.();
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          allowEditing: false,
        });

        if (photo.webPath) {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const ext = photo.format || 'jpeg';
          const file = new File([blob], `camera_${Date.now()}.${ext}`, {
            type: `image/${ext}`,
          });
          onCameraCapture(file);
        }
      } else {
        // Web fallback: open file picker with camera preference
        const input = window.document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (ev: Event) => {
          const file = (ev.target as HTMLInputElement).files?.[0];
          if (file) {
            onCameraCapture(file);
          }
        };
        input.click();
      }
    } catch {
      // User cancelled or permission denied
    }
  };

  const hasText = messageText.trim().length > 0;

  return (
    <div className="chat-input-toolbar">
      {/* Smiley / Emoji toggle */}
      <button
        className={`toolbar-icon-btn ${isEmojiPanelOpen ? 'active' : ''}`}
        onClick={onToggleEmojiPanel}
        disabled={isSending}
        aria-label={t('chat.emojis')}
      >
        <IonIcon icon={happyOutline} />
      </button>

      {/* Textarea */}
      <div className="toolbar-textarea-wrapper" ref={textareaContainerRef}>
        {showMentions && chat && (
          <MentionAutocomplete
            query={mentionQuery}
            members={chat.members}
            onSelect={onMentionSelect}
            visible={showMentions}
          />
        )}
        <textarea
          ref={inputRef}
          className="toolbar-input"
          data-testid="message-input"
          placeholder={placeholder || t('chat.typeMessage')}
          value={messageText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
      </div>

      {/* Paperclip / Attach */}
      <button
        className="toolbar-icon-btn"
        onClick={onToggleAttachmentSheet}
        disabled={isSending}
        aria-label="Attach"
      >
        <IonIcon icon={attachOutline} />
      </button>

      {/* Camera */}
      <button
        className="toolbar-icon-btn"
        onClick={handleCameraClick}
        disabled={isSending}
        aria-label={t('chat.camera')}
      >
        <IonIcon icon={cameraOutline} />
      </button>

      {/* Mic / Send toggle */}
      {hasText ? (
        <button
          className="toolbar-send-btn"
          data-testid="send-button"
          onClick={onSend}
          disabled={!hasText || isSending}
          aria-label={t('chat.send')}
        >
          <IonIcon icon={send} />
        </button>
      ) : canSendVoice ? (
        <VoiceRecorder onRecord={onVoiceRecord} disabled={isSending} />
      ) : (
        <div style={{ width: '2.5rem' }} />
      )}

      <style>{`
        .chat-input-toolbar {
          display: flex;
          align-items: flex-end;
          gap: 0.35rem;
          padding: 0.5rem 0.75rem calc(0.5rem + env(safe-area-inset-bottom, 0px));
          background: hsl(var(--background));
          border-top: 1px solid hsl(var(--border));
        }

        .toolbar-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          min-width: 2.25rem;
          border-radius: 50%;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #9CA3AF;
          font-size: 1.35rem;
          transition: color 0.15s;
          flex-shrink: 0;
        }

        .toolbar-icon-btn:hover:not(:disabled) {
          color: hsl(var(--foreground));
        }

        .toolbar-icon-btn.active {
          color: hsl(var(--primary));
        }

        .toolbar-icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toolbar-textarea-wrapper {
          flex: 1;
          position: relative;
          min-width: 0;
        }

        .toolbar-input {
          width: 100%;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 1.25rem;
          padding: 0.5rem 0.85rem;
          color: hsl(var(--foreground));
          font-size: 1rem;
          resize: none;
          min-height: 2.25rem;
          max-height: 96px;
          outline: none;
          font-family: inherit;
          line-height: 1.4;
          overflow-y: hidden;
          box-sizing: border-box;
        }

        .toolbar-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .toolbar-input:focus {
          border-color: hsl(var(--primary));
        }

        .toolbar-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          min-width: 2.5rem;
          border-radius: 50%;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border: none;
          cursor: pointer;
          font-size: 1.2rem;
          transition: opacity 0.15s;
          flex-shrink: 0;
        }

        .toolbar-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toolbar-send-btn:active:not(:disabled) {
          transform: scale(0.93);
        }
      `}</style>
    </div>
  );
};

export default ChatInputToolbar;
