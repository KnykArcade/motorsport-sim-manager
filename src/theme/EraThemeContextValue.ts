import { createContext } from 'react';
import { getEraThemeConfig, type EraThemeConfig } from './eraTheme';

const fallback = getEraThemeConfig('fallback');

export const EraThemeContext = createContext<EraThemeConfig>(fallback);
