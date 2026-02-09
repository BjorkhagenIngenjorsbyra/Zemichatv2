import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonFooter,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonButton,
} from '@ionic/react';
import { send, searchOutline } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { getChat, markChatAsRead, type ChatWithDetails } from '../services/chat';
import {
  getChatMessages,
  sendMessage,
  subscribeToMessages,
  type MessageWithSender,
} from '../services/message';
import {
  toggleReaction,
  getReactionsForMessages,
  type GroupedReaction,
} from '../services/reaction';
import { uploadImage, uploadVoice, uploadDocument } from '../services/storage';
import { hapticLight } from '../utils/haptics';
import { SkeletonLoader } from '../components/common';
import { MessageType, type Message, type User } from '../types/database';
import {
  MessageBubble,
  QuotedMessage,
  EmojiPicker,
  MediaPicker,
  VoiceRecorder,
  QuickMessageBar,
  ChatSearchModal,
} from '../components/chat';
import { SOSButton } from '../components/sos';
import { CallButton } from '../components/call';
import { UserRole, type TexterSettings } from '../types/database';
import { getTexterSettings } from '../services/members';

const ChatView: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { chatId } = useParams<{ chatId: string }>();
  const { profile } = useAuthContext();
  const [chat, setChat] = useState<ChatWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reply state
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);

  // Reactions state
  const [reactions, setReactions] = useState<Map<string, GroupedReaction[]>>(new Map());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<MessageWithSender | null>(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);

  // Texter call permissions
  const [texterSettings, setTexterSettings] = useState<TexterSettings | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      contentRef.current?.scrollToBottom(300);
    }, 100);
  }, []);

  const loadReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    const { reactionsByMessage } = await getReactionsForMessages(messageIds);
    setReactions(reactionsByMessage);
  }, []);

  const loadChat = useCallback(async () => {
    if (!chatId) return;

    const { chat: chatData } = await getChat(chatId);
    if (!chatData) {
      history.replace('/chats');
      return;
    }

    setChat(chatData);

    const { messages: chatMessages } = await getChatMessages(chatId);
    setMessages(chatMessages);
    setIsLoading(false);

    // Load reactions for all messages
    const messageIds = chatMessages.map((m) => m.id);
    loadReactions(messageIds);

    // Mark as read
    await markChatAsRead(chatId);

    scrollToBottom();
  }, [chatId, history, scrollToBottom, loadReactions]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Fetch texter settings to determine call button visibility
  useEffect(() => {
    if (profile?.role === UserRole.TEXTER) {
      getTexterSettings(profile.id).then(({ settings }) => {
        setTexterSettings(settings);
      });
    }
  }, [profile]);

  // Subscribe to new messages
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = subscribeToMessages(chatId, (newMessage) => {
      // Avoid duplicates
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
      scrollToBottom();

      // Load reactions for new message
      loadReactions([newMessage.id]);

      // Mark as read if not from self
      if (newMessage.sender_id !== profile?.id) {
        markChatAsRead(chatId);
      }
    });

    return unsubscribe;
  }, [chatId, profile?.id, scrollToBottom, loadReactions]);

  const getChatDisplayName = (): string => {
    if (!chat) return '';
    if (chat.name) return chat.name;

    // For 1-on-1 chats, show the other person's name
    if (!chat.is_group && chat.members.length > 0) {
      const otherMember = chat.members.find((m) => m.user_id !== profile?.id);
      return otherMember?.user?.display_name || t('dashboard.unnamed');
    }

    return t('chat.newChat');
  };

  const handleSend = async () => {
    if (!messageText.trim() || isSending || !chatId) return;

    setIsSending(true);
    const text = messageText.trim();
    setMessageText('');

    const { error } = await sendMessage({
      chatId,
      content: text,
      replyToId: replyTo?.id,
    });

    if (error) {
      console.error('Failed to send message:', error);
      setMessageText(text); // Restore text on error
    } else {
      setReplyTo(null);
      hapticLight();
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = async (file: File, caption?: string) => {
    if (!chatId) return;

    const result = await uploadImage(file, chatId);
    if (result.error || !result.url) {
      console.error('Failed to upload image:', result.error);
      return;
    }

    await sendMessage({
      chatId,
      content: caption,
      type: MessageType.IMAGE,
      mediaUrl: result.url,
      mediaMetadata: result.metadata as unknown as Record<string, unknown> | undefined,
      replyToId: replyTo?.id,
    });

    setReplyTo(null);
  };

  const handleDocumentSelect = async (file: File) => {
    if (!chatId) return;

    const result = await uploadDocument(file, chatId);
    if (result.error || !result.url) {
      console.error('Failed to upload document:', result.error);
      return;
    }

    await sendMessage({
      chatId,
      type: MessageType.DOCUMENT,
      mediaUrl: result.url,
      mediaMetadata: result.metadata as unknown as Record<string, unknown> | undefined,
      replyToId: replyTo?.id,
    });

    setReplyTo(null);
  };

  const handleVoiceRecord = async (blob: Blob, duration: number, mimeType: string) => {
    if (!chatId) return;

    const result = await uploadVoice(blob, chatId, duration, mimeType);
    if (result.error || !result.url) {
      console.error('Failed to upload voice message:', result.error);
      return;
    }

    await sendMessage({
      chatId,
      type: MessageType.VOICE,
      mediaUrl: result.url,
      mediaMetadata: result.metadata as unknown as Record<string, unknown> | undefined,
      replyToId: replyTo?.id,
    });

    setReplyTo(null);
  };

  const handleReply = (message: MessageWithSender) => {
    setReplyTo(message);
    inputRef.current?.focus();
  };

  const handleQuickMessage = async (content: string) => {
    if (!chatId || isSending) return;

    setIsSending(true);

    const { error } = await sendMessage({
      chatId,
      content,
    });

    if (error) {
      console.error('Failed to send quick message:', error);
    }

    setIsSending(false);
  };

  const handleOpenEmojiPicker = (message: MessageWithSender) => {
    setEmojiPickerTarget(message);
    setShowEmojiPicker(true);
  };

  const handleSelectReaction = async (emoji: string) => {
    if (!emojiPickerTarget) return;
    hapticLight();

    await toggleReaction(emojiPickerTarget.id, emoji);

    // Refresh reactions
    loadReactions([emojiPickerTarget.id]);
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    await toggleReaction(messageId, emoji);
    loadReactions([messageId]);
  };

  const formatDateDivider = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('common.today') || 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('common.yesterday') || 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  const shouldShowDateDivider = (message: MessageWithSender, index: number): boolean => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    const prevDate = new Date(prevMessage.created_at).toDateString();
    const currDate = new Date(message.created_at).toDateString();
    return prevDate !== currDate;
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/chats" />
          </IonButtons>
          <IonTitle>{getChatDisplayName()}</IonTitle>
          <IonButtons slot="end">
            <CallButton chatId={chatId} type="voice" hidden={texterSettings?.can_voice_call === false} />
            <CallButton chatId={chatId} type="video" hidden={texterSettings?.can_video_call === false} />
            <IonButton onClick={() => setShowSearch(true)}>
              <IonIcon icon={searchOutline} />
            </IonButton>
            {profile?.role === UserRole.TEXTER && <SOSButton size="small" />}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} className="chat-content" fullscreen>
        {isLoading ? (
          <SkeletonLoader variant="messages" />
        ) : messages.length === 0 ? (
          <div className="welcome-banner">
            <div className="welcome-icon">👋</div>
            <h3>{t('chat.welcomeTitle')}</h3>
            <p>{t('chat.welcomeMessage')}</p>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((message, index) => {
              const isOwn = message.sender_id === profile?.id;
              const showDivider = shouldShowDateDivider(message, index);
              const messageReactions = reactions.get(message.id) || [];

              return (
                <div key={message.id}>
                  {showDivider && (
                    <div className="date-divider">
                      <span>{formatDateDivider(message.created_at)}</span>
                    </div>
                  )}
                  <div className={`message-wrapper ${isOwn ? 'own' : 'other'}`}>
                    <MessageBubble
                      message={message}
                      isOwn={isOwn}
                      reactions={messageReactions}
                      showSenderName={chat?.is_group && !isOwn}
                      onReply={() => handleReply(message)}
                      onReact={() => handleOpenEmojiPicker(message)}
                      onToggleReaction={handleToggleReaction}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <style>{`
          .chat-content {
            --background: hsl(var(--background));
          }

          .welcome-banner {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            height: 100%;
            padding: 2rem;
            animation: fade-slide-in 0.4s ease-out both;
          }

          .welcome-icon {
            font-size: 3rem;
            margin-bottom: 0.75rem;
          }

          .welcome-banner h3 {
            margin: 0 0 0.5rem 0;
            font-size: 1.25rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .welcome-banner p {
            margin: 0;
            font-size: 0.95rem;
            color: hsl(var(--muted-foreground));
          }

          .messages-container {
            display: flex;
            flex-direction: column;
            padding: 1rem;
            min-height: 100%;
          }

          .date-divider {
            display: flex;
            justify-content: center;
            margin: 1rem 0;
          }

          .date-divider span {
            background: hsl(var(--muted) / 0.3);
            color: hsl(var(--muted-foreground));
            font-size: 0.75rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
          }

          .message-wrapper {
            display: flex;
            margin-bottom: 0.5rem;
          }

          .message-wrapper.own {
            justify-content: flex-end;
          }

          .message-wrapper.other {
            justify-content: flex-start;
          }
        `}</style>
      </IonContent>

      <IonFooter>
        <QuickMessageBar
          onSend={handleQuickMessage}
          disabled={isSending}
        />

        {replyTo && (
          <div className="reply-preview">
            <QuotedMessage
              message={replyTo as Message & { sender?: User }}
              isOwn={false}
              onClick={() => {}}
            />
            <button
              className="cancel-reply"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
            >
              ×
            </button>
          </div>
        )}

        <div className="input-container">
          <MediaPicker
            onImageSelect={handleImageSelect}
            onDocumentSelect={handleDocumentSelect}
            disabled={isSending}
          />

          <textarea
            ref={inputRef}
            className="message-input"
            placeholder={t('chat.typeMessage')}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          {messageText.trim() ? (
            <IonButton
              className="send-button"
              fill="clear"
              onClick={handleSend}
              disabled={!messageText.trim() || isSending}
            >
              <IonIcon icon={send} />
            </IonButton>
          ) : (
            <VoiceRecorder
              onRecord={handleVoiceRecord}
              disabled={isSending}
            />
          )}
        </div>

        <style>{`
          .reply-preview {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: hsl(var(--card));
            border-top: 1px solid hsl(var(--border));
          }

          .reply-preview > div {
            flex: 1;
            margin: 0;
          }

          .cancel-reply {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 50%;
            background: hsl(var(--muted) / 0.3);
            border: none;
            cursor: pointer;
            font-size: 1.25rem;
            color: hsl(var(--foreground));
            line-height: 1;
          }

          .input-container {
            display: flex;
            align-items: flex-end;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            background: hsl(var(--background));
            border-top: 1px solid hsl(var(--border));
          }

          .message-input {
            flex: 1;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1.25rem;
            padding: 0.75rem 1rem;
            color: hsl(var(--foreground));
            font-size: 1rem;
            resize: none;
            min-height: 2.5rem;
            max-height: 120px;
            outline: none;
            font-family: inherit;
          }

          .message-input::placeholder {
            color: hsl(var(--muted-foreground));
          }

          .message-input:focus {
            border-color: hsl(var(--primary));
          }

          .send-button {
            --color: hsl(var(--primary));
            --padding-start: 0.5rem;
            --padding-end: 0.5rem;
            min-height: 2.5rem;
          }

          .send-button:disabled {
            --color: hsl(var(--muted));
          }
        `}</style>
      </IonFooter>

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleSelectReaction}
          onClose={() => {
            setShowEmojiPicker(false);
            setEmojiPickerTarget(null);
          }}
        />
      )}

      <ChatSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        chatId={chatId}
      />
    </IonPage>
  );
};

export default ChatView;
