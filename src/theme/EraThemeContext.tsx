import { createContext, useContext, type ReactNode } from 'react';
import { getEraThemeConfig, type EraThemeConfig, type MotorsportEraTheme } from './eraTheme';

const fallback = getEraThemeConfig('fallback');

const EraThemeContext = createContext<EraThemeConfig>(fallback);

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

export function useEraTheme(): EraThemeConfig {
  return useContext(EraThemeContext);
}
