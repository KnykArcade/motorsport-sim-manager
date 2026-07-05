export type TeamGarageTheme = {
  teamId?: string;
  teamName?: string;
  garageImage: string;
  primary: string;
  secondary: string;
  trim: string;
};

export const DEFAULT_GARAGE_THEME: TeamGarageTheme = {
  garageImage: '/assets/f1-1990s-garage-neutral.png',
  primary: '#767676',
  secondary: '#b8b8b8',
  trim: '#111111',
};

export const TEAM_GARAGE_THEMES: TeamGarageTheme[] = [
  {
    teamId: 't-ferrari',
    teamName: 'Ferrari',
    garageImage: '/assets/f1-1990s-garage-ferrari.png',
    primary: '#c40000',
    secondary: '#ffd21f',
    trim: '#050505',
  },
];

export function garageThemeForTeam(team: { id: string; name: string } | null | undefined): TeamGarageTheme {
  if (!team) return DEFAULT_GARAGE_THEME;
  const byId = TEAM_GARAGE_THEMES.find((theme) => theme.teamId === team.id);
  if (byId) return byId;
  const normalizedName = team.name.toLowerCase();
  return (
    TEAM_GARAGE_THEMES.find((theme) => theme.teamName && normalizedName.includes(theme.teamName.toLowerCase())) ??
    DEFAULT_GARAGE_THEME
  );
}
