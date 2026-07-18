import { describe, expect, it } from 'vitest';
import { developmentTabs } from './developmentViewModel';

describe('development view model', () => {
  it('exposes the conventional development sections', () => {
    expect(developmentTabs().map((tab) => tab.id)).toEqual([
      'active', 'results', 'catalog',
    ]);
    expect(developmentTabs().at(-1)?.id).toBe('catalog');
  });

});
