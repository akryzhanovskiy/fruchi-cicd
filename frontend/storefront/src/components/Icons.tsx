import type { SVGProps } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const icon = (children: React.ReactNode, defaults: Partial<IconProps> = {}) =>
  function Icon({ size = 22, ...props }: IconProps) {
    return (
      <svg width={size} height={size} {...base} {...defaults} {...props}>
        {children}
      </svg>
    );
  };

export const InstagramIcon = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </>,
);

export const FacebookIcon = icon(
  <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H6.5v3.5H9V21h3.5v-8.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />,
);

export const BagIcon = icon(
  <>
    <path d="M5 8h14l-1.2 12H6.2L5 8z" />
    <path d="M9 8a3 3 0 0 1 6 0" />
  </>,
);

export const MenuIcon = icon(<path d="M4 7h16M4 12h16M4 17h16" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const BackIcon = icon(<path d="M15 5l-7 7 7 7" />);
export const CheckIcon = icon(<path d="M5 12l5 5 9-10" />, { strokeWidth: 3 });
export const PlusIcon = icon(<path d="M5 12h14M12 5v14" />, { strokeWidth: 2.5 });
export const MinusIcon = icon(<path d="M5 12h14" />, { strokeWidth: 2.5 });

export const TruckIcon = icon(
  <>
    <path d="M2 6h12v10H2z" />
    <path d="M14 9h4l3 3v4h-7z" />
    <circle cx="6.5" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </>,
);

export const CardIcon = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
  </>,
);

export const ChatIcon = icon(<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z" />);
