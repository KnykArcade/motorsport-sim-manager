// Lightweight season catalog — contains only metadata needed for selection UI.
// No heavy season data (teams, drivers, cars, tracks) is imported here.
// Full season bundles are loaded on demand via seasonLoader.ts.

import type { Series } from '../types/gameTypes';

export type SeasonBundle = {
  season: import('../types/gameTypes').Season;
  teams: import('../types/gameTypes').Team[];
  drivers: import('../types/gameTypes').Driver[];
  cars: import('../types/gameTypes').Car[];
  principals?: import('../types/gameTypes').TeamPrincipal[];
};

const aowAvailableSeasons: { year: number; series: 'CART' | 'Champ Car' | 'IndyCar'; label: string }[] = [
  ...Array.from({ length: 14 }, (_, i) => {
    const year = 1990 + i;
    return { year, series: 'CART' as const, label: `${year} CART PPG Indy Car World Series` };
  }),
  ...Array.from({ length: 4 }, (_, i) => {
    const year = 2004 + i;
    return { year, series: 'Champ Car' as const, label: `${year} Champ Car World Series` };
  }),
  ...Array.from({ length: 12 }, (_, i) => {
    const year = 1996 + i;
    return { year, series: 'IndyCar' as const, label: `${year} Indy Racing League` };
  }),
];

const nascarAvailableSeasons: { year: number; series: 'NASCAR'; label: string }[] = Array.from(
  { length: 37 },
  (_, i) => {
    const year = 1990 + i;
    const era = year <= 2003
      ? 'Winston Cup Series'
      : year <= 2007
        ? 'Nextel Cup Series'
        : year <= 2016
          ? 'Sprint Cup Series'
          : 'Cup Series';
    return { year, series: 'NASCAR' as const, label: `${year} NASCAR ${era}` };
  },
);

// Seasons available to start a new game, in display order.
export const availableSeasons: { year: number; series: Series; label: string }[] = [
  { year: 1990, series: 'F1', label: '1990 Formula 1 World Championship' },
  { year: 1991, series: 'F1', label: '1991 Formula 1 World Championship' },
  { year: 1992, series: 'F1', label: '1992 Formula 1 World Championship' },
  { year: 1993, series: 'F1', label: '1993 Formula 1 World Championship' },
  { year: 1994, series: 'F1', label: '1994 Formula 1 World Championship' },
  { year: 1995, series: 'F1', label: '1995 Formula 1 World Championship' },
  { year: 1996, series: 'F1', label: '1996 Formula 1 World Championship' },
  { year: 1997, series: 'F1', label: '1997 Formula 1 World Championship' },
  { year: 1998, series: 'F1', label: '1998 Formula 1 World Championship' },
  { year: 1999, series: 'F1', label: '1999 Formula 1 World Championship' },
  { year: 2000, series: 'F1', label: '2000 Formula 1 World Championship' },
  { year: 2001, series: 'F1', label: '2001 Formula 1 World Championship' },
  { year: 2002, series: 'F1', label: '2002 Formula 1 World Championship' },
  { year: 2003, series: 'F1', label: '2003 Formula 1 World Championship' },
  { year: 2004, series: 'F1', label: '2004 Formula 1 World Championship' },
  { year: 2005, series: 'F1', label: '2005 Formula 1 World Championship' },
  { year: 2006, series: 'F1', label: '2006 Formula 1 World Championship' },
  { year: 2007, series: 'F1', label: '2007 Formula 1 World Championship' },
  { year: 2008, series: 'F1', label: '2008 Formula 1 World Championship' },
  { year: 2009, series: 'F1', label: '2009 Formula 1 World Championship' },
  { year: 2010, series: 'F1', label: '2010 Formula 1 World Championship' },
  { year: 2011, series: 'F1', label: '2011 Formula 1 World Championship' },
  { year: 2012, series: 'F1', label: '2012 Formula 1 World Championship' },
  { year: 2013, series: 'F1', label: '2013 Formula 1 World Championship' },
  { year: 2014, series: 'F1', label: '2014 Formula 1 World Championship' },
  { year: 2015, series: 'F1', label: '2015 Formula 1 World Championship' },
  { year: 2016, series: 'F1', label: '2016 Formula 1 World Championship' },
  { year: 2017, series: 'F1', label: '2017 Formula 1 World Championship' },
  { year: 2018, series: 'F1', label: '2018 Formula 1 World Championship' },
  { year: 2019, series: 'F1', label: '2019 Formula 1 World Championship' },
  { year: 2020, series: 'F1', label: '2020 Formula 1 World Championship' },
  { year: 2021, series: 'F1', label: '2021 Formula 1 World Championship' },
  { year: 2022, series: 'F1', label: '2022 Formula 1 World Championship' },
  { year: 2023, series: 'F1', label: '2023 Formula 1 World Championship' },
  { year: 2024, series: 'F1', label: '2024 Formula 1 World Championship' },
  { year: 2025, series: 'F1', label: '2025 Formula 1 World Championship' },
  { year: 2026, series: 'F1', label: '2026 Formula 1 World Championship' },
  ...aowAvailableSeasons,
  ...nascarAvailableSeasons,
  { year: 2008, series: 'IndyCar', label: '2008 IndyCar Series' },
  { year: 2009, series: 'IndyCar', label: '2009 IndyCar Series' },
  { year: 2010, series: 'IndyCar', label: '2010 IndyCar Series' },
  { year: 2011, series: 'IndyCar', label: '2011 IndyCar Series' },
  { year: 2012, series: 'IndyCar', label: '2012 IndyCar Series' },
  { year: 2013, series: 'IndyCar', label: '2013 IndyCar Series' },
  { year: 2014, series: 'IndyCar', label: '2014 IndyCar Series' },
  { year: 2015, series: 'IndyCar', label: '2015 IndyCar Series' },
  { year: 2016, series: 'IndyCar', label: '2016 IndyCar Series' },
  { year: 2017, series: 'IndyCar', label: '2017 IndyCar Series' },
  { year: 2018, series: 'IndyCar', label: '2018 IndyCar Series' },
  { year: 2019, series: 'IndyCar', label: '2019 IndyCar Series' },
  { year: 2020, series: 'IndyCar', label: '2020 IndyCar Series' },
  { year: 2021, series: 'IndyCar', label: '2021 IndyCar Series' },
  { year: 2022, series: 'IndyCar', label: '2022 IndyCar Series' },
  { year: 2023, series: 'IndyCar', label: '2023 IndyCar Series' },
  { year: 2024, series: 'IndyCar', label: '2024 IndyCar Series' },
  { year: 2025, series: 'IndyCar', label: '2025 IndyCar Series' },
  { year: 2026, series: 'IndyCar', label: '2026 IndyCar Series' },
];

// Series available to start a new game, in display order.
export const availableSeries: { id: Series; label: string }[] = [
  { id: 'F1', label: 'Formula 1' },
  { id: 'IndyCar', label: 'IndyCar' },
  { id: 'CART', label: 'CART' },
  { id: 'Champ Car', label: 'Champ Car' },
  { id: 'NASCAR', label: 'NASCAR' },
];

// Top-level selection groups for the New Career UI. A group either maps to a
// single series (F1) or bundles several disciplines under one banner
// (American Open Wheel → CART / IndyCar), each picked before choosing a year.
export type SeriesGroup = {
  id: string;
  label: string;
  blurb: string;
  disciplines: { id: Series; label: string }[];
};

export const seriesGroups: SeriesGroup[] = [
  {
    id: 'F1',
    label: 'Formula 1',
    blurb: 'The FIA Formula One World Championship, 1990–2026.',
    disciplines: [{ id: 'F1', label: 'Formula 1' }],
  },
  {
    id: 'AOW',
    label: 'American Open Wheel',
    blurb: 'Top-flight US open-wheel racing — pick CART (Champ Car) or IndyCar.',
    disciplines: [
      { id: 'CART', label: 'CART (1990–2003)' },
      { id: 'Champ Car', label: 'Champ Car (2004–2007)' },
      { id: 'IndyCar', label: 'IndyCar (IRL / unified)' },
    ],
  },
  {
    id: 'NASCAR',
    label: 'NASCAR',
    blurb: 'NASCAR Cup stock car racing, 1990–2026.',
    disciplines: [{ id: 'NASCAR', label: 'NASCAR Cup' }],
  },
];

// Check if a season exists in the catalog.
export function hasSeason(year: number, series: Series = 'F1'): boolean {
  return availableSeasons.some((s) => s.year === year && s.series === series);
}
