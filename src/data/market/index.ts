// Driver market & academy seed data, keyed by season for future expansion.

import type { MarketDriver, YouthProspect } from '../../types/marketTypes';
import { driverMarket1995 } from './driverMarket1995';
import { youthProspects1995 } from './youthProspects1995';

export { driverMarket1995 } from './driverMarket1995';
export { youthProspects1995 } from './youthProspects1995';

export type MarketBundle = {
  drivers: MarketDriver[];
  youth: YouthProspect[];
};

const marketBundles: Record<string, MarketBundle> = {
  '1995-F1': {
    drivers: driverMarket1995,
    youth: youthProspects1995,
  },
};

export function getMarketBundle(year: number, series = 'F1'): MarketBundle | undefined {
  return marketBundles[`${year}-${series}`];
}
