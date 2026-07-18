export type DevelopmentTab = 'active' | 'results' | 'catalog';

export function developmentTabs() {
  const tabs: Array<{ id: DevelopmentTab; label: string }> = [
    { id: 'active', label: 'Active' },
    { id: 'results', label: 'Results' },
    { id: 'catalog', label: 'Project Catalog' },
  ];
  return tabs;
}
