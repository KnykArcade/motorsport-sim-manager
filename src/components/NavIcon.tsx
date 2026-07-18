import type { ReactNode } from 'react';

// Compact FM-style line icons for the navigation rail. Each entry is keyed by
// route so navigation data stays declarative and the shell renders real icons
// instead of text abbreviations.
const ICON_PATHS: Record<string, ReactNode> = {
  '/hq': (
    <>
      <path d="M3 20V9l6-4 6 4v11" />
      <path d="M9 20v-5h3v5" />
      <path d="M18 20V6l3 2v12" />
    </>
  ),
  '/calendar': (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </>
  ),
  '/standings': (
    <>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </>
  ),
  '/news': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h6M7 13h10M7 17h10" />
    </>
  ),
  '/history': (
    <>
      <path d="M12 7v5l3 2" />
      <path d="M3.5 9a9 9 0 1 1-.5 5" />
      <path d="M3 5v4h4" />
    </>
  ),
  '/records': (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3" />
      <path d="M10 15h4M9 20h6M12 15v5" />
    </>
  ),
  '/teams': (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 20a6 6 0 0 1 12 0" />
    </>
  ),
  '/drivers': (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  '/market': (
    <>
      <path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  '/scouting': (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  '/technical': (
    <>
      <path d="M4 20l5-5M14.5 4.5l5 5-9 9H5.5v-5z" />
      <path d="M13 6l5 5" />
    </>
  ),
  '/finance': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9a3 3 0 0 0-5 2c0 3 5 1.5 5 4a3 3 0 0 1-5 2M12 7v1.5M12 15.5V17" />
    </>
  ),
  '/sponsors': (
    <>
      <path d="M4 8l8-4 8 4-8 4z" />
      <path d="M4 8v8l8 4 8-4V8M12 12v8" />
    </>
  ),
  '/staff': (
    <>
      <circle cx="8" cy="9" r="2.6" />
      <circle cx="16" cy="9" r="2.6" />
      <path d="M3 19a5 5 0 0 1 10 0M13 19a5 5 0 0 1 8-3.9" />
    </>
  ),
  '/facilities': (
    <>
      <path d="M3 21V8l7-4v5l7-4v16" />
      <path d="M3 21h18M7 12h1M7 16h1M13 12h1M13 16h1" />
    </>
  ),
  '/engine': (
    <>
      <path d="M5 9h3l2-2h4v2h3l2 2v4h-2v2h-4l-2 2H8v-2H5z" />
      <path d="M3 11v2" />
    </>
  ),
  '/principal': (
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M6 21a6 6 0 0 1 12 0" />
      <path d="M12 2.5l1.2 1.6h-2.4z" />
    </>
  ),
  '/relationships': (
    <>
      <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" />
    </>
  ),
  '/rivals': (
    <>
      <path d="M14.5 6.5l4 4-7 7-4-4z" />
      <path d="M3 21l4-1 1-4M17 3l4 4M15 8l1-1" />
    </>
  ),
  '/stories': (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2z" />
      <path d="M20 5a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2z" />
    </>
  ),
  '/politics': (
    <>
      <path d="M12 3l8 4-8 4-8-4z" />
      <path d="M6 10v6M18 10v6M9 16h6M4 20h16" />
    </>
  ),
  '/curves': (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M4 16c4 0 5-8 8-8s4 4 8 4" />
    </>
  ),
  '/data': (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  '/settings': (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  ),
};

const FALLBACK: ReactNode = <circle cx="12" cy="12" r="7" />;

export function NavIcon({ to, className = '' }: { to: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[to] ?? FALLBACK}
    </svg>
  );
}
