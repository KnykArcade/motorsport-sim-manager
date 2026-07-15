// Opt-in setup for tests that exercise complete historical seasons or the
// shared driver market. Keeping this out of the global Vitest setup prevents
// lightweight unit tests from eagerly loading the entire 1990-2026 universe.
import './data/seasonData';
import { seedMarketBundleCache } from './data/market';
import { buildStaticMarketBundleMap } from './data/market/marketSeed';

seedMarketBundleCache(buildStaticMarketBundleMap());
