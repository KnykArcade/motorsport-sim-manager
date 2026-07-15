export type TeamHQTab = 'race' | 'car' | 'organization' | 'personnel' | 'news' | 'standings';

export const TEAM_HQ_TABS: Array<{ id: TeamHQTab; label: string }> = [
  { id: 'race', label: 'Race Desk' },
  { id: 'car', label: 'Car & Rules' },
  { id: 'organization', label: 'Organization' },
  { id: 'personnel', label: 'Personnel' },
  { id: 'news', label: 'Team News' },
  { id: 'standings', label: 'Standings' },
];

