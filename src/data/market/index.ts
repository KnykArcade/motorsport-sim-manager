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
import { driverMarket1990 } from './driverMarket1990';
import { youthProspects1990 } from './youthProspects1990';
import { driverMarket1991 } from './driverMarket1991';
import { youthProspects1991 } from './youthProspects1991';
import { driverMarket1992 } from './driverMarket1992';
import { youthProspects1992 } from './youthProspects1992';
import { driverMarket1993 } from './driverMarket1993';
import { youthProspects1993 } from './youthProspects1993';
import { driverMarket2001 } from './driverMarket2001';
import { youthProspects2001 } from './youthProspects2001';
import { driverMarket2002 } from './driverMarket2002';
import { youthProspects2002 } from './youthProspects2002';
import { driverMarket2003 } from './driverMarket2003';
import { youthProspects2003 } from './youthProspects2003';
import { driverMarket2004 } from './driverMarket2004';
import { youthProspects2004 } from './youthProspects2004';
import { driverMarket2005 } from './driverMarket2005';
import { youthProspects2005 } from './youthProspects2005';
import { driverMarket2006 } from './driverMarket2006';
import { youthProspects2006 } from './youthProspects2006';
import { driverMarket2007 } from './driverMarket2007';
import { youthProspects2007 } from './youthProspects2007';
import { driverMarket2008 } from './driverMarket2008';
import { youthProspects2008 } from './youthProspects2008';
import { driverMarket2009 } from './driverMarket2009';
import { youthProspects2009 } from './youthProspects2009';
import { driverMarket2010 } from './driverMarket2010';
import { youthProspects2010 } from './youthProspects2010';
import { driverMarket2011 } from './driverMarket2011';
import { youthProspects2011 } from './youthProspects2011';
import { driverMarket2012 } from './driverMarket2012';
import { youthProspects2012 } from './youthProspects2012';
import { driverMarket2013 } from './driverMarket2013';
import { youthProspects2013 } from './youthProspects2013';
import { driverMarket2014 } from './driverMarket2014';
import { youthProspects2014 } from './youthProspects2014';
import { driverMarket2015 } from './driverMarket2015';
import { youthProspects2015 } from './youthProspects2015';
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
  '1990-F1': bundle(driverMarket1990, youthProspects1990),
  '1991-F1': bundle(driverMarket1991, youthProspects1991),
  '1992-F1': bundle(driverMarket1992, youthProspects1992),
  '1993-F1': bundle(driverMarket1993, youthProspects1993),
  '1994-F1': bundle(driverMarket1994, youthProspects1994),
  '1995-F1': bundle(driverMarket1995, youthProspects1995),
  '1996-F1': bundle(driverMarket1996, youthProspects1996),
  '1997-F1': bundle(driverMarket1997, youthProspects1997),
  '1998-F1': bundle(driverMarket1998, youthProspects1998),
  '1999-F1': bundle(driverMarket1999, youthProspects1999),
  '2000-F1': bundle(driverMarket2000, youthProspects2000),
  '2001-F1': bundle(driverMarket2001, youthProspects2001),
  '2002-F1': bundle(driverMarket2002, youthProspects2002),
  '2003-F1': bundle(driverMarket2003, youthProspects2003),
  '2004-F1': bundle(driverMarket2004, youthProspects2004),
  '2005-F1': bundle(driverMarket2005, youthProspects2005),
  '2006-F1': bundle(driverMarket2006, youthProspects2006),
  '2007-F1': bundle(driverMarket2007, youthProspects2007),
  '2008-F1': bundle(driverMarket2008, youthProspects2008),
  '2009-F1': bundle(driverMarket2009, youthProspects2009),
  '2010-F1': bundle(driverMarket2010, youthProspects2010),
  '2011-F1': bundle(driverMarket2011, youthProspects2011),
  '2012-F1': bundle(driverMarket2012, youthProspects2012),
  '2013-F1': bundle(driverMarket2013, youthProspects2013),
  '2014-F1': bundle(driverMarket2014, youthProspects2014),
  '2015-F1': bundle(driverMarket2015, youthProspects2015),
  '2026-F1': bundle(driverMarket2026, youthProspects2026),
  '2026-IndyCar': bundle(driverMarket2026IndyCar, youthProspects2026IndyCar),
};

export function getMarketBundle(year: number, series = 'F1'): MarketBundle | undefined {
  return marketBundles[`${year}-${series}`];
}
