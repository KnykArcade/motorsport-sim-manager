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
import { driverMarket2016 } from './driverMarket2016';
import { youthProspects2016 } from './youthProspects2016';
import { driverMarket2017 } from './driverMarket2017';
import { youthProspects2017 } from './youthProspects2017';
import { driverMarket2018 } from './driverMarket2018';
import { youthProspects2018 } from './youthProspects2018';
import { driverMarket2019 } from './driverMarket2019';
import { youthProspects2019 } from './youthProspects2019';
import { driverMarket2020 } from './driverMarket2020';
import { youthProspects2020 } from './youthProspects2020';
import { driverMarket2021 } from './driverMarket2021';
import { youthProspects2021 } from './youthProspects2021';
import { driverMarket2022 } from './driverMarket2022';
import { youthProspects2022 } from './youthProspects2022';
import { driverMarket2023 } from './driverMarket2023';
import { youthProspects2023 } from './youthProspects2023';
import { driverMarket2024 } from './driverMarket2024';
import { youthProspects2024 } from './youthProspects2024';
import { driverMarket2025 } from './driverMarket2025';
import { youthProspects2025 } from './youthProspects2025';
import { driverMarket2026 } from './driverMarket2026';
import { youthProspects2026 } from './youthProspects2026';
import { driverMarket2026IndyCar } from './driverMarket2026IndyCar';
import { youthProspects2026IndyCar } from './youthProspects2026IndyCar';
import { driverMarket2008IndyCar } from './driverMarket2008IndyCar';
import { youthProspects2008IndyCar } from './youthProspects2008IndyCar';
import { driverMarket2009IndyCar } from './driverMarket2009IndyCar';
import { youthProspects2009IndyCar } from './youthProspects2009IndyCar';
import { driverMarket2010IndyCar } from './driverMarket2010IndyCar';
import { youthProspects2010IndyCar } from './youthProspects2010IndyCar';
import { driverMarket2011IndyCar } from './driverMarket2011IndyCar';
import { youthProspects2011IndyCar } from './youthProspects2011IndyCar';
import { driverMarket2012IndyCar } from './driverMarket2012IndyCar';
import { youthProspects2012IndyCar } from './youthProspects2012IndyCar';
import { driverMarket2013IndyCar } from './driverMarket2013IndyCar';
import { youthProspects2013IndyCar } from './youthProspects2013IndyCar';
import { driverMarket2014IndyCar } from './driverMarket2014IndyCar';
import { youthProspects2014IndyCar } from './youthProspects2014IndyCar';
import { driverMarket2015IndyCar } from './driverMarket2015IndyCar';
import { youthProspects2015IndyCar } from './youthProspects2015IndyCar';
import { driverMarket2016IndyCar } from './driverMarket2016IndyCar';
import { youthProspects2016IndyCar } from './youthProspects2016IndyCar';
import { driverMarket2017IndyCar } from './driverMarket2017IndyCar';
import { youthProspects2017IndyCar } from './youthProspects2017IndyCar';
import { driverMarket2018IndyCar } from './driverMarket2018IndyCar';
import { youthProspects2018IndyCar } from './youthProspects2018IndyCar';
import { driverMarket2019IndyCar } from './driverMarket2019IndyCar';
import { youthProspects2019IndyCar } from './youthProspects2019IndyCar';
import { driverMarket2020IndyCar } from './driverMarket2020IndyCar';
import { youthProspects2020IndyCar } from './youthProspects2020IndyCar';
import { driverMarket2021IndyCar } from './driverMarket2021IndyCar';
import { youthProspects2021IndyCar } from './youthProspects2021IndyCar';
import { driverMarket2022IndyCar } from './driverMarket2022IndyCar';
import { youthProspects2022IndyCar } from './youthProspects2022IndyCar';
import { driverMarket2023IndyCar } from './driverMarket2023IndyCar';
import { youthProspects2023IndyCar } from './youthProspects2023IndyCar';
import { driverMarket2024IndyCar } from './driverMarket2024IndyCar';
import { youthProspects2024IndyCar } from './youthProspects2024IndyCar';
import { driverMarket2025IndyCar } from './driverMarket2025IndyCar';
import { youthProspects2025IndyCar } from './youthProspects2025IndyCar';

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
  '2016-F1': bundle(driverMarket2016, youthProspects2016),
  '2017-F1': bundle(driverMarket2017, youthProspects2017),
  '2018-F1': bundle(driverMarket2018, youthProspects2018),
  '2019-F1': bundle(driverMarket2019, youthProspects2019),
  '2020-F1': bundle(driverMarket2020, youthProspects2020),
  '2021-F1': bundle(driverMarket2021, youthProspects2021),
  '2022-F1': bundle(driverMarket2022, youthProspects2022),
  '2023-F1': bundle(driverMarket2023, youthProspects2023),
  '2024-F1': bundle(driverMarket2024, youthProspects2024),
  '2025-F1': bundle(driverMarket2025, youthProspects2025),
  '2026-F1': bundle(driverMarket2026, youthProspects2026),
  '2026-IndyCar': bundle(driverMarket2026IndyCar, youthProspects2026IndyCar),
  '2008-IndyCar': bundle(driverMarket2008IndyCar, youthProspects2008IndyCar),
  '2009-IndyCar': bundle(driverMarket2009IndyCar, youthProspects2009IndyCar),
  '2010-IndyCar': bundle(driverMarket2010IndyCar, youthProspects2010IndyCar),
  '2011-IndyCar': bundle(driverMarket2011IndyCar, youthProspects2011IndyCar),
  '2012-IndyCar': bundle(driverMarket2012IndyCar, youthProspects2012IndyCar),
  '2013-IndyCar': bundle(driverMarket2013IndyCar, youthProspects2013IndyCar),
  '2014-IndyCar': bundle(driverMarket2014IndyCar, youthProspects2014IndyCar),
  '2015-IndyCar': bundle(driverMarket2015IndyCar, youthProspects2015IndyCar),
  '2016-IndyCar': bundle(driverMarket2016IndyCar, youthProspects2016IndyCar),
  '2017-IndyCar': bundle(driverMarket2017IndyCar, youthProspects2017IndyCar),
  '2018-IndyCar': bundle(driverMarket2018IndyCar, youthProspects2018IndyCar),
  '2019-IndyCar': bundle(driverMarket2019IndyCar, youthProspects2019IndyCar),
  '2020-IndyCar': bundle(driverMarket2020IndyCar, youthProspects2020IndyCar),
  '2021-IndyCar': bundle(driverMarket2021IndyCar, youthProspects2021IndyCar),
  '2022-IndyCar': bundle(driverMarket2022IndyCar, youthProspects2022IndyCar),
  '2023-IndyCar': bundle(driverMarket2023IndyCar, youthProspects2023IndyCar),
  '2024-IndyCar': bundle(driverMarket2024IndyCar, youthProspects2024IndyCar),
  '2025-IndyCar': bundle(driverMarket2025IndyCar, youthProspects2025IndyCar),
};

export function getMarketBundle(year: number, series = 'F1'): MarketBundle | undefined {
  return marketBundles[`${year}-${series}`];
}
