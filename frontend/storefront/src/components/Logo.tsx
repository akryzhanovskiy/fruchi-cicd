/** Brand mark from the design; `inverted` is the light variant used on the dark footer. */
export function LogoMark({ size = 46, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <path
        d="M100 30 L97 12"
        stroke={inverted ? '#FDF3EA' : '#6B3B1F'}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M100 26 C 108 6, 134 0, 148 8 C 138 26, 116 32, 100 26 Z"
        fill={inverted ? '#9FD38F' : '#3E7B3A'}
      />
      <circle cx="100" cy="110" r="80" fill={inverted ? '#FDF3EA' : '#B3322A'} />
      <circle cx="100" cy="110" r="71" fill="#FBE3BC" />
      <circle cx="100" cy="110" r="52" fill="none" stroke="#EFC992" strokeWidth="3" />
      <g fill="#6B3B1F">
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse
            key={angle}
            cx="100"
            cy="90"
            rx="4.5"
            ry="9"
            transform={`rotate(${angle} 100 110)`}
          />
        ))}
      </g>
      <circle cx="100" cy="110" r="9" fill={inverted ? '#3A2416' : '#FDF3EA'} />
    </svg>
  );
}
