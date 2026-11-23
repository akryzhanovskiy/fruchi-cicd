import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { playChime, showBrowserNotification } from './alerts';
import { ApiError } from '@fruchi/api-client';

import { openStream } from './api';
import { createSseParser } from './sse';
import type { OrderStreamEvent } from './types';

const MIN_RETRY_MS = 3_000;
const MAX_RETRY_MS = 30_000;

/**
 * Keeps a live connection to GET /admin/orders/stream while the admin panel is open:
 * refreshes order lists and the dashboard, and on a new order shows a toast, plays a
 * chime and (when the tab is in the background) a system notification.
 * Reconnects with backoff; the 30-second polling elsewhere stays as a fallback.
 */
export function useOrderStream() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const refresh = (event?: OrderStreamEvent) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (event) void queryClient.invalidateQueries({ queryKey: ['order', event.id] });
    };

    const announce = (event: OrderStreamEvent) => {
      const open = () => navigateRef.current(`/orders/${event.id}`);
      const title = `Нове замовлення ${event.number}`;
      notifications.show({
        color: 'apple',
        title,
        message: 'Натисніть, щоб відкрити',
        autoClose: 10_000,
        onClick: open,
        style: { cursor: 'pointer' },
      });
      playChime();
      showBrowserNotification(title, 'Fruchi — нове замовлення чекає на підтвердження', open);
    };

    const onMessage = ({ event, data }: { event: string; data: string }) => {
      if (event === 'ready') return refresh(); // catch up on anything missed while offline
      if (event !== 'order_created' && event !== 'order_updated') return;
      const payload = JSON.parse(data) as OrderStreamEvent;
      refresh(payload);
      if (event === 'order_created') announce(payload);
    };

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        });
      });

    async function run() {
      let retry = MIN_RETRY_MS;
      while (!signal.aborted) {
        try {
          const response = await openStream('/orders/stream', signal);
          retry = MIN_RETRY_MS;
          const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
          const feed = createSseParser(onMessage);
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            feed(value);
          }
        } catch (error) {
          if (signal.aborted) return;
          // Session is gone: the next regular request will send the user to the login page.
          if (error instanceof ApiError && error.status === 401) return;
          retry = Math.min(retry * 2, MAX_RETRY_MS);
        }
        await sleep(retry);
      }
    }

    void run();
    return () => controller.abort();
  }, [queryClient]);
}
