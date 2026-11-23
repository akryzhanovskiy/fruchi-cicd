export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser: feed it decoded text chunks as they arrive,
 * it calls `onMessage` for every complete event. Comments (`: ping`) are skipped.
 */
export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk.replace(/\r\n?/g, '\n');
    let end: number;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (data.length) onMessage({ event, data: data.join('\n') });
    }
  };
}
