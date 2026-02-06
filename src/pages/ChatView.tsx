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
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonButton,
} from '@ionic/react';
import { send } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { getChat, markChatAsRead, type ChatWithDetails } from '../services/chat';
import {
  getChatMessages,
  sendMessage,
  subscribeToMessages,
  type MessageWithSender,
} from '../services/message';

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

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      contentRef.current?.scrollToBottom(300);
    }, 100);
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

    // Mark as read
    await markChatAsRead(chatId);

    scrollToBottom();
  }, [chatId, history, scrollToBottom]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

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

      // Mark as read if not from self
      if (newMessage.sender_id !== profile?.id) {
        markChatAsRead(chatId);
      }
    });

    return unsubscribe;
  }, [chatId, profile?.id, scrollToBottom]);

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
    });

    if (error) {
      console.error('Failed to send message:', error);
      setMessageText(text); // Restore text on error
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

  const formatMessageTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} className="chat-content" fullscreen>
        {isLoading ? (
          <div className="loading-state">
            <IonSpinner name="crescent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p>{t('chat.startChatting')}</p>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((message, index) => {
              const isOwn = message.sender_id === profile?.id;
              const showDivider = shouldShowDateDivider(message, index);

              return (
                <div key={message.id}>
                  {showDivider && (
                    <div className="date-divider">
                      <span>{formatDateDivider(message.created_at)}</span>
                    </div>
                  )}
                  <div className={`message-wrapper ${isOwn ? 'own' : 'other'}`}>
                    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
                      {!isOwn && !chat?.is_group && (
                        <span className="sender-name">{message.sender?.display_name}</span>
                      )}
                      <p className="message-content">{message.content}</p>
                      <span className="message-time">
                        {formatMessageTime(message.created_at)}
                        {message.is_edited && <span className="edited-tag"> (edited)</span>}
                      </span>
                    </div>
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

          .loading-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
          }

          .empty-state {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
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

          .message-bubble {
            max-width: 75%;
            padding: 0.75rem 1rem;
            border-radius: 1rem;
            position: relative;
          }

          .message-bubble.own {
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border-bottom-right-radius: 0.25rem;
          }

          .message-bubble.other {
            background: hsl(var(--card));
            color: hsl(var(--foreground));
            border: 1px solid hsl(var(--border));
            border-bottom-left-radius: 0.25rem;
          }

          .sender-name {
            display: block;
            font-size: 0.75rem;
            font-weight: 600;
            color: hsl(var(--primary));
            margin-bottom: 0.25rem;
          }

          .message-content {
            margin: 0;
            word-wrap: break-word;
            white-space: pre-wrap;
            line-height: 1.4;
          }

          .message-time {
            display: block;
            font-size: 0.65rem;
            opacity: 0.7;
            margin-top: 0.25rem;
            text-align: right;
          }

          .edited-tag {
            font-style: italic;
          }
        `}</style>
      </IonContent>

      <IonFooter>
        <div className="input-container">
          <textarea
            ref={inputRef}
            className="message-input"
            placeholder={t('chat.typeMessage')}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <IonButton
            className="send-button"
            fill="clear"
            onClick={handleSend}
            disabled={!messageText.trim() || isSending}
          >
            <IonIcon icon={send} />
          </IonButton>
        </div>

        <style>{`
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
    </IonPage>
  );
};

export default ChatView;
