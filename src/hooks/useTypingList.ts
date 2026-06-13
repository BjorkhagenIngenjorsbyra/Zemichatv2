import { useState, useEffect, useRef } from 'react';
import { subscribeToTyping } from '../services/typingIndicator';

/**
 * Track who is typing in multiple chats simultaneously.
 * Returns a Map of chatId → displayName of typer (first typer only for list preview).
 */
export function useTypingList(chatIds: string[], currentUserId: string) {
  const [typingMap, setTypingMap] = useState<Map<string, string>>(new Map());
  const unsubsRef = useRef<Map<string, () => void>>(new Map());
  const userRef = useRef(currentUserId);
  // Order-insensitive key so a mere reorder of the same chats doesn't churn
  // every typing subscription.
  const key = [...chatIds].sort().join(',');

  useEffect(() => {
    // If the current user changed, drop all subs so they re-subscribe fresh.
    if (userRef.current !== currentUserId) {
      for (const unsub of unsubsRef.current.values()) unsub();
      unsubsRef.current.clear();
      userRef.current = currentUserId;
    }

    const desired = new Set(chatIds);

    // Subscribe only to chats we're not already subscribed to (true incremental
    // diff — the previous version tore everything down on every change via the
    // effect cleanup, making this branch dead code).
    for (const chatId of chatIds) {
      if (unsubsRef.current.has(chatId)) continue;
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
      unsubsRef.current.set(chatId, unsub);
    }

    // Unsubscribe from + prune chats no longer in the list (snapshot the
    // entries so we can delete while iterating).
    for (const [chatId, unsub] of [...unsubsRef.current]) {
      if (!desired.has(chatId)) {
        unsub();
        unsubsRef.current.delete(chatId);
        setTypingMap((prev) => {
          if (!prev.has(chatId)) return prev;
          const next = new Map(prev);
          next.delete(chatId);
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, currentUserId]);

  // Tear down all subscriptions only on unmount — NOT on every dep change.
  useEffect(() => {
    const subs = unsubsRef.current;
    return () => {
      for (const unsub of subs.values()) unsub();
      subs.clear();
    };
  }, []);

  return typingMap;
}
