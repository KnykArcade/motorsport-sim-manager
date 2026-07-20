import type { QualifyingResult, RaceResult, Track } from '../types/gameTypes';
import type { WeatherState } from '../types/liveTypes';
import type { RaceEvent } from '../types/simTypes';

type DebriefTone = 'positive' | 'warning' | 'neutral';

export type DebriefEvidence = {
  label: string;
  value: string;
  detail: string;
  tone: DebriefTone;
};

export type DebriefFollowUp = {
  label: string;
  route: string;
  reason: string;
};

export type PostRaceCausalDebrief = {
  title: string;
  summary: string;
  evidence: DebriefEvidence[];
  followUps: DebriefFollowUp[];
};

export function buildPostRaceCausalDebrief(input: {
  raceId: string;
  playerResults: RaceResult[];
  qualifyingResults: QualifyingResult[];
  events: RaceEvent[];
  track: Track;
  raceWeather?: WeatherState;
  packageLabel?: string;
  setupKnowledge: number;
  tyreKnowledge: number;
  reliabilityKnowledge: number;
  unresolvedTechnicalCases: number;
  unresolvedPaddockDecisions: number;
}): PostRaceCausalDebrief {
  const classified = input.playerResults.filter((result) => result.position !== null);
  const placeChanges = classified.map((result) => result.gridPosition - (result.position ?? result.gridPosition));
  const netPlaces = placeChanges.reduce((sum, change) => sum + change, 0);
  const incidentCount = input.events.filter((event) => event.category === 'incident').length
    + input.playerResults.reduce((sum, result) => sum + result.incidents.length, 0);
  const knowledge = [
    ['Setup', input.setupKnowledge],
    ['Tyres', input.tyreKnowledge],
    ['Reliability', input.reliabilityKnowledge],
  ] as const;
  const weakestKnowledge = knowledge.reduce((weakest, current) => current[1] < weakest[1] ? current : weakest);
  const topDemand = topTrackDemand(input.track);
  const weather = input.raceWeather?.condition ?? 'Unknown conditions';
  const weatherDetail = input.raceWeather?.wet
    ? 'Wet running increased the value of flexible tyre and pit decisions.'
    : 'A dry race put more weight on pace, track fit, and execution.';

  const evidence: DebriefEvidence[] = [
    {
      label: 'Race trajectory',
      value: netPlaces > 0 ? `+${netPlaces} places` : netPlaces < 0 ? `${netPlaces} places` : 'Held position',
      detail: classified.length > 0
        ? 'Measured from each player car’s starting grid position to its classified finish.'
        : 'No player car was classified.',
      tone: netPlaces > 0 ? 'positive' : netPlaces < 0 ? 'warning' : 'neutral',
    },
    {
      label: 'Qualifying baseline',
      value: input.qualifyingResults.length > 0 ? `P${Math.min(...input.qualifyingResults.map((result) => result.position))}` : 'Unavailable',
      detail: 'The starting position is the clearest stored measure of one-lap preparation.',
      tone: input.qualifyingResults.length > 0 ? 'neutral' : 'warning',
    },
    {
      label: 'Track demand',
      value: topDemand,
      detail: `${input.track.name} rewarded this area most strongly in the track profile.`,
      tone: 'neutral',
    },
    {
      label: 'Race conditions',
      value: weather,
      detail: weatherDetail,
      tone: input.raceWeather?.wet ? 'warning' : 'neutral',
    },
    {
      label: 'Preparation package',
      value: input.packageLabel ?? 'Not recorded',
      detail: 'This is the selected operational package; it affects preparation, cost, and risk trade-offs.',
      tone: 'neutral',
    },
    {
      label: 'Reliability signals',
      value: incidentCount === 0 ? 'No recorded incidents' : `${incidentCount} incident signal${incidentCount === 1 ? '' : 's'}`,
      detail: input.unresolvedTechnicalCases > 0
        ? `${input.unresolvedTechnicalCases} technical case${input.unresolvedTechnicalCases === 1 ? '' : 's'} still carry forward risk.`
        : 'No unresolved technical case is currently carrying forward risk.',
      tone: input.unresolvedTechnicalCases > 0 || incidentCount > 0 ? 'warning' : 'positive',
    },
    {
      label: 'Knowledge gap',
      value: `${weakestKnowledge[0]} ${Math.round(weakestKnowledge[1] * 100)}%`,
      detail: 'The lowest practice knowledge is the clearest preparation priority for the next weekend.',
      tone: weakestKnowledge[1] < 0.5 ? 'warning' : 'neutral',
    },
  ];

  const summary = netPlaces > 0
    ? `The team converted its starting position into ${netPlaces} net place${netPlaces === 1 ? '' : 's'} gained.`
    : netPlaces < 0
      ? `The team lost ${Math.abs(netPlaces)} net place${Math.abs(netPlaces) === 1 ? '' : 's'} from the grid to the finish.`
      : 'The team finished broadly where it started, so the stored evidence points to execution and preparation rather than a major race swing.';

  const followUps: DebriefFollowUp[] = [];
  if (input.unresolvedTechnicalCases > 0) {
    followUps.push({
      label: 'Review technical risk',
      route: `/post-race/${input.raceId}?tab=investigation`,
      reason: 'Resolve the open failure case before its reliability penalty carries into the next race.',
    });
    followUps.push({
      label: 'Open Technical Center',
      route: '/technical?section=parts',
      reason: 'Inspect worn or damaged parts and factory readiness.',
    });
  }
  if (input.unresolvedPaddockDecisions > 0) {
    followUps.push({
      label: 'Open Paddock decisions',
      route: '/paddock?tab=decisions',
      reason: 'Continue the next management week with unresolved decisions first.',
    });
  }

  return {
    title: 'Why the result moved',
    summary,
    evidence,
    followUps,
  };
}

function topTrackDemand(track: Track): string {
  const demands: Array<[string, number]> = [
    ['Power', track.setupProfile.powerDemand],
    ['Aero', track.setupProfile.aeroDemand],
    ['Mechanical', track.setupProfile.mechanicalDemand],
  ];
  return demands.sort((a, b) => b[1] - a[1])[0][0];
}
