import type { Illustration } from '@fruchi/api-client';

const rays = (count: number, step: number, from = 0) =>
  Array.from({ length: count }, (_, i) => from + i * step);

const LABELS: Record<Illustration, string> = {
  apple: 'Скибка яблука',
  pear: 'Скибка груші',
  banana: 'Скибка банана',
  orange: 'Скибка апельсина',
  lemon: 'Скибка лимона',
  pineapple: 'Кільце ананаса',
};

const PEAR_PATH =
  'M100 18 C 84 18 78 36 76 54 C 74 74 40 90 40 132 C 40 166 68 190 100 190 C 132 190 160 166 160 132 C 160 90 126 74 124 54 C 122 36 116 18 100 18 Z';

function Shapes({ fruit }: { fruit: Illustration }) {
  switch (fruit) {
    case 'apple':
      return (
        <>
          <circle cx="100" cy="100" r="88" fill="#B3322A" />
          <circle cx="100" cy="100" r="79" fill="#FBE3BC" />
          <circle cx="100" cy="100" r="57" fill="none" stroke="#EFC992" strokeWidth="3" />
          <g fill="#6B3B1F">
            {rays(5, 72).map((a) => (
              <ellipse key={a} cx="100" cy="78" rx="5" ry="10" transform={`rotate(${a} 100 100)`} />
            ))}
          </g>
          <circle cx="100" cy="100" r="10" fill="#FDF3EA" />
        </>
      );
    case 'pear':
      return (
        <>
          <path d="M100 26 L100 6" stroke="#6B3B1F" strokeWidth="5" strokeLinecap="round" />
          <path d={PEAR_PATH} fill="#9AAE34" />
          <path
            d={PEAR_PATH}
            fill="#F6EBC4"
            transform="translate(100 112) scale(0.88) translate(-100 -112)"
          />
          <path d="M100 34 L100 104" stroke="#E3CF8E" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="100" cy="136" rx="24" ry="30" fill="none" stroke="#E3CF8E" strokeWidth="3" />
          <g fill="#6B3B1F">
            <ellipse cx="92" cy="138" rx="4.5" ry="9" transform="rotate(18 92 138)" />
            <ellipse cx="108" cy="138" rx="4.5" ry="9" transform="rotate(-18 108 138)" />
          </g>
        </>
      );
    case 'banana':
      return (
        <>
          <circle cx="100" cy="100" r="84" fill="#D9A733" />
          <circle cx="100" cy="100" r="76" fill="#F7E3A6" />
          <circle cx="100" cy="100" r="42" fill="#F2D68C" />
          <g stroke="#E6C46E" strokeWidth="3" strokeLinecap="round">
            <path d="M100 100 L100 58" />
            <path d="M100 100 L136 121" />
            <path d="M100 100 L64 121" />
          </g>
          <g fill="#7A4A26">
            <circle cx="100" cy="90" r="3.5" />
            <circle cx="91" cy="105" r="3.5" />
            <circle cx="109" cy="105" r="3.5" />
          </g>
        </>
      );
    case 'orange':
    case 'lemon': {
      const orange = fruit === 'orange';
      const pith = orange ? '#FFF0DA' : '#FFF7D9';
      return (
        <>
          <circle cx="100" cy="100" r="88" fill={orange ? '#E0701E' : '#D9AE12'} />
          <circle cx="100" cy="100" r="80" fill={pith} />
          <circle cx="100" cy="100" r="73" fill={orange ? '#F39A35' : '#F4D84E'} />
          <g stroke={pith} strokeWidth="4" strokeLinecap="round">
            {rays(orange ? 10 : 8, orange ? 36 : 45).map((a) => (
              <path key={a} d="M100 100 L100 26" transform={`rotate(${a} 100 100)`} />
            ))}
          </g>
          <circle cx="100" cy="100" r="9" fill={pith} />
          {!orange && (
            <g fill="#C7A13A">
              <ellipse cx="100" cy="66" rx="3" ry="6" transform="rotate(22 100 100)" />
              <ellipse cx="100" cy="66" rx="3" ry="6" transform="rotate(202 100 100)" />
            </g>
          )}
        </>
      );
    }
    case 'pineapple':
      return (
        <>
          <circle cx="100" cy="100" r="88" fill="#B07A22" />
          <circle cx="100" cy="100" r="80" fill="#F5C443" />
          <g stroke="#E2A82C" strokeWidth="3" strokeLinecap="round">
            {rays(16, 22.5).map((a) => (
              <path key={a} d="M100 76 L100 28" transform={`rotate(${a} 100 100)`} />
            ))}
          </g>
          <circle cx="100" cy="100" r="22" fill="#F9DD86" />
          <circle cx="100" cy="100" r="11" fill="#FDF3EA" />
        </>
      );
  }
}

/** Fruit slice illustration from the design (component "Скибка фрукта"). */
export function Slice({
  fruit,
  decorative = false,
}: {
  fruit: Illustration;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : LABELS[fruit]}
    >
      <Shapes fruit={fruit} />
    </svg>
  );
}
