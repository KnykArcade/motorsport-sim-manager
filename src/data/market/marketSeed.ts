import type { Series } from '../../types/gameTypes';
import type { MarketDriver, YouthProspect } from '../../types/marketTypes';

type SeedBundle = {
  drivers: MarketDriver[];
  youth: YouthProspect[];
};

const eagerDriverModules = import.meta.glob('./driverMarket*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const eagerYouthModules = import.meta.glob('./youthProspects*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const staticBundles = new Map<string, SeedBundle>();

function seriesForMarketFile(year: number, suffix: string | undefined): Series {
  if (!suffix) return 'F1';
  if (suffix === 'IndyCar') return 'IndyCar';
  if (suffix === 'NASCAR') return 'NASCAR';
  return year >= 2004 ? 'Champ Car' : 'CART';
}

for (const [path, driversMod] of Object.entries(eagerDriverModules)) {
  const match = path.match(/driverMarket(\d{4})(IndyCar|CART|NASCAR)?\.ts$/);
  if (!match) continue;
  const year = Number(match[1]);
  const suffix = match[2];
  const series = seriesForMarketFile(year, suffix);
  const youthMod = eagerYouthModules[path.replace('driverMarket', 'youthProspects')];
  if (!youthMod) continue;
  const drivers = driversMod[`driverMarket${year}${suffix ?? ''}`] as MarketDriver[] | undefined;
  const youth = youthMod[`youthProspects${year}${suffix ?? ''}`] as YouthProspect[] | undefined;
  if (drivers && youth) staticBundles.set(`${year}-${series}`, { drivers, youth });
}

export function buildStaticMarketBundleMap(): Record<string, SeedBundle> {
  return Object.fromEntries(staticBundles.entries());
}
