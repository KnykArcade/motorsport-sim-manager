import type { Series } from '../types/gameTypes';

export type MotorsportEraTheme =
  | 'f1-1990s'
  | 'f1-2000s'
  | 'f1-2010s'
  | 'f1-2020s'
  | 'indycar-2008-2011'
  | 'indycar-2012-2017'
  | 'indycar-2018-2023'
  | 'indycar-modern'
  | 'fallback';

export type EraThemeConfig = {
  id: MotorsportEraTheme;
  label: string;
  shortLabel: string;
  className: string;
  accentName: string;
};

function isValidYear(year: number | undefined | null): year is number {
  return typeof year === 'number' && Number.isFinite(year);
}

export function getEraTheme(
  series: Series | string | undefined | null,
  year: number | undefined | null,
): MotorsportEraTheme {
  if (!series || !isValidYear(year)) return 'fallback';

  if (series === 'F1') {
    if (year >= 1990 && year <= 1999) return 'f1-1990s';
    if (year >= 2000 && year <= 2009) return 'f1-2000s';
    if (year >= 2010 && year <= 2019) return 'f1-2010s';
    if (year >= 2020 && year <= 2026) return 'f1-2020s';
    return 'fallback';
  }

  if (series === 'IndyCar') {
    if (year >= 2008 && year <= 2011) return 'indycar-2008-2011';
    if (year >= 2012 && year <= 2017) return 'indycar-2012-2017';
    if (year >= 2018 && year <= 2023) return 'indycar-2018-2023';
    if (year >= 2024 && year <= 2026) return 'indycar-modern';
  }

  return 'fallback';
}

export const ERA_THEME_CONFIGS: Record<MotorsportEraTheme, EraThemeConfig> = {
  'f1-1990s': {
    id: 'f1-1990s',
    label: '1990s F1 Era',
    shortLabel: '1990s',
    className: 'era-f1-1990s',
    accentName: 'Paddock paper',
  },
  'f1-2000s': {
    id: 'f1-2000s',
    label: '2000s F1 Era',
    shortLabel: '2000s',
    className: 'era-f1-2000s',
    accentName: 'Internet boom',
  },
  'f1-2010s': {
    id: 'f1-2010s',
    label: '2010s F1 Era',
    shortLabel: '2010s',
    className: 'era-f1-2010s',
    accentName: 'Digital age',
  },
  'f1-2020s': {
    id: 'f1-2020s',
    label: '2020s F1 Era',
    shortLabel: '2020s',
    className: 'era-f1-2020s',
    accentName: 'Modern command',
  },
  'indycar-2008-2011': {
    id: 'indycar-2008-2011',
    label: 'IndyCar Era',
    shortLabel: 'IndyCar',
    className: 'era-indycar-2008-2011',
    accentName: 'Post-merger',
  },
  'indycar-2012-2017': {
    id: 'indycar-2012-2017',
    label: 'IndyCar Era',
    shortLabel: 'IndyCar',
    className: 'era-indycar-2012-2017',
    accentName: 'DW12',
  },
  'indycar-2018-2023': {
    id: 'indycar-2018-2023',
    label: 'IndyCar Era',
    shortLabel: 'IndyCar',
    className: 'era-indycar-2018-2023',
    accentName: 'Universal kit',
  },
  'indycar-modern': {
    id: 'indycar-modern',
    label: 'Modern IndyCar',
    shortLabel: 'IndyCar',
    className: 'era-indycar-modern',
    accentName: 'Modern',
  },
  fallback: {
    id: 'fallback',
    label: 'Motorsport Era',
    shortLabel: 'Era',
    className: 'era-fallback',
    accentName: 'Classic',
  },
};

export function getEraThemeConfig(theme: MotorsportEraTheme): EraThemeConfig {
  return ERA_THEME_CONFIGS[theme] ?? ERA_THEME_CONFIGS.fallback;
}

export function isF1Era(theme: MotorsportEraTheme): boolean {
  return theme.startsWith('f1-');
}
