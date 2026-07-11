import type { ReactNode } from 'react';
import { getEraThemeConfig, type MotorsportEraTheme } from './eraTheme';
import { EraThemeContext } from './EraThemeContextValue';

export function EraThemeProvider({
  theme,
  children,
}: {
  theme: MotorsportEraTheme;
  children: ReactNode;
}) {
  return (
    <EraThemeContext.Provider value={getEraThemeConfig(theme)}>
      {children}
    </EraThemeContext.Provider>
  );
}
