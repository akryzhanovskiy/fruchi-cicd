/** Ukrainian plural form: plural(n, ['товар', 'товари', 'товарів']). */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const itemsLabel = (n: number) => `${n} ${plural(n, ['товар', 'товари', 'товарів'])}`;
