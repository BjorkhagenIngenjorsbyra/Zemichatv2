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
  IonToast,
} from '@ionic/react';
import { send, searchOutline, arrowDown, createOutline, barChartOutline } from 'ionicons/icons';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAuthContext } from '../contexts/AuthContext';
import { getChat, markChatAsRead, type ChatWithDetails } from '../services/chat';
import {
  getChatMessages,
  sendMessage,
  subscribeToMessages,
  editMessage,
  deleteMessageForAll,
  forwardMessage,
  type MessageWithSender,
} from '../services/message';
import {
  toggleReaction,
  getReactionsForMessages,
  type GroupedReaction,
} from '../services/reaction';
import {
  getReadReceiptsForMessages,
  insertReadReceipts,
  subscribeToReadReceipts,
} from '../services/readReceipt';
import {
  sendTyping,
  subscribeToTyping,
  cleanupTypingChannel,
} from '../services/typingIndicator';
import { uploadImage, uploadVoice, uploadDocument } from '../services/storage';
import { createPoll } from '../services/poll';
import { hapticLight } from '../utils/haptics';
import { SkeletonLoader } from '../components/common';
import { MessageType, type Message, type User } from '../types/database';

// Memoized: collect all image URLs for gallery navigation
const getGalleryUrls = (messages: MessageWithSender[]): string[] => {
  return messages
    .filter((m) => m.type === 'image' && m.media_url)
    .map((m) => m.media_url as string);
};
import {
  MessageBubble,
  QuotedMessage,
  MediaPicker,
  VoiceRecorder,
  QuickMessageBar,
  ChatSearchModal,
  InlineReactionBar,
  EmojiPicker,
  TypingIndicator,
} from '../components/chat';
import {
  MessageContextMenu,
  ForwardPicker,
  GifPicker,
  StickerPicker,
  MentionAutocomplete,
  PollCreator,
  PollMessage,
} from '../components/chat';
import type { ReadStatus } from '../components/chat/MessageBubble';
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
  const [reactionBarTarget, setReactionBarTarget] = useState<{
    message: MessageWithSender;
    rect: DOMRect;
    isOwn: boolean;
  } | null>(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);

  // Texter call permissions
  const [texterSettings, setTexterSettings] = useState<TexterSettings | null>(null);

  // Keyboard height (native only)
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Auto-scroll + "new messages" button
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  // Send animation
  const [lastSentId, setLastSentId] = useState<string | null>(null);

  // Read receipts
  const [readReceipts, setReadReceipts] = useState<Map<string, string[]>>(new Map());
  const [chatMemberCount, setChatMemberCount] = useState(0);

  // Typing indicator
  const [typers, setTypers] = useState<{ userId: string; displayName: string }[]>([]);

  // Context menu state
  const [contextMenuTarget, setContextMenuTarget] = useState<MessageWithSender | null>(null);

  // Edit mode state
  const [editingMessage, setEditingMessage] = useState<MessageWithSender | null>(null);

  // Forward state
  const [forwardMessage_, setForwardMessage_] = useState<MessageWithSender | null>(null);
  const [showForwardPicker, setShowForwardPicker] = useState(false);

  // GIF & Sticker pickers
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // Poll creator
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Permission denied toast
  const [permissionToast, setPermissionToast] = useState<string | null>(null);

  // Full emoji picker (opened from "+" in reaction bar)
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [fullPickerMessageId, setFullPickerMessageId] = useState<string | null>(null);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  // --- Keyboard handling (native) ---
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight);
      setTimeout(() => contentRef.current?.scrollToBottom(200), 100);
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.then((l) => l.remove());
      hideListener.then((l) => l.remove());
    };
  }, []);

  // --- Scroll detection ---
  const handleScroll = useCallback(async () => {
    const el = contentRef.current;
    if (!el) return;

    const scrollEl = await el.getScrollElement();
    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 200;
    setIsNearBottom(nearBottom);

    if (nearBottom) {
      setNewMessageCount(0);
    }
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    el.addEventListener('ionScroll', handleScroll);
    return () => {
      el.removeEventListener('ionScroll', handleScroll);
    };
  }, [handleScroll]);

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

  const loadReadReceipts = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    const { receipts } = await getReadReceiptsForMessages(messageIds);
    setReadReceipts((prev) => {
      const merged = new Map(prev);
      for (const [msgId, users] of receipts) {
        merged.set(msgId, users);
      }
      return merged;
    });
  }, []);

  const loadChat = useCallback(async () => {
    if (!chatId) return;

    const { chat: chatData } = await getChat(chatId);
    if (!chatData) {
      history.replace('/chats');
      return;
    }

    setChat(chatData);
    setChatMemberCount(chatData.members.length);

    const { messages: chatMessages } = await getChatMessages(chatId);
    setMessages(chatMessages);
    setIsLoading(false);

    // Load reactions + read receipts for all messages
    const messageIds = chatMessages.map((m) => m.id);
    loadReactions(messageIds);
    loadReadReceipts(messageIds);

    // Mark as read
    await markChatAsRead(chatId);

    // Mark visible messages as read
    const otherMessages = chatMessages
      .filter((m) => m.sender_id !== profile?.id)
      .map((m) => m.id);
    if (otherMessages.length > 0) {
      insertReadReceipts(otherMessages);
    }

    scrollToBottom();
  }, [chatId, history, scrollToBottom, loadReactions, loadReadReceipts, profile?.id]);

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

    const unsubscribe = subscribeToMessages(
      chatId,
      (newMessage) => {
        // Avoid duplicates
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });

        if (isNearBottom) {
          scrollToBottom();
        } else {
          setNewMessageCount((n) => n + 1);
        }

        loadReactions([newMessage.id]);

        if (newMessage.sender_id !== profile?.id) {
          if (isNearBottom) {
            insertReadReceipts([newMessage.id]);
          }
          markChatAsRead(chatId);
        }
      },
      // Handle message updates (edit, delete-for-all)
      (updatedMessage) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
        );
      }
    );

    return unsubscribe;
  }, [chatId, profile?.id, scrollToBottom, loadReactions, isNearBottom]);

  // Subscribe to read receipts
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = subscribeToReadReceipts(chatId, (receipt) => {
      setReadReceipts((prev) => {
        const merged = new Map(prev);
        const existing = merged.get(receipt.messageId) || [];
        if (!existing.includes(receipt.userId)) {
          merged.set(receipt.messageId, [...existing, receipt.userId]);
        }
        return merged;
      });
    });

    return unsubscribe;
  }, [chatId]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!chatId || !profile?.id) return;

    const unsubscribe = subscribeToTyping(chatId, profile.id, setTypers);

    return () => {
      unsubscribe();
      cleanupTypingChannel(chatId);
    };
  }, [chatId, profile?.id]);

  const getChatDisplayName = (): string => {
    if (!chat) return '';
    if (chat.name) return chat.name;

    if (!chat.is_group && chat.members.length > 0) {
      const otherMember = chat.members.find((m) => m.user_id !== profile?.id);
      return otherMember?.user?.display_name || t('dashboard.unnamed');
    }

    return t('chat.newChat');
  };

  const handleSend = async () => {
    if (!messageText.trim() || isSending || !chatId) return;

    // If editing, save edit instead
    if (editingMessage) {
      await handleEditSave();
      return;
    }

    setIsSending(true);
    const text = messageText.trim();
    setMessageText('');

    const { message, error } = await sendMessage({
      chatId,
      content: text,
      replyToId: replyTo?.id,
    });

    if (error) {
      console.error('Failed to send message:', error);
      setMessageText(text);
    } else {
      setReplyTo(null);
      hapticLight();
      if (message) {
        setLastSentId(message.id);
        setTimeout(() => setLastSentId(null), 400);
      }
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape' && editingMessage) {
      handleEditCancel();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageText(value);

    // Detect @mention
    const cursorPos = e.target.selectionStart || value.length;
    const textUpToCursor = value.slice(0, cursorPos);
    const atMatch = textUpToCursor.match(/@(\w*)$/);

    if (atMatch && chat?.is_group) {
      setMentionQuery(atMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }

    // Send typing indicator
    if (chatId && profile?.id && profile?.display_name) {
      sendTyping(chatId, profile.id, profile.display_name);
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

  const handleOpenReactionBar = (message: MessageWithSender, rect: DOMRect) => {
    const isOwn = message.sender_id === profile?.id;
    setReactionBarTarget({ message, rect, isOwn });
  };

  const handleContextMenu = (message: MessageWithSender, _rect: DOMRect) => {
    setContextMenuTarget(message);
  };

  const handleContextMenuClose = () => {
    setContextMenuTarget(null);
  };

  const handleCopy = async () => {
    if (!contextMenuTarget?.content) return;
    try {
      await navigator.clipboard.writeText(contextMenuTarget.content);
    } catch {
      // Clipboard API not available
    }
    setContextMenuTarget(null);
  };

  const handleEditStart = () => {
    if (!contextMenuTarget) return;
    setEditingMessage(contextMenuTarget);
    setMessageText(contextMenuTarget.content || '');
    setContextMenuTarget(null);
    inputRef.current?.focus();
  };

  const handleEditSave = async () => {
    if (!editingMessage || !messageText.trim()) return;
    setIsSending(true);
    await editMessage(editingMessage.id, messageText.trim());
    setEditingMessage(null);
    setMessageText('');
    setIsSending(false);
  };

  const handleEditCancel = () => {
    setEditingMessage(null);
    setMessageText('');
  };

  const handleDeleteForAll = async () => {
    if (!contextMenuTarget) return;
    await deleteMessageForAll(contextMenuTarget.id);
    setContextMenuTarget(null);
  };

  const handleForwardStart = () => {
    if (!contextMenuTarget) return;
    setForwardMessage_(contextMenuTarget);
    setShowForwardPicker(true);
    setContextMenuTarget(null);
  };

  const handleForwardToChat = async (targetChatId: string) => {
    if (!forwardMessage_) return;
    await forwardMessage(
      {
        content: forwardMessage_.content,
        type: forwardMessage_.type,
        media_url: forwardMessage_.media_url,
        media_metadata: forwardMessage_.media_metadata,
        id: forwardMessage_.id,
      },
      targetChatId
    );
    setForwardMessage_(null);
    setShowForwardPicker(false);
  };

  const handleGifSelect = async (gifUrl: string, width: number, height: number) => {
    if (!chatId) return;
    await sendMessage({
      chatId,
      type: MessageType.GIF,
      mediaUrl: gifUrl,
      mediaMetadata: { width, height },
    });
  };

  const handleStickerSelect = async (emoji: string) => {
    if (!chatId) return;
    await sendMessage({
      chatId,
      content: emoji,
      type: MessageType.STICKER,
    });
  };

  const handlePollCreate = async (question: string, options: string[], allowsMultiple: boolean) => {
    if (!chatId) return;

    // First send a poll message
    const { message: pollMsg } = await sendMessage({
      chatId,
      content: question,
      type: MessageType.POLL,
    });

    if (pollMsg) {
      await createPoll({
        chatId,
        messageId: pollMsg.id,
        question,
        options,
        allowsMultiple,
      });
    }
  };

  const handleMentionSelect = (user: { display_name: string | null }) => {
    const name = user.display_name || '';
    // Replace the @query with @name
    const cursorPos = inputRef.current?.selectionStart || messageText.length;
    const textUpToCursor = messageText.slice(0, cursorPos);
    const rest = messageText.slice(cursorPos);
    const newText = textUpToCursor.replace(/@\w*$/, `@${name} `) + rest;
    setMessageText(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleOpenFullEmojiPicker = () => {
    if (reactionBarTarget) {
      setFullPickerMessageId(reactionBarTarget.message.id);
      setReactionBarTarget(null);
      setShowFullEmojiPicker(true);
    }
  };

  const handleFullPickerSelect = async (emoji: string) => {
    if (!fullPickerMessageId) return;
    hapticLight();
    await toggleReaction(fullPickerMessageId, emoji);
    loadReactions([fullPickerMessageId]);
    setShowFullEmojiPicker(false);
    setFullPickerMessageId(null);
  };

  const handleSelectReaction = async (emoji: string) => {
    if (!reactionBarTarget) return;
    hapticLight();

    await toggleReaction(reactionBarTarget.message.id, emoji);
    loadReactions([reactionBarTarget.message.id]);
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    await toggleReaction(messageId, emoji);
    loadReactions([messageId]);
  };

  const getReadStatus = (message: MessageWithSender): ReadStatus | undefined => {
    if (message.sender_id !== profile?.id) return undefined;

    const receipts = readReceipts.get(message.id) || [];
    const otherMembers = chatMemberCount - 1; // Exclude self

    if (otherMembers <= 0) return 'sent';

    const readByOthers = receipts.filter((uid) => uid !== profile?.id).length;

    if (readByOthers >= otherMembers) return 'read';
    if (readByOthers > 0) return 'delivered';
    return 'sent';
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

  const handleScrollToBottom = () => {
    scrollToBottom();
    setNewMessageCount(0);
  };

  const handleHeaderClick = () => {
    contentRef.current?.scrollToTop(300);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/chats" />
          </IonButtons>
          <IonTitle
            onClick={handleHeaderClick}
            style={{ cursor: 'pointer' }}
          >
            {getChatDisplayName()}
          </IonTitle>
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

      <IonContent
        ref={contentRef}
        className="chat-content"
        fullscreen
        scrollEvents
        onIonScroll={handleScroll}
        style={keyboardHeight > 0 ? { '--keyboard-offset': `${keyboardHeight}px` } as React.CSSProperties : undefined}
      >
        {isLoading ? (
          <SkeletonLoader variant="messages" />
        ) : messages.length === 0 ? (
          <div className="welcome-banner">
            <div className="welcome-icon">👋</div>
            <h3>{t('chat.welcomeTitle')}</h3>
            <p>{t('chat.welcomeMessage')}</p>
          </div>
        ) : (
          <div
            className="messages-container"
            data-testid="messages-container"
            style={keyboardHeight > 0 ? { paddingBottom: `${keyboardHeight}px` } : undefined}
          >
            {(() => {
              const galleryUrls = getGalleryUrls(messages);
              return messages.map((message, index) => {
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
                  <div className={`message-wrapper ${isOwn ? 'own' : 'other'}`} data-testid={`message-${message.id}`}>
                    <MessageBubble
                      message={message}
                      isOwn={isOwn}
                      reactions={messageReactions}
                      showSenderName={chat?.is_group && !isOwn}
                      readStatus={getReadStatus(message)}
                      isJustSent={message.id === lastSentId}
                      galleryUrls={galleryUrls}
                      onReply={() => handleReply(message)}
                      onReact={(msg, rect) => handleOpenReactionBar(msg, rect)}
                      onContextMenu={(msg, rect) => handleContextMenu(msg, rect)}
                      userId={profile?.id}
                      userRole={profile?.role}
                      onToggleReaction={handleToggleReaction}
                    />
                  </div>
                </div>
              );
            });
            })()}

            {/* Typing indicator */}
            <TypingIndicator typers={typers} isGroup={chat?.is_group} />
          </div>
        )}

        {/* "New messages" floating button */}
        {newMessageCount > 0 && (
          <div className="new-messages-button" onClick={handleScrollToBottom}>
            <IonIcon icon={arrowDown} />
            <span>
              {newMessageCount} {t('chat.newMessages')}
            </span>
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
            position: sticky;
            top: 0;
            z-index: 10;
          }

          .date-divider span {
            background: hsl(var(--muted) / 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: hsl(var(--foreground));
            font-size: 0.75rem;
            font-weight: 500;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            box-shadow: 0 1px 4px hsl(0 0% 0% / 0.15);
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

          .new-messages-button {
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.5rem 1rem;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 16px hsl(var(--primary) / 0.4);
            z-index: 100;
            animation: fade-slide-in 0.2s ease-out;
          }

          .new-messages-button ion-icon {
            font-size: 0.9rem;
          }
        `}</style>
      </IonContent>

      <IonFooter>
        <QuickMessageBar
          onSend={handleQuickMessage}
          disabled={isSending}
        />

        {editingMessage && (
          <div className="edit-preview">
            <div className="edit-preview-content">
              <span className="edit-label">{t('contextMenu.editing')}</span>
              <span className="edit-text">{editingMessage.content?.slice(0, 50)}</span>
            </div>
            <button className="cancel-reply" onClick={handleEditCancel} aria-label="Cancel edit">
              ×
            </button>
          </div>
        )}

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
            imageBlocked={profile?.role === UserRole.TEXTER && texterSettings?.can_send_images === false}
            documentBlocked={profile?.role === UserRole.TEXTER && texterSettings?.can_send_documents === false}
            onImageBlocked={() => setPermissionToast(t('permissions.imageNotAllowed'))}
            onDocumentBlocked={() => setPermissionToast(t('permissions.documentNotAllowed'))}
          />

          <button
            className="extra-btn"
            onClick={() => setShowGifPicker(!showGifPicker)}
            disabled={isSending}
            aria-label="GIF"
          >
            GIF
          </button>

          <button
            className="extra-btn"
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            disabled={isSending}
            aria-label="Sticker"
          >
            😀
          </button>

          {chat?.is_group && (
            <button
              className="extra-btn"
              onClick={() => setShowPollCreator(true)}
              disabled={isSending}
              aria-label="Poll"
            >
              <IonIcon icon={barChartOutline} />
            </button>
          )}

          <div className="textarea-wrapper">
            {showMentions && chat && (
              <MentionAutocomplete
                query={mentionQuery}
                members={chat.members}
                onSelect={handleMentionSelect}
                visible={showMentions}
              />
            )}
            <textarea
              ref={inputRef}
              className="message-input"
              data-testid="message-input"
              placeholder={editingMessage ? t('contextMenu.editPlaceholder') : t('chat.typeMessage')}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
          </div>

          {messageText.trim() ? (
            <IonButton
              className="send-button"
              fill="clear"
              data-testid="send-button"
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
            padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
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

          .edit-preview {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: hsl(var(--primary) / 0.1);
            border-top: 1px solid hsl(var(--primary) / 0.3);
            border-left: 3px solid hsl(var(--primary));
          }

          .edit-preview-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
          }

          .edit-label {
            font-size: 0.7rem;
            font-weight: 600;
            color: hsl(var(--primary));
            text-transform: uppercase;
          }

          .edit-text {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .extra-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 2rem;
            height: 2rem;
            border-radius: 50%;
            background: transparent;
            border: none;
            cursor: pointer;
            color: hsl(var(--muted-foreground));
            font-size: 0.75rem;
            font-weight: 700;
            transition: color 0.15s;
          }

          .extra-btn:hover:not(:disabled) {
            color: hsl(var(--primary));
          }

          .extra-btn:disabled {
            opacity: 0.5;
          }

          .extra-btn ion-icon {
            font-size: 1.1rem;
          }

          .textarea-wrapper {
            flex: 1;
            position: relative;
          }
        `}</style>
      </IonFooter>

      {/* Inline reaction bar with "+" for full picker */}
      {reactionBarTarget && (
        <InlineReactionBar
          targetRect={{
            top: reactionBarTarget.rect.top,
            left: reactionBarTarget.rect.left,
            width: reactionBarTarget.rect.width,
            bottom: reactionBarTarget.rect.bottom,
          }}
          isOwn={reactionBarTarget.isOwn}
          onSelect={handleSelectReaction}
          onOpenFullPicker={handleOpenFullEmojiPicker}
          onClose={() => setReactionBarTarget(null)}
        />
      )}

      {/* Full emoji picker (from "+" button) */}
      {showFullEmojiPicker && (
        <EmojiPicker
          onSelect={handleFullPickerSelect}
          onClose={() => {
            setShowFullEmojiPicker(false);
            setFullPickerMessageId(null);
          }}
        />
      )}

      <ChatSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        chatId={chatId}
      />

      <MessageContextMenu
        isOpen={!!contextMenuTarget}
        message={contextMenuTarget}
        isOwn={contextMenuTarget?.sender_id === profile?.id}
        userId={profile?.id || ''}
        onClose={handleContextMenuClose}
        onReply={() => {
          if (contextMenuTarget) handleReply(contextMenuTarget);
          setContextMenuTarget(null);
        }}
        onEdit={handleEditStart}
        onCopy={handleCopy}
        onForward={handleForwardStart}
        onDeleteForAll={handleDeleteForAll}
      />

      <ForwardPicker
        isOpen={showForwardPicker}
        onClose={() => {
          setShowForwardPicker(false);
          setForwardMessage_(null);
        }}
        onSelectChat={handleForwardToChat}
      />

      <GifPicker
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
      />

      <StickerPicker
        isOpen={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelect={handleStickerSelect}
      />

      <PollCreator
        isOpen={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onCreate={handlePollCreate}
      />

      <IonToast
        isOpen={!!permissionToast}
        message={permissionToast || ''}
        duration={3000}
        onDidDismiss={() => setPermissionToast(null)}
        color="warning"
        data-testid="permission-toast"
      />
    </IonPage>
  );
};

export default ChatView;
