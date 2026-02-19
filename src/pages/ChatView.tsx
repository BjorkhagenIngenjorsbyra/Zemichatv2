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
import { searchOutline, arrowDown, chevronForwardOutline } from 'ionicons/icons';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAuthContext } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useNotifications } from '../contexts/NotificationContext';
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
  ChatSearchModal,
  EmojiPicker,
  TypingIndicator,
  ChatInputToolbar,
  EmojiGifPanel,
  AttachmentSheet,
} from '../components/chat';
import type { MediaPickerHandle } from '../components/chat';
import {
  MessageContextMenu,
  ForwardPicker,
  PollCreator,
  PollMessage,
} from '../components/chat';
import type { ReadStatus } from '../components/chat/MessageBubble';
import { SOSButton } from '../components/sos';
import { CallButton } from '../components/call';
import { UserRole, type TexterSettings } from '../types/database';
import { getTexterSettings } from '../services/members';
import { usePresence } from '../hooks/usePresence';
import { canShareLocation } from '../services/location';
import LocationPicker from '../components/chat/LocationPicker';
import { MAX_GROUP_CALL_PARTICIPANTS } from '../types/call';

const ChatView: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { chatId } = useParams<{ chatId: string }>();
  const { profile } = useAuthContext();
  const { canUseFeature, showPaywall } = useSubscription();
  const { refreshCounts } = useNotifications();
  const [chat, setChat] = useState<ChatWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaPickerRef = useRef<MediaPickerHandle>(null);

  // Reply state
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);

  // Reactions state
  const [reactions, setReactions] = useState<Map<string, GroupedReaction[]>>(new Map());

  // Search state
  const [showSearch, setShowSearch] = useState(false);

  // Texter call permissions
  const [texterSettings, setTexterSettings] = useState<TexterSettings | null>(null);

  // Auto-scroll + "new messages" button
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
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

  // Emoji/GIF panel + Attachment sheet
  const [showEmojiGifPanel, setShowEmojiGifPanel] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);

  // Poll creator
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Location picker
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Permission denied toast
  const [permissionToast, setPermissionToast] = useState<string | null>(null);

  // Full emoji picker (opened from "+" in reaction bar)
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [fullPickerMessageId, setFullPickerMessageId] = useState<string | null>(null);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  // --- Keyboard handling (native) ---
  // Capacitor Keyboard plugin with resize: 'body' handles viewport resizing.
  // We only scroll to bottom when keyboard opens so the latest messages stay visible.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showListener = Keyboard.addListener('keyboardWillShow', () => {
      setTimeout(() => contentRef.current?.scrollToBottom(200), 100);
    });

    return () => {
      showListener.then((l) => l.remove());
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
    isNearBottomRef.current = nearBottom;

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

  const scrollToBottomRef = useRef(scrollToBottom);
  scrollToBottomRef.current = scrollToBottom;

  const loadReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    const { reactionsByMessage } = await getReactionsForMessages(messageIds);
    setReactions((prev) => {
      const merged = new Map(prev);
      for (const [msgId, grouped] of reactionsByMessage) {
        merged.set(msgId, grouped);
      }
      return merged;
    });
  }, []);

  const loadReactionsRef = useRef(loadReactions);
  loadReactionsRef.current = loadReactions;

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
    refreshCounts();

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

        if (isNearBottomRef.current) {
          scrollToBottomRef.current();
        } else {
          setNewMessageCount((n) => n + 1);
        }

        loadReactionsRef.current([newMessage.id]);

        if (newMessage.sender_id !== profile?.id) {
          if (isNearBottomRef.current) {
            insertReadReceipts([newMessage.id]);
          }
          markChatAsRead(chatId).then(() => refreshCounts());
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
  }, [chatId, profile?.id]);

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

  // Presence for 1-on-1 chats
  const otherUserId = (!chat?.is_group && chat?.members)
    ? chat.members.find((m) => m.user_id !== profile?.id)?.user_id
    : undefined;
  const { isOnline, lastSeenText } = usePresence(otherUserId);

  // Group call: hide call buttons if > MAX_GROUP_CALL_PARTICIPANTS active members
  const activeMemberCount = chat?.members.filter((m) => !m.left_at).length || 0;
  const hideCallForGroupSize = chat?.is_group && activeMemberCount > MAX_GROUP_CALL_PARTICIPANTS;

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

  const handleEmojiInsert = (emoji: string) => {
    const textarea = inputRef.current;
    if (textarea) {
      const start = textarea.selectionStart || messageText.length;
      const end = textarea.selectionEnd || messageText.length;
      const newText = messageText.slice(0, start) + emoji + messageText.slice(end);
      setMessageText(newText);
      // Move cursor after inserted emoji
      setTimeout(() => {
        const newPos = start + emoji.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    } else {
      setMessageText((prev) => prev + emoji);
    }
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

  const handleLocationOpen = async () => {
    if (!chatId) return;
    const canShare = await canShareLocation(chatId);
    if (!canShare) {
      setPermissionToast(t('location.texterRestricted'));
      return;
    }
    setShowLocationPicker(true);
  };

  const handleLocationShare = async (lat: number, lng: number) => {
    if (!chatId) return;
    await sendMessage({
      chatId,
      type: MessageType.LOCATION,
      mediaMetadata: { lat, lng },
      replyToId: replyTo?.id,
    });
    setReplyTo(null);
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
    if (contextMenuTarget) {
      setFullPickerMessageId(contextMenuTarget.id);
      setContextMenuTarget(null);
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
    if (!contextMenuTarget) return;
    hapticLight();

    await toggleReaction(contextMenuTarget.id, emoji);
    loadReactions([contextMenuTarget.id]);
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
    history.push(`/chat/${chatId}/info`);
  };

  const handleCameraCapture = (file: File) => {
    mediaPickerRef.current?.showPreview(file);
  };

  const handleTyping = () => {
    if (chatId && profile?.id && profile?.display_name) {
      sendTyping(chatId, profile.id, profile.display_name);
    }
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
            <div className="chat-header-title">
              <span>{getChatDisplayName()}</span>
              {!chat?.is_group && lastSeenText && (
                <span className={`chat-header-subtitle ${isOnline ? 'online' : ''}`}>
                  {lastSeenText}
                </span>
              )}
            </div>
          </IonTitle>
          <IonButtons slot="end">
            <CallButton chatId={chatId} type="voice" hidden={texterSettings?.can_voice_call === false || !canUseFeature('canVoiceCall') || !!hideCallForGroupSize} />
            <CallButton chatId={chatId} type="video" hidden={texterSettings?.can_video_call === false || !canUseFeature('canVideoCall') || !!hideCallForGroupSize} />
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
          .chat-header-title {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            line-height: 1.2;
          }

          .chat-header-subtitle {
            font-size: 0.7rem;
            font-weight: 400;
            color: hsl(var(--muted-foreground));
          }

          .chat-header-subtitle.online {
            color: hsl(var(--secondary));
          }

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

        <ChatInputToolbar
          messageText={messageText}
          onMessageTextChange={setMessageText}
          onSend={handleSend}
          onVoiceRecord={handleVoiceRecord}
          onCameraCapture={handleCameraCapture}
          onToggleEmojiPanel={() => setShowEmojiGifPanel((prev) => !prev)}
          onToggleAttachmentSheet={() => setShowAttachmentSheet((prev) => !prev)}
          isEmojiPanelOpen={showEmojiGifPanel}
          isSending={isSending}
          placeholder={editingMessage ? t('contextMenu.editPlaceholder') : undefined}
          editingMessage={!!editingMessage}
          onEditCancel={handleEditCancel}
          canSendVoice={canUseFeature('canSendVoice')}
          chat={chat}
          inputRef={inputRef}
          mentionQuery={mentionQuery}
          showMentions={showMentions}
          onMentionSelect={handleMentionSelect}
          onMentionQueryChange={(query, show) => {
            setMentionQuery(query);
            setShowMentions(show);
          }}
          onTyping={handleTyping}
          imageBlocked={
            (profile?.role === UserRole.TEXTER && texterSettings?.can_send_images === false) ||
            !canUseFeature('canSendImages')
          }
          onImageBlocked={() => {
            if (!canUseFeature('canSendImages')) {
              showPaywall(t('paywall.upgradeToUse'));
            } else {
              setPermissionToast(t('permissions.imageNotAllowed'));
            }
          }}
        />

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
        `}</style>
      </IonFooter>

      {/* MediaPicker (hidden inputs + image preview modal) */}
      <MediaPicker
        ref={mediaPickerRef}
        onImageSelect={handleImageSelect}
        onDocumentSelect={handleDocumentSelect}
        imageBlocked={
          (profile?.role === UserRole.TEXTER && texterSettings?.can_send_images === false) ||
          !canUseFeature('canSendImages')
        }
        documentBlocked={
          (profile?.role === UserRole.TEXTER && texterSettings?.can_send_documents === false) ||
          !canUseFeature('canSendDocuments')
        }
        onImageBlocked={() => {
          if (!canUseFeature('canSendImages')) {
            showPaywall(t('paywall.upgradeToUse'));
          } else {
            setPermissionToast(t('permissions.imageNotAllowed'));
          }
        }}
        onDocumentBlocked={() => {
          if (!canUseFeature('canSendDocuments')) {
            showPaywall(t('paywall.upgradeToUse'));
          } else {
            setPermissionToast(t('permissions.documentNotAllowed'));
          }
        }}
      />

      {/* Emoji + GIF tabbed panel */}
      <EmojiGifPanel
        isOpen={showEmojiGifPanel}
        onClose={() => setShowEmojiGifPanel(false)}
        onEmojiInsert={handleEmojiInsert}
        onGifSelect={handleGifSelect}
      />

      {/* Attachment sheet */}
      <AttachmentSheet
        isOpen={showAttachmentSheet}
        onClose={() => setShowAttachmentSheet(false)}
        onGallery={() => mediaPickerRef.current?.openGallery()}
        onLocation={handleLocationOpen}
        onDocument={() => mediaPickerRef.current?.openDocument()}
        onPoll={chat?.is_group ? () => setShowPollCreator(true) : undefined}
      />

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
        onReaction={handleSelectReaction}
        onOpenFullPicker={handleOpenFullEmojiPicker}
      />

      <ForwardPicker
        isOpen={showForwardPicker}
        onClose={() => {
          setShowForwardPicker(false);
          setForwardMessage_(null);
        }}
        onSelectChat={handleForwardToChat}
      />

      <PollCreator
        isOpen={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onCreate={handlePollCreate}
      />

      <LocationPicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onShare={handleLocationShare}
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
