import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const localExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/browser/**/*.browser.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(localExecutable ? {
        launchOptions: {
          executablePath: localExecutable,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      } : undefined),
      instances: [{ browser: 'chromium' }],
    },
  },
});
