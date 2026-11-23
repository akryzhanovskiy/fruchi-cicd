/** Formats input as "+380 67 123 45 67" while typing; accepts pasted 0…/380…/+380… numbers. */
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `38${digits}`;
  if (!digits.startsWith('380')) digits = `380${digits.replace(/^3?8?0?/, '')}`;
  digits = digits.slice(0, 12);
  const groups = [
    digits.slice(3, 5),
    digits.slice(5, 8),
    digits.slice(8, 10),
    digits.slice(10, 12),
  ];
  return ['+380', ...groups.filter(Boolean)].join(' ');
}

export const isCompletePhone = (formatted: string) => formatted.replace(/\D/g, '').length === 12;
