import { useCallback, useEffect } from 'react';
import { db } from './db';
import { chatTitle, readOpenChat, refreshChatList } from './friends';

type IncomingMessage = { chat_id: string; sender_id: string | null; body: string };

async function showMessageNotification(userId: string, message: IncomingMessage) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  // The chat list tells us what to call the chat. A brand-new chat isn't in it yet: reload it first.
  let chat = await db.friendChats.get(message.chat_id);
  if (!chat) {
    await refreshChatList(userId);
    chat = await db.friendChats.get(message.chat_id);
  }

  const title = chat ? chatTitle(chat) : 'New message';
  let body = message.body.length > 120 ? `${message.body.slice(0, 120)}…` : message.body;

  // In a group, say who wrote it (the name is saved with their earlier messages).
  if (chat?.kind === 'group' && message.sender_id) {
    const known = await db.friendMessages
      .where('chatId')
      .equals(message.chat_id)
      .filter((m) => m.senderId === message.sender_id && !!m.senderName)
      .last();
    if (known?.senderName) body = `${known.senderName}: ${body}`;
  }

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // One notification per chat: a newer message replaces the older one but still alerts.
    tag: `friend-${message.chat_id}`,
    renotify: true,
    data: { kind: 'friend-message', chatId: message.chat_id },
  } as NotificationOptions;

  // Phones only allow notifications that come through the service worker.
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
}

// Returns the function that reacts to a message someone else sent: it shows a notification unless
// you're looking at that very chat right now. Pass it to useChatListSync.
export function useFriendNotifier(userId: string | null, onFriendsTab: boolean, blockedIds: Set<string>) {
  return useCallback(
    (message: IncomingMessage) => {
      if (!userId) return;
      // Messages from people you've blocked (in a group) stay silent.
      if (message.sender_id && blockedIds.has(message.sender_id)) return;
      const looking =
        onFriendsTab && document.visibilityState === 'visible' && readOpenChat(userId) === message.chat_id;
      if (looking) return;
      void showMessageNotification(userId, message).catch((err) => console.error('Notification failed:', err));
    },
    [userId, onFriendsTab, blockedIds]
  );
}

// Shows the unread count on the installed app's icon, where the device supports it.
export function useAppBadge(count: number) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0) void nav.setAppBadge?.(count).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  }, [count]);
}