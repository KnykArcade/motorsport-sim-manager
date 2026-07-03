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
            return 'market-data';
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
