import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon, useIonToast } from '@ionic/react';
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
  disabled = false,
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
  const [present] = useIonToast();
  const textareaContainerRef = useRef<HTMLDivElement>(null);
  // Issue #35: dedup pointerdown vs synthetic click on the emoji button.
  const emojiHandledByPointerRef = useRef(false);
  // A suspended Texter / Owner-disabled-feature parent passes disabled — gate
  // every interactive control on it (combined with the in-flight send state).
  const controlsDisabled = isSending || disabled;

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

    // Detect @mention. Use Unicode letters/numbers so Swedish names with
    // å/ä/ö (e.g. @Åsa, @Märta) match — \w is ASCII-only (Fable code review).
    const cursorPos = e.target.selectionStart || value.length;
    const textUpToCursor = value.slice(0, cursorPos);
    const atMatch = textUpToCursor.match(/@([\p{L}\p{N}_]*)$/u);

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
    if (controlsDisabled) return;
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
          const ext = (photo.format || 'jpeg').toLowerCase();
          // Normalize to a valid MIME type — 'image/jpg' is non-standard and
          // can fail server-side MIME/content-type validation.
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          const file = new File([blob], `camera_${Date.now()}.${ext}`, {
            type: mime,
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
    } catch (err) {
      // A deliberate cancel throws with a "cancelled" message — stay silent for
      // that, but surface real failures (fetch/blob/permission) that were
      // previously swallowed entirely.
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!msg.includes('cancel')) {
        console.error('Camera capture failed:', err);
        present({ message: t('errors.generic'), duration: 2500, color: 'danger' });
      }
    }
  };

  const hasText = messageText.trim().length > 0;

  return (
    <div className="chat-input-toolbar">
      {/* Smiley / Emoji toggle */}
      {/* Issue #35: on iOS WKWebView the textarea blurs before our click
          lands on the button, swallowing the tap. Earlier we tried
          preventDefault on touchstart — but that ALSO prevents the
          synthetic click iOS emits after touchend, so the panel never
          opened.

          Correct fix: drive the toggle from pointerdown for pointer/touch
          input (fires before blur, so the keyboard collapse cycle never
          gets a chance to swallow the activation), and keep onClick only
          as a fallback for keyboard activation. A ref flag dedupes the
          two paths so a single tap doesn't fire twice. */}
      <button
        type="button"
        className={`toolbar-icon-btn ${isEmojiPanelOpen ? 'active' : ''}`}
        onPointerDown={(e) => {
          if (controlsDisabled) return;
          // Keep textarea focus so iOS doesn't dismiss the keyboard mid-tap.
          e.preventDefault();
          emojiHandledByPointerRef.current = true;
          onToggleEmojiPanel();
        }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          // Pointerdown already handled the tap on touch/mouse — only run
          // for keyboard-activated clicks (Enter/Space).
          if (emojiHandledByPointerRef.current) {
            emojiHandledByPointerRef.current = false;
            return;
          }
          if (controlsDisabled) return;
          onToggleEmojiPanel();
        }}
        disabled={controlsDisabled}
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
          disabled={controlsDisabled}
          rows={1}
        />
      </div>

      {/* Paperclip / Attach */}
      <button
        className="toolbar-icon-btn"
        onClick={onToggleAttachmentSheet}
        disabled={controlsDisabled}
        aria-label={t('a11y.attach')}
      >
        <IonIcon icon={attachOutline} />
      </button>

      {/* Camera */}
      <button
        className="toolbar-icon-btn"
        onClick={handleCameraClick}
        disabled={controlsDisabled}
        aria-label={t('chat.camera')}
      >
        <IonIcon icon={cameraOutline} />
      </button>

      {/* Mic / Send toggle */}
      {hasText ? (
        <button
          className="toolbar-send-btn"
          data-testid="send-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSend}
          disabled={!hasText || controlsDisabled}
          aria-label={t('chat.send')}
        >
          <IonIcon icon={send} />
        </button>
      ) : canSendVoice ? (
        <VoiceRecorder onRecord={onVoiceRecord} disabled={controlsDisabled} />
      ) : (
        <div style={{ width: '2.5rem' }} />
      )}

      <style>{`
        .chat-input-toolbar {
          display: flex;
          align-items: flex-end;
          gap: 0.35rem;
          padding: 0.5rem 0.75rem;
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
