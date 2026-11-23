import { createSseParser, type SseMessage } from './sse';

test('parses events split across chunks and skips comments', () => {
  const messages: SseMessage[] = [];
  const feed = createSseParser((m) => messages.push(m));
  feed('retry: 3000\n\nevent: ready\ndata: {}\n\n: ping\n\nevent: order_cr');
  feed('eated\r\ndata: {"id":1}\r\n\r\ndata: plain\n');
  expect(messages).toEqual([
    { event: 'ready', data: '{}' },
    { event: 'order_created', data: '{"id":1}' },
  ]);
  feed('\n');
  expect(messages.at(-1)).toEqual({ event: 'message', data: 'plain' });
});
