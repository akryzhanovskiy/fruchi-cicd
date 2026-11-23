import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { playChime, showBrowserNotification } from './alerts';
import { useOrderStream } from './orderStream';

vi.mock('./alerts', () => ({ playChime: vi.fn(), showBrowserNotification: vi.fn() }));

function Listener() {
  useOrderStream();
  return null;
}

const sseResponse = (text: string) =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );

test('a new order from the live stream refreshes lists and alerts the operator', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      sseResponse(
        'event: ready\ndata: {}\n\n' +
          'event: order_created\ndata: {"type":"order_created","id":7,"number":"FR-000007"}\n\n',
      ),
    )
    .mockReturnValue(new Promise(() => {})); // the reconnect just hangs
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');

  const { unmount } = render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Listener />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );

  await waitFor(() => expect(playChime).toHaveBeenCalledOnce());
  expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/orders/stream');
  expect(showBrowserNotification).toHaveBeenCalledWith(
    'Нове замовлення FR-000007',
    expect.any(String),
    expect.any(Function),
  );
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 7] });
  unmount();
});
