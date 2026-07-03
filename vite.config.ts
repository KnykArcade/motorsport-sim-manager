import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-react-router';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          }
          if (id.includes('/src/data/market/')) {
            const match = id.match(/\/src\/data\/market\/(?:driverMarket|youthProspects)(\d{4})(IndyCar)?\.ts$/);
            if (!match) return 'market-core';
            const year = Number(match[1]);
            if (match[2]) {
              if (year <= 2011) return 'market-indycar-2008-2011';
              if (year <= 2017) return 'market-indycar-2012-2017';
              if (year <= 2023) return 'market-indycar-2018-2023';
              return 'market-indycar-modern';
            }
            if (year < 2000) return 'market-f1-1990s';
            if (year < 2010) return 'market-f1-2000s';
            if (year < 2020) return 'market-f1-2010s';
            return 'market-f1-2020s';
          }
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
          if (id.includes('/src/sim/')) {
            return 'sim-engines';
          }
          if (id.includes('/src/data/')) {
            return 'game-data';
          }
          if (id.includes('/src/game/')) {
            return 'game-core';
          }
        },
      },
    },
  },
  test: {
    setupFiles: ['./src/testSetup.ts'],
  },
})
