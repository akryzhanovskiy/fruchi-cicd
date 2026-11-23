import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { toBlocks } from '../lib/richText';
import { RichText } from './RichText';

describe('toBlocks', () => {
  it('makes a paragraph of every line and a list of "- " lines', () => {
    expect(
      toBlocks(
        'Перший абзац.\n\nДругий абзац.\nЯк смакувати:\n- до чаю;\n- у вівсянці.\r\nКінець.',
      ),
    ).toEqual([
      { kind: 'p', text: 'Перший абзац.' },
      { kind: 'p', text: 'Другий абзац.' },
      { kind: 'p', text: 'Як смакувати:' },
      { kind: 'ul', items: ['до чаю;', 'у вівсянці.'] },
      { kind: 'p', text: 'Кінець.' },
    ]);
  });

  it('returns nothing for blank text', () => {
    expect(toBlocks('  \n ')).toEqual([]);
  });
});

it('renders paragraphs and list items', () => {
  render(<RichText text={'Опис.\n- перше\n- друге'} />);
  expect(screen.getByText('Опис.').tagName).toBe('P');
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['перше', 'друге']);
});
