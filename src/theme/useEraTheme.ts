import { useContext } from 'react';
import { EraThemeContext } from './EraThemeContextValue';
import type { EraThemeConfig } from './eraTheme';

export function useEraTheme(): EraThemeConfig {
  return useContext(EraThemeContext);
}
