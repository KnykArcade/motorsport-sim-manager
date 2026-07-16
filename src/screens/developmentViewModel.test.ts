import { describe, expect, it } from 'vitest';
import {
  DEVELOPMENT_PAGE_SIZES,
  developmentPage,
  developmentPageCount,
  developmentTabs,
} from './developmentViewModel';

describe('development view model', () => {
  it('shows the era-specific factory tab only for supported seasons', () => {
    expect(developmentTabs(false).map((tab) => tab.id)).toEqual([
      'active', 'results', 'catalog', 'research', 'parts',
    ]);
    expect(developmentTabs(true).at(-1)?.id).toBe('factory');
  });

  it('paginates the project catalog without dropping the final entry', () => {
    const projects = Array.from({ length: 12 }, (_, index) => index + 1);
    expect(developmentPageCount(projects.length, DEVELOPMENT_PAGE_SIZES.catalog)).toBe(6);
    expect(developmentPage(projects, 0, DEVELOPMENT_PAGE_SIZES.catalog)).toEqual([1, 2]);
    expect(developmentPage(projects, 5, DEVELOPMENT_PAGE_SIZES.catalog)).toEqual([11, 12]);
    expect(developmentPage(projects, 99, DEVELOPMENT_PAGE_SIZES.catalog)).toEqual([11, 12]);
  });
});
