'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageSummary, ShowingSummary } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

/**
 * Pushes new messages / status changes for one conversation over a
 * socket.io connection instead of polling. The server only lets a socket
 * join a conversation room it's actually a participant in (checked again
 * server-side on every 'join'), so this can't be used to snoop on another
 * conversation by guessing an id.
 */
export function useConversationSocket(
  conversationId: string | undefined,
  accessToken: string | null,
  onMessage: (message: MessageSummary) => void,
  onConversationUpdate: (patch: { id: string; status: string }) => void,
  onShowingUpdate?: (showing: ShowingSummary) => void,
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onConversationUpdateRef = useRef(onConversationUpdate);
  onConversationUpdateRef.current = onConversationUpdate;
  const onShowingUpdateRef = useRef(onShowingUpdate);
  onShowingUpdateRef.current = onShowingUpdate;

  useEffect(() => {
    if (!conversationId || !accessToken) return;

    const socket: Socket = io(`${API_BASE_URL}/conversations`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      socket.emit('join', { conversationId });
    });
    socket.on('message:new', (message: MessageSummary) => onMessageRef.current(message));
    socket.on('conversation:updated', (patch: { id: string; status: string }) =>
      onConversationUpdateRef.current(patch),
    );
    socket.on('showing:updated', (showing: ShowingSummary) => onShowingUpdateRef.current?.(showing));

    return () => {
      socket.close();
    };
  }, [conversationId, accessToken]);
}
