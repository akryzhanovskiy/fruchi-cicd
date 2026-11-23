import type { FileRejection } from '@mantine/dropzone';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** File extension in upper case ("IMG_1.heic" → "HEIC"), or "" when there is none. */
function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : '';
}

/** Why the photo picker refused the files, in words the operator can act on. */
export function rejectionMessage(rejections: FileRejection[]): string {
  return rejections
    .map(({ file, errors }) => {
      const codes = errors.map((e) => e.code);
      if (codes.includes('file-invalid-type')) {
        const ext = extension(file.name);
        return `${file.name}: ${ext ? `формат ${ext}` : 'цей формат'} не підтримується. Завантажте JPEG, PNG або WebP.`;
      }
      if (codes.includes('file-too-large')) {
        return `${file.name}: фото більше за 10 МБ.`;
      }
      return `${file.name}: файл не вдалося додати.`;
    })
    .join('\n');
}
