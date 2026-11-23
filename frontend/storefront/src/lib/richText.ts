export type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

const BULLET = /^\s*[-–—•*]\s+/;

/** Splits text from the admin panel into paragraphs (one per line) and bulleted lists. */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, '');
      const last = blocks.at(-1);
      if (last?.kind === 'ul') last.items.push(item);
      else blocks.push({ kind: 'ul', items: [item] });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return blocks;
}
