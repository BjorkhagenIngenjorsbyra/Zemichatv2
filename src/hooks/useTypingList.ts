import { useState, useEffect, useRef } from 'react';
import { subscribeToTyping } from '../services/typingIndicator';

/**
 * Track who is typing in multiple chats simultaneously.
 * Returns a Map of chatId → displayName of typer (first typer only for list preview).
 */
export function useTypingList(chatIds: string[], currentUserId: string) {
  const [typingMap, setTypingMap] = useState<Map<string, string>>(new Map());
  const unsubsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const newUnsubs = new Map<string, () => void>();

    for (const chatId of chatIds) {
      // Skip if already subscribed
      if (unsubsRef.current.has(chatId)) {
        newUnsubs.set(chatId, unsubsRef.current.get(chatId)!);
        continue;
      }

      const unsub = subscribeToTyping(chatId, currentUserId, (typers) => {
        setTypingMap((prev) => {
          const next = new Map(prev);
          if (typers.length > 0) {
            next.set(chatId, typers[0].displayName);
          } else {
            next.delete(chatId);
          }
          return next;
        });
      });

      newUnsubs.set(chatId, unsub);
    }

    // Unsubscribe from chats no longer in list
    for (const [chatId, unsub] of unsubsRef.current) {
      if (!newUnsubs.has(chatId)) {
        unsub();
      }
    }

    unsubsRef.current = newUnsubs;

    return () => {
      for (const unsub of unsubsRef.current.values()) {
        unsub();
      }
      unsubsRef.current.clear();
    };
  }, [chatIds.join(','), currentUserId]);

  return typingMap;
}
