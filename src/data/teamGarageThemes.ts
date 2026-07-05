export type GarageEraModel = 'f1-1990-1994';

export type TeamGarageTheme = {
  eraModel: GarageEraModel;
  teamId?: string;
  teamName?: string;
  templateImage: string;
  sceneImageOverride?: string;
  primary: string;
  secondary: string;
  trim: string;
};

export const DEFAULT_GARAGE_THEME: TeamGarageTheme = {
  eraModel: 'f1-1990-1994',
  templateImage: '/assets/f1-1990s-garage-neutral.png',
  primary: '#767676',
  secondary: '#b8b8b8',
  trim: '#111111',
};

export const TEAM_GARAGE_THEMES: TeamGarageTheme[] = [
  {
    eraModel: 'f1-1990-1994',
    teamId: 't-ferrari',
    teamName: 'Ferrari',
    templateImage: '/assets/f1-1990s-garage-neutral.png',
    primary: '#c40000',
    secondary: '#ffd21f',
    trim: '#050505',
  },
];

export function garageThemeForTeamEra(
  eraModel: GarageEraModel,
  team: { id: string; name: string } | null | undefined,
): TeamGarageTheme {
  const defaultTheme = { ...DEFAULT_GARAGE_THEME, eraModel };
  if (!team) return defaultTheme;
  const eraThemes = TEAM_GARAGE_THEMES.filter((theme) => theme.eraModel === eraModel);
  const byId = eraThemes.find((theme) => theme.teamId === team.id);
  if (byId) return byId;
  const normalizedName = team.name.toLowerCase();
  return (
    eraThemes.find((theme) => theme.teamName && normalizedName.includes(theme.teamName.toLowerCase())) ??
    defaultTheme
  );
}
