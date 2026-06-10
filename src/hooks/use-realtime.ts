"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Message, Conversation } from "@/types";

interface RealtimeEvent<T> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: Partial<T>;
}

interface UseRealtimeOptions {
  channelName: string;
  onMessageEvent?: (event: RealtimeEvent<Message>) => void;
  onConversationEvent?: (event: RealtimeEvent<Conversation>) => void;
  enabled?: boolean;
  /** Poll interval in ms — default 4000 */
  pollInterval?: number;
}

// Polling-based replacement for the Supabase WebSocket realtime hook.
// Calls /api/realtime/poll to get changes since the last known state.
export function useRealtime({
  channelName,
  onMessageEvent,
  onConversationEvent,
  enabled = true,
  pollInterval = 4000,
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastConversationUpdatedRef = useRef<string | null>(null);

  const onMessageRef = useRef(onMessageEvent);
  const onConversationRef = useRef(onConversationEvent);
  useEffect(() => {
    onMessageRef.current = onMessageEvent;
    onConversationRef.current = onConversationEvent;
  });

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ channel: channelName });
      if (lastMessageIdRef.current) params.set('lastMessageId', lastMessageIdRef.current);
      if (lastConversationUpdatedRef.current) params.set('lastConvUpdated', lastConversationUpdatedRef.current);

      const res = await fetch(`/api/realtime/poll?${params}`);
      if (!res.ok) return;

      const { newMessages, updatedConversations } = await res.json() as {
        newMessages: Message[];
        updatedConversations: Conversation[];
      };

      for (const msg of newMessages ?? []) {
        lastMessageIdRef.current = msg.id;
        onMessageRef.current?.({ eventType: 'INSERT', new: msg, old: {} });
      }

      for (const conv of updatedConversations ?? []) {
        if (!lastConversationUpdatedRef.current || conv.updated_at > lastConversationUpdatedRef.current) {
          lastConversationUpdatedRef.current = conv.updated_at;
        }
        onConversationRef.current?.({ eventType: 'UPDATE', new: conv, old: {} });
      }
    } catch {
      // ignore transient errors
    }
  }, [channelName]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    setIsConnected(true);
    timerRef.current = setInterval(poll, pollInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, poll, pollInterval]);

  const unsubscribe = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsConnected(false);
  }, []);

  return { isConnected, unsubscribe };
}
