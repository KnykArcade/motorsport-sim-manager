import type { PaddockEvent } from '../types/careerPhaseTypes';

export type PaddockAgendaTab = 'overview' | 'people' | 'decisions' | 'updates' | 'debrief';
export type PaddockPeopleSection = 'attention' | 'support' | 'resolved';

export function paddockEventDestination(event: PaddockEvent): { route: string; routeLabel: string } {
  const focus = encodeURIComponent(event.id);
  if (event.characterRequest || event.characterDispute || event.characterInitiative || event.characterBreakingPoint) {
    return {
      route: `/paddock?tab=people&section=attention&focus=${focus}`,
      routeLabel: 'Open People Agenda',
    };
  }
  return {
    route: `/paddock?tab=decisions&focus=${focus}`,
    routeLabel: 'Open Operations Agenda',
  };
}

export function defaultPaddockTab(hasRequiredDecision: boolean, packageSelected: boolean): PaddockAgendaTab {
  return hasRequiredDecision || !packageSelected ? 'decisions' : 'people';
}
