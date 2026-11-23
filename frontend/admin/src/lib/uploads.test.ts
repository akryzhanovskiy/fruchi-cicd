import type { FileRejection } from '@mantine/dropzone';
import { describe, expect, it } from 'vitest';

import { rejectionMessage } from './uploads';

const rejected = (name: string, code: string): FileRejection => ({
  file: new File(['x'], name) as FileRejection['file'],
  errors: [{ code, message: '' }],
});

describe('rejectionMessage', () => {
  it('names an unsupported format', () => {
    expect(rejectionMessage([rejected('IMG_0042.heic', 'file-invalid-type')])).toBe(
      'IMG_0042.heic: формат HEIC не підтримується. Завантажте JPEG, PNG або WebP.',
    );
  });

  it('explains a file that is too large, one line per file', () => {
    expect(
      rejectionMessage([
        rejected('big.jpg', 'file-too-large'),
        rejected('noext', 'file-invalid-type'),
      ]),
    ).toBe(
      'big.jpg: фото більше за 10 МБ.\nnoext: цей формат не підтримується. Завантажте JPEG, PNG або WebP.',
    );
  });
});
