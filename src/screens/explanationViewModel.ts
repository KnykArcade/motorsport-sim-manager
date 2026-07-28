import type { GameState } from '../game/careerState';
import { confidencePerformanceModifier } from '../sim/driverConfidenceEngine';
import { intelligenceConfidenceLabel } from '../sim/phase18IntelligenceEngine';
import type { Driver } from '../types/gameTypes';
import type { Track } from '../types/gameTypes';
import type { DriverRelationship } from '../types/relationshipTypes';
import { calculateSetupFit } from '../sim/setupFitEngine';
import { BALANCED_SETUP } from '../data/setup/setupComponents';

export type ExplanationConfidence = 'High' | 'Medium' | 'Low' | 'Unavailable';
export type ExplanationTone = 'positive' | 'negative' | 'neutral' | 'uncertain';

export type ExplanationCause = {
  label: string;
  detail: string;
  impact?: number;
  tone: ExplanationTone;
  source: string;
  duration: string;
};

export type MetricExplanation = {
  id: string;
  label: string;
  previousValue?: number;
  currentValue: number;
  unit: string;
  confidence: ExplanationConfidence;
  summary: string;
  causes: ExplanationCause[];
  modifiers: string[];
  downstreamEffects: string[];
  previousValueReason?: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function currentRound(state: GameState): number {
  return state.calendar[state.currentRaceIndex]?.round ?? state.careerPhase?.currentRound ?? 0;
}

function latestPlayerResult(state: GameState, driverId: string) {
  return [...state.calendar].reverse().flatMap((race) => {
    const result = state.completedRaceResults[race.id]?.find((entry) => entry.driverId === driverId);
    return result ? [{ race, result }] : [];
  })[0];
}

function interactionCauses(state: GameState, driverId: string, metric: 'confidence' | 'morale' | 'trust'): ExplanationCause[] {
  const records = (state.characterInteractions?.history ?? [])
    .filter((record) => record.targetType === 'Driver' && record.targetId === driverId)
    .slice(-4)
    .reverse();
  const keyword = metric === 'confidence' ? /confidence/i : metric === 'morale' ? /morale/i : /trust/i;
  return records.flatMap((record) => record.effects.filter((effect) => keyword.test(effect)).map((effect) => {
    const delta = Number(effect.match(/([+-]\d+(?:\.\d+)?)/)?.[1]);
    return {
      label: record.actionLabel,
      detail: effect,
      impact: Number.isFinite(delta) ? delta : undefined,
      tone: !Number.isFinite(delta) ? 'neutral' as const : delta > 0 ? 'positive' as const : delta < 0 ? 'negative' as const : 'neutral' as const,
      source: `Recorded interaction · Round ${record.round}`,
      duration: 'Persists until later results or interactions change it',
    };
  }));
}

function raceCause(state: GameState, driver: Driver): ExplanationCause | undefined {
  const latest = latestPlayerResult(state, driver.id);
  if (!latest) return undefined;
  const expected = Math.max(1, Math.round((state.drivers.length + 1) * (1 - driver.ratings.overall / 110)));
  const position = latest.result.position ?? state.drivers.length;
  const impact = expected - position;
  return {
    label: `${latest.race.gpName} result`,
    detail: `${latest.result.status === 'Finished' ? `P${position}` : latest.result.status} versus an approximate P${expected} expectation from current ability.`,
    impact: Math.max(-6, Math.min(6, impact)),
    tone: impact > 1 ? 'positive' : impact < -1 || latest.result.status !== 'Finished' ? 'negative' : 'neutral',
    source: `Official race classification · Round ${latest.race.round}`,
    duration: 'Carries into the next race review and then decays through new evidence',
  };
}

function inferredPrevious(current: number, causes: ExplanationCause[]): number | undefined {
  const latest = causes.find((cause) => cause.impact != null);
  return latest?.impact == null ? undefined : clamp(current - latest.impact);
}

function relationshipFor(state: GameState, driver: Driver): DriverRelationship | undefined {
  return state.driverRelationships?.[driver.id];
}

export function driverConfidenceExplanation(state: GameState, driver: Driver): MetricExplanation {
  const relationship = relationshipFor(state, driver);
  const current = clamp(relationship?.selfConfidence ?? driver.confidence);
  const recorded = interactionCauses(state, driver.id, 'confidence');
  const race = raceCause(state, driver);
  const causes = [...recorded, ...(race ? [race] : [])].slice(0, 4);
  const modifier = relationship ? confidencePerformanceModifier(relationship) : 1;
  return {
    id: `driver:${driver.id}:confidence`,
    label: `${driver.name} confidence`,
    previousValue: inferredPrevious(current, causes),
    currentValue: current,
    unit: '%',
    confidence: causes.length ? 'High' : 'Medium',
    summary: current >= 70 ? 'The driver is carrying strong self-belief into the next event.' : current < 40 ? 'Recent evidence has left the driver vulnerable to pressure and inconsistency.' : 'Confidence is inside a stable competitive range.',
    causes: causes.length ? causes : [{
      label: 'Current relationship baseline',
      detail: 'No recent recorded event isolates the last movement, so the game can confirm the value but not attribute a precise change.',
      tone: 'uncertain',
      source: 'Current driver relationship',
      duration: 'Reassessed after races, promises, and direct interactions',
    }],
    modifiers: [
      ...(relationship?.personalityTraits.map((trait) => `${trait} personality`) ?? []),
      ...(relationship?.wants.map((want) => `Active want: ${want.replace(/_/g, ' ')}`) ?? []),
    ].slice(0, 6),
    downstreamEffects: [
      `Current confidence contributes to an on-track mental performance multiplier of ${modifier.toFixed(3)}× when combined with trust and morale.`,
      'Confidence also affects development wellbeing and how strongly the driver reacts to pressure.',
    ],
    previousValueReason: 'A prior value appears only when a recorded cause includes a numeric impact; otherwise it is intentionally not reconstructed.',
  };
}

export function driverMoraleExplanation(state: GameState, driver: Driver): MetricExplanation {
  const relationship = relationshipFor(state, driver);
  const current = clamp(relationship?.morale ?? driver.morale);
  const recorded = interactionCauses(state, driver.id, 'morale');
  const race = raceCause(state, driver);
  const promises = (state.driverPromises ?? []).filter((promise) => promise.driverId === driver.id && promise.status !== 'cancelled').slice(-3);
  const promiseCauses: ExplanationCause[] = promises.map((promise) => ({
    label: `${promise.promiseType.replace(/_/g, ' ')} promise`,
    detail: promise.status === 'active' ? 'The promise remains active and continues to shape expectations.' : `The promise is ${promise.status}; its recorded morale impact is ${promise.moraleImpact > 0 ? '+' : ''}${promise.moraleImpact}.`,
    impact: promise.status === 'active' ? undefined : promise.moraleImpact,
    tone: promise.status === 'kept' ? 'positive' : promise.status === 'broken' || promise.status === 'expired' ? 'negative' : 'neutral',
    source: `Driver promise · ${promise.status}`,
    duration: promise.status === 'active' ? 'Until its due date or resolution' : 'Persistent relationship memory',
  }));
  const causes = [...recorded, ...promiseCauses, ...(race ? [race] : [])].slice(0, 5);
  return {
    id: `driver:${driver.id}:morale`,
    label: `${driver.name} morale`,
    previousValue: inferredPrevious(current, causes),
    currentValue: current,
    unit: '%',
    confidence: causes.length ? 'High' : 'Medium',
    summary: current >= 70 ? 'The driver is positive about their current situation.' : current < 40 ? 'The driver is dissatisfied and requires management attention.' : 'Morale is stable but can still move with role, promises, and results.',
    causes: causes.length ? causes : [{
      label: 'Current morale baseline',
      detail: 'No recent stored event provides a defensible numeric cause for the latest value.',
      tone: 'uncertain',
      source: 'Current driver state',
      duration: 'Reassessed as the season progresses',
    }],
    modifiers: relationship?.wants.map((want) => `Expectation: ${want.replace(/_/g, ' ')}`) ?? [],
    downstreamEffects: [
      'Morale contributes to contract willingness, development wellbeing, retirement decisions, and race-result reactions.',
      'Low morale also increases the chance that relationship pressure becomes a blocking management issue.',
    ],
    previousValueReason: 'The prior value is shown only when a stored interaction or resolved promise exposes its numeric effect.',
  };
}

export function driverTrustExplanation(state: GameState, driver: Driver): MetricExplanation {
  const relationship = relationshipFor(state, driver);
  const current = clamp(relationship?.trustInPrincipal ?? 50);
  const recorded = interactionCauses(state, driver.id, 'trust');
  const activePromises = (state.driverPromises ?? []).filter((promise) => promise.driverId === driver.id && promise.status === 'active');
  const causes: ExplanationCause[] = [
    ...recorded,
    ...activePromises.map((promise) => ({
      label: `Active ${promise.promiseType.replace(/_/g, ' ')} promise`,
      detail: `Trust exposure ${promise.trustImpact > 0 ? '+' : ''}${promise.trustImpact} if resolved as recorded.`,
      tone: 'neutral' as const,
      source: `Promise made in ${promise.madeSeason}, round ${promise.madeRound}`,
      duration: 'Until the promise is kept, broken, or expires',
    })),
  ].slice(0, 5);
  return {
    id: `driver:${driver.id}:trust`,
    label: `${driver.name} trust in principal`,
    previousValue: inferredPrevious(current, causes),
    currentValue: current,
    unit: '%',
    confidence: relationship ? 'High' : 'Unavailable',
    summary: current >= 70 ? 'The driver broadly trusts team decisions and support.' : current < 40 ? 'The driver doubts the team and is more likely to resist difficult calls.' : 'Trust is workable but still sensitive to promises and treatment.',
    causes: causes.length ? causes : [{
      label: 'No isolated recent cause',
      detail: 'The current relationship is known, but the save does not retain a separate numeric audit event for its latest movement.',
      tone: 'uncertain',
      source: 'Current driver relationship',
      duration: 'Persistent until changed by decisions',
    }],
    modifiers: [
      `Trust in car ${relationship?.trustInCar ?? 50}%`,
      `Trust in team ${relationship?.trustInTeam ?? 50}%`,
      `Team trust in driver ${relationship?.teamTrustInDriver ?? 50}%`,
    ],
    downstreamEffects: [
      'Trust affects resistance to strategy and team orders, contract willingness, requests, and the driver mental-performance modifier.',
      'Low trust makes staff escalation and direct management intervention more important.',
    ],
    previousValueReason: 'The game does not invent a previous value when no stored action exposes the last numeric trust delta.',
  };
}

export function teamMoraleExplanation(state: GameState): MetricExplanation {
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const current = clamp(team?.morale ?? 50);
  const latestNews = state.news.filter((item) => item.teamId === state.selectedTeamId || !item.teamId).slice(0, 4);
  const causes: ExplanationCause[] = latestNews.map((item) => ({
    label: item.headline,
    detail: item.body ?? 'Recent team event retained in the news record.',
    tone: item.priority === 'high' ? 'negative' : 'neutral',
    source: `Team news · Round ${item.round ?? currentRound(state)}`,
    duration: 'Context only; no exact numeric contribution is claimed',
  }));
  return {
    id: `team:${state.selectedTeamId}:morale`,
    label: `${team?.name ?? 'Team'} morale`,
    currentValue: current,
    unit: '%',
    confidence: causes.length ? 'Medium' : 'Low',
    summary: current >= 70 ? 'The organization is operating with positive internal momentum.' : current < 40 ? 'Team mood is under strain and may weaken preparation.' : 'The organization is broadly stable.',
    causes: causes.length ? causes : [{
      label: 'No recent attributable record',
      detail: 'The current value is authoritative, but recent team-level events do not expose numeric morale deltas.',
      tone: 'uncertain',
      source: 'Current team state',
      duration: 'Reassessed through results and management decisions',
    }],
    modifiers: Object.values(state.phase18?.departmentMoods?.[state.selectedTeamId] ?? {}).map((mood) => `${mood.departmentId}: ${Math.round(mood.morale)}% morale`).slice(0, 6),
    downstreamEffects: [
      'Team morale feeds driver wants, organizational pressure, and department preparation effectiveness.',
      'Department mood can strengthen or weaken race preparation even when the headline team value is stable.',
    ],
    previousValueReason: 'Team-level history currently stores context rather than a numeric morale ledger, so no previous value is fabricated.',
  };
}

export function teamReputationExplanation(state: GameState): MetricExplanation {
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const current = clamp(reputation?.reputation ?? team?.reputation ?? 50);
  const latestReview = [...(state.expectationReviews ?? [])].reverse().find((review) => review.teamId === state.selectedTeamId);
  const reviewLabel = latestReview
    ? latestReview.score >= 20 ? 'Strong review' : latestReview.score <= -20 ? 'Concern review' : 'Acceptable review'
    : undefined;
  const causes: ExplanationCause[] = latestReview ? [{
    label: reviewLabel!,
    detail: latestReview.summary,
    tone: latestReview.score >= 20 ? 'positive' : latestReview.score <= -20 ? 'negative' : 'neutral',
    source: `Owner expectation review · ${latestReview.seasonYear}`,
    duration: 'Until the next formal performance review',
  }] : [];
  return {
    id: `team:${state.selectedTeamId}:reputation`,
    label: `${team?.name ?? 'Team'} reputation`,
    currentValue: current,
    unit: '%',
    confidence: reputation ? 'High' : 'Medium',
    summary: current >= 75 ? 'The team carries front-running prestige across the paddock.' : current < 40 ? 'The team has limited pull with elite staff, drivers, and partners.' : 'The team has credible but not dominant paddock standing.',
    causes: causes.length ? causes : [{
      label: 'Long-term paddock standing',
      detail: 'No recent formal review is available to isolate the latest movement.',
      tone: 'uncertain',
      source: 'Team reputation profile',
      duration: 'Slow-moving, multi-season measure',
    }],
    modifiers: reputation ? [
      `Sponsor confidence ${reputation.sponsorConfidence}%`,
      `Financial stability ${reputation.financialStability}%`,
      `Fan expectation ${reputation.fanExpectation}%`,
      `Owner patience ${reputation.ownerPatience}%`,
    ] : [],
    downstreamEffects: [
      'Reputation affects driver and staff attraction, commercial expectations, politics, and owner pressure.',
      'It also influences how quickly poor results become a public or board-level concern.',
    ],
    previousValueReason: 'Reputation is slow-moving, but the existing save does not retain a per-change numeric ledger.',
  };
}

export function scoutingUncertaintyExplanation(state: GameState, subjectLabel = 'Scouting knowledge'): MetricExplanation {
  const current = clamp((state.scouting?.networkAccuracy ?? 0.15) * 100);
  return {
    id: `scouting:${state.selectedTeamId}:accuracy`,
    label: subjectLabel,
    currentValue: current,
    unit: '%',
    confidence: 'High',
    summary: `${current}% is the current network baseline before target-specific scouting effort is applied.`,
    causes: [{
      label: 'Scouting network coverage',
      detail: 'Facilities and accumulated target effort determine how narrow each displayed rating range becomes.',
      impact: current,
      tone: current >= 65 ? 'positive' : current < 35 ? 'negative' : 'neutral',
      source: 'Saved scouting state',
      duration: 'Until the network or target scouting level changes',
    }],
    modifiers: [
      `Network baseline ${current}%`,
      `${Object.keys(state.scouting?.reports ?? {}).length} stored target report${Object.keys(state.scouting?.reports ?? {}).length === 1 ? '' : 's'}`,
    ],
    downstreamEffects: [
      'Higher accuracy narrows rating ranges and reduces the risk of overvaluing a recruitment target.',
      'Unknown traits remain unknown until the required scouting threshold is reached.',
    ],
    previousValueReason: 'The current scouting model stores the present network level but not a historical network-level ledger.',
  };
}

export function intelligenceExplanation(state: GameState, reportId: string): MetricExplanation | undefined {
  const report = state.phase18?.intelligenceReports.find((entry) => entry.id === reportId);
  if (!report) return undefined;
  return {
    id: `intelligence:${report.id}`,
    label: report.title,
    currentValue: clamp(report.confidence),
    unit: '%',
    confidence: report.assessment === 'Confirmed' || report.assessment === 'Disproven' ? 'High' : report.confidence >= 68 ? 'Medium' : 'Low',
    summary: `${report.assessment} intelligence from ${report.source}; ${intelligenceConfidenceLabel(report.confidence).toLowerCase()} confidence and ${report.reliability}% source reliability.`,
    causes: [
      {
        label: `${report.source} report`,
        detail: report.summary,
        impact: report.confidence,
        tone: report.assessment === 'Confirmed' ? 'positive' : report.assessment === 'Disproven' ? 'negative' : 'uncertain',
        source: `Discovered ${report.discoveredSeasonYear}, round ${report.discoveredRound ?? '—'}`,
        duration: report.status === 'Active' ? `Expires ${report.expiresSeasonYear ?? state.seasonYear}, round ${report.expiresRound ?? '—'}` : `Report ${report.status?.toLowerCase() ?? 'resolved'}`,
      },
      ...(report.actionHistory ?? []).slice(-2).reverse().map((action) => ({
        label: action.action,
        detail: action.outcome,
        tone: 'neutral' as const,
        source: `Intelligence action · Round ${action.round ?? '—'}`,
        duration: 'Included in the current assessment',
      })),
    ],
    modifiers: [
      `Source reliability ${report.reliability}%`,
      `Detail level ${report.detailLevel ?? 'Headline'}`,
      `Visibility ${report.visibility ?? 'Private'}`,
      `Status ${report.status ?? 'Active'}`,
    ],
    downstreamEffects: [
      'Only confirmed or disproven reports should be treated as established fact.',
      'Plausible, likely, and unverified reports remain decision support—not hidden rival-state disclosure.',
    ],
    previousValueReason: 'The action history explains confidence-building work but does not retain every intermediate numeric confidence value.',
  };
}

export function setupConfidenceExplanation(state: GameState, driver: Driver, track: Track): MetricExplanation {
  const setup = state.carSetups?.[driver.id] ?? BALANCED_SETUP;
  const fit = calculateSetupFit(setup, track, driver);
  const weak = [...fit.components].sort((left, right) => left.fit - right.fit).slice(0, 3);
  const strong = [...fit.components].sort((left, right) => right.fit - left.fit).slice(0, 2);
  return {
    id: `setup:${state.seasonYear}:${track.id}:${driver.id}`,
    label: `${driver.name} setup confidence`,
    currentValue: fit.confidence,
    unit: '%',
    confidence: 'High',
    summary: `${fit.overall}/100 objective fit and ${fit.confidence}/100 driver confidence for ${track.name}.`,
    causes: [
      ...weak.map((component) => ({
        label: `${component.component.replace(/([A-Z])/g, ' $1')} fit`,
        detail: `${component.fit}/100 is one of the weakest matches between the saved setup, circuit demands, and driver preference.`,
        impact: component.fit,
        tone: component.fit < 45 ? 'negative' as const : 'neutral' as const,
        source: 'Deterministic setup-fit model',
        duration: 'Until the setup, circuit, or driver changes',
      })),
      ...strong.map((component) => ({
        label: `${component.component.replace(/([A-Z])/g, ' $1')} strength`,
        detail: `${component.fit}/100 supports the current setup window.`,
        impact: component.fit,
        tone: 'positive' as const,
        source: 'Deterministic setup-fit model',
        duration: 'Until the setup, circuit, or driver changes',
      })),
    ],
    modifiers: [
      `Driver adaptability ${Math.round(driver.ratings.adaptability)}`,
      ...fit.warnings.slice(0, 3),
    ],
    downstreamEffects: [
      `Qualifying pace effect ${fit.effects.qualifyingPace > 0 ? '+' : ''}${fit.effects.qualifyingPace.toFixed(1)}.`,
      `Race pace effect ${fit.effects.racePace > 0 ? '+' : ''}${fit.effects.racePace.toFixed(1)}; tyre wear ${fit.effects.tyreWear > 0 ? '+' : ''}${fit.effects.tyreWear.toFixed(1)}; reliability risk ${fit.effects.reliabilityRisk > 0 ? '+' : ''}${fit.effects.reliabilityRisk.toFixed(1)}.`,
    ],
    previousValueReason: 'Setup fit is recalculated from the current setup and circuit; the save does not retain the prior calculation before each edit.',
  };
}
