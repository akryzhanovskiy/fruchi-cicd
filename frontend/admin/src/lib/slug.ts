// Ukrainian official transliteration (KMU 2010), simplified.
const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  '’': '',
  "'": '',
  ʼ: '',
};
// At the start of a word these letters are written differently.
const TRANSLIT_WORD_START: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };

/** "Яблучні чіпси" → "yabluchni-chipsy". */
export function slugify(text: string): string {
  return [...text.toLowerCase()]
    .map((ch, i, all) => {
      const wordStart = i === 0 || !/[\p{L}’'ʼ]/u.test(all[i - 1]);
      return (wordStart && TRANSLIT_WORD_START[ch]) || (TRANSLIT[ch] ?? ch);
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
