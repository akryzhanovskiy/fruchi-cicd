import { toBlocks } from '../lib/richText';

/** Plain text with the line breaks and "- " lists the operator typed in the admin panel. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {toBlocks(text).map((block, i) =>
        block.kind === 'p' ? (
          <p key={i}>{block.text}</p>
        ) : (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
