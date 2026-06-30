// Driver market & academy seed data, keyed by season for future expansion.

import type { MarketDriver, YouthProspect } from '../../types/marketTypes';
import { driverMarket1995 } from './driverMarket1995';
import { youthProspects1995 } from './youthProspects1995';
import { driverMarket1994 } from './driverMarket1994';
import { youthProspects1994 } from './youthProspects1994';
import { driverMarket1996 } from './driverMarket1996';
import { youthProspects1996 } from './youthProspects1996';
import { driverMarket1997 } from './driverMarket1997';
import { youthProspects1997 } from './youthProspects1997';
import { driverMarket1998 } from './driverMarket1998';
import { youthProspects1998 } from './youthProspects1998';
import { driverMarket1999 } from './driverMarket1999';
import { youthProspects1999 } from './youthProspects1999';
import { driverMarket2000 } from './driverMarket2000';
import { youthProspects2000 } from './youthProspects2000';
import { driverMarket2026 } from './driverMarket2026';
import { youthProspects2026 } from './youthProspects2026';
import { driverMarket2026IndyCar } from './driverMarket2026IndyCar';
import { youthProspects2026IndyCar } from './youthProspects2026IndyCar';

export { driverMarket1995 } from './driverMarket1995';
export { youthProspects1995 } from './youthProspects1995';

export type MarketBundle = {
  drivers: MarketDriver[];
  youth: YouthProspect[];
};

// Youth signing/academy costs in the raw season files are inconsistent: some
// were authored in $M (e.g. 0.2) while others came through as raw dollars
// (e.g. 550000), which the finance layer then multiplied by 1M. Unproven youth
// prospects should also simply be cheap — potential is not a guarantee. So we
// derive both costs from the prospect's potential on a single low $M scale,
// ignoring the unreliable source columns. Higher potential costs a little more.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function youthSigningCost(potential: number): number {
  return round2(0.02 + (Math.max(0, Math.min(10, potential)) / 10) * 0.13);
}
export function youthYearlyAcademyCost(potential: number): number {
  return round2(0.01 + (Math.max(0, Math.min(10, potential)) / 10) * 0.09);
}

function normalizeYouth(youth: YouthProspect[]): YouthProspect[] {
  return youth.map((y) => ({
    ...y,
    signingCost: youthSigningCost(y.potential),
    yearlyAcademyCost: youthYearlyAcademyCost(y.potential),
  }));
}

function bundle(drivers: MarketDriver[], youth: YouthProspect[]): MarketBundle {
  return { drivers, youth: normalizeYouth(youth) };
}

const marketBundles: Record<string, MarketBundle> = {
  '1994-F1': bundle(driverMarket1994, youthProspects1994),
  '1995-F1': bundle(driverMarket1995, youthProspects1995),
  '1996-F1': bundle(driverMarket1996, youthProspects1996),
  '1997-F1': bundle(driverMarket1997, youthProspects1997),
  '1998-F1': bundle(driverMarket1998, youthProspects1998),
  '1999-F1': bundle(driverMarket1999, youthProspects1999),
  '2000-F1': bundle(driverMarket2000, youthProspects2000),
  '2026-F1': bundle(driverMarket2026, youthProspects2026),
  '2026-IndyCar': bundle(driverMarket2026IndyCar, youthProspects2026IndyCar),
};

export function getMarketBundle(year: number, series = 'F1'): MarketBundle | undefined {
  return marketBundles[`${year}-${series}`];
}
