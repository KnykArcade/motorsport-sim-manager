import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Generated historical registries compress extremely well; enforce the
    // real 2.5 MB ceiling with scripts/checkBundleSize.mjs and keep Vite's
    // warning threshold aligned with that CI budget.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-react-router';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          }
          if (id.includes('/src/data/market/')) {
            const match = id.match(/\/src\/data\/market\/(?:driverMarket|youthProspects)(\d{4})(IndyCar|CART|NASCAR)?\.ts$/);
            if (!match) return 'market-core';
            const year = Number(match[1]);
            const series = (match[2] ?? 'F1').toLowerCase();
            const periodStart = Math.floor(year / 5) * 5;
            return `market-${series}-${periodStart}-${periodStart + 4}`;
          }
          if (id.includes('/src/data/phase0/generated/globalDrivers')) return 'phase0-global-drivers';
          if (id.includes('/src/data/phase0/generated/globalCars')) return 'phase0-global-cars';
          if (id.includes('/src/data/phase0/generated/globalTracks')) return 'phase0-global-tracks';
          if (id.includes('/src/data/phase0/generated/globalTeams')) return 'phase0-global-teams';
          if (id.includes('/src/data/phase0/generated/globalNASCAR')) return 'phase0-global-nascar';
          if (id.includes('/src/data/weather/generated/raceMeta')) return 'weather-race-meta';
          if (id.includes('/src/data/weather/generated/trackCoordinates')) return 'weather-track-coordinates';
          // seasonData.ts and the heavy season files it imports (tracks/, teams/,
          // drivers/, cars/, seasons/) are dynamically imported — let Rollup
          // code-split them naturally rather than forcing into game-data.
          if (id.includes('/src/data/seasonData')) {
            return undefined;
          }
          if (id.includes('/src/data/tracks/')) {
            return undefined;
          }
          if (id.includes('/src/data/teams/')) {
            return undefined;
          }
          if (id.includes('/src/data/drivers/')) {
            return undefined;
          }
          if (id.includes('/src/data/cars/')) {
            return undefined;
          }
          if (id.includes('/src/data/seasons/')) {
            return undefined;
          }
        },
      },
    },
  },
  test: {
    setupFiles: ['./src/testSetup.ts'],
  },
})
