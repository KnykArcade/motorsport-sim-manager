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

const marketBundles: Record<string, MarketBundle> = {
  '1994-F1': { drivers: driverMarket1994, youth: youthProspects1994 },
  '1995-F1': { drivers: driverMarket1995, youth: youthProspects1995 },
  '1996-F1': { drivers: driverMarket1996, youth: youthProspects1996 },
  '1997-F1': { drivers: driverMarket1997, youth: youthProspects1997 },
  '1998-F1': { drivers: driverMarket1998, youth: youthProspects1998 },
  '1999-F1': { drivers: driverMarket1999, youth: youthProspects1999 },
  '2000-F1': { drivers: driverMarket2000, youth: youthProspects2000 },
  '2026-F1': { drivers: driverMarket2026, youth: youthProspects2026 },
  '2026-IndyCar': { drivers: driverMarket2026IndyCar, youth: youthProspects2026IndyCar },
};

export function getMarketBundle(year: number, series = 'F1'): MarketBundle | undefined {
  return marketBundles[`${year}-${series}`];
}
