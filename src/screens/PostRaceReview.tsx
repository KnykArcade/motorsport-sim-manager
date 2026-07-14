import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { getTrackById } from '../data';
import { buildPostRaceSummary, getCareerPhase, getOrCreatePhaseState } from '../game/careerPhaseEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RaceResultTable } from '../components/RaceResultTable';
import { StandingsTable } from '../components/StandingsTable';
import { NewsPanel } from '../components/NewsPanel';
import { formatMoney } from '../components/ui';
import type { GameState } from '../game/careerState';
import type { GameAction } from '../game/gameReducer';
import type { FailureInvestigationLevel, FailureResponse } from '../types/phase18Types';
import { FAILURE_INVESTIGATION_COST, FAILURE_RESPONSE_COST, confidenceLabel, failureCasesForRace } from '../sim/phase18FailureInvestigationEngine';

type ReviewTab = 'overview' | 'classification' | 'incidents' | 'investigation' | 'championships';

export function PostRaceReview() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('overview');
  const { raceId } = useParams();
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state || !raceId) return null;

  const race = state.calendar.find((r) => r.id === raceId);
  const results = state.completedRaceResults[raceId];
  const events = state.raceEvents[raceId] ?? [];
  const track = race ? getTrackById(race.trackId) : undefined;
  if (!race || !results) return null;

  // Determine if this is the active post-race review (matches lastCompletedRaceId
  // and current phase is post_race_review). Old races are read-only.
  const phaseState = getOrCreatePhaseState(state);
  const currentPhase = getCareerPhase(state);
  const isActiveReview =
    currentPhase === 'post_race_review' &&
    phaseState.lastCompletedRaceId === raceId;

  const summary = isActiveReview ? buildPostRaceSummary(state) : null;

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((d) => d.id === id)?.teamId ?? '');
  const playerDriverIds = state.drivers.filter((d) => d.teamId === state.selectedTeamId).map((d) => d.id);

  const continueToPaddock = () => {
    dispatch({ type: 'ADVANCE_TO_PADDOCK_WEEK' });
    navigate('/paddock');
  };

  const playerResults = results.filter((r) => r.teamId === state.selectedTeamId);
  const bestFinish = playerResults.reduce(
    (best, r) => (r.position !== null && (best === null || r.position < best) ? r.position : best),
    null as number | null,
  );

  // For historical reviews, calculate points from stored results since
  // buildPostRaceSummary is only available for the active review.
  const historicalPoints = isActiveReview ? null : playerResults.reduce((sum, r) => sum + r.points, 0);
  const failureCases = failureCasesForRace(state, raceId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Post-Race Review</h1>
          <p className="text-sm text-neutral-400">
            {race.gpName} · {race.trackName} · Round {race.round}
            {!isActiveReview && <span className="ml-2 text-xs text-neutral-500">· Historical (read-only)</span>}
          </p>
        </div>
        {isActiveReview && (
          state.seasonComplete ? (
            <Button variant="primary" onClick={() => navigate('/season-review')}>Season Review →</Button>
          ) : (
            <Button variant="primary" onClick={continueToPaddock}>Continue to Paddock Week →</Button>
          )
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Points Scored" value={String(isActiveReview ? (summary?.pointsGained ?? 0) : (historicalPoints ?? 0))} />
        <KpiCard label="Best Finish" value={bestFinish !== null ? `P${bestFinish}` : '—'} />
        {isActiveReview && (
          <KpiCard label="Budget Impact" value={formatMoney(summary?.budgetImpact ?? 0)} />
        )}
        {isActiveReview && (
          <KpiCard label="Car Condition" value={`${Math.round(summary?.carCondition ?? 0)}%`} />
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1">
        {([
          ['overview', 'Overview'], ['classification', 'Classification'], ['incidents', 'Incidents'],
          ['investigation', `Investigation${failureCases.some((item) => item.teamId === state.selectedTeamId && item.status !== 'Resolved') ? ' •' : ''}`],
          ['championships', 'Championships'],
        ] as Array<[ReviewTab, string]>).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} className={`rounded px-3 py-2 text-xs font-semibold transition ${activeTab === id ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}>{label}</button>
        ))}
      </div>

      {activeTab === 'investigation' && (
        <FailureInvestigationPanel state={state} raceId={raceId} isActiveReview={isActiveReview} dispatch={dispatch} />
      )}

      {activeTab !== 'investigation' && <div className={`grid gap-6 ${activeTab === 'overview' ? 'xl:grid-cols-5' : ''}`}>
        <div className={`space-y-6 ${activeTab === 'overview' ? 'xl:col-span-3' : ''}`}>
          {activeTab === 'classification' && <Panel title="Race Classification">
            <RaceResultTable
              results={results}
              nameOf={driverName}
              teamNameOf={teamName}
              colorOf={teamColor}
              highlightTeamId={state.selectedTeamId}
            />
          </Panel>}

          {activeTab === 'overview' && track && (
            <Panel title="Track Impact">
              <p className="text-sm text-neutral-300">
                {race.trackName} rewarded {topDemand(track)}. {track.setupProfile.strategyNotes}
              </p>
            </Panel>
          )}

          {activeTab === 'incidents' && <Panel title="Race Event Log">
            {events.length === 0 ? (
              <p className="text-sm text-neutral-500">Quiet race — no major incidents.</p>
            ) : (
              <ul className="space-y-1.5">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-14 shrink-0 text-xs font-semibold text-neutral-500">Lap {e.lap}</span>
                    <span className="text-neutral-300">{e.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>}

          {activeTab === 'incidents' && summary && summary.damageNotes.length > 0 && (
            <Panel title="Damage & Repairs">
              <ul className="space-y-1.5">
                {summary.damageNotes.map((note, i) => (
                  <li key={i} className="text-sm text-orange-300">{note}</li>
                ))}
              </ul>
            </Panel>
          )}

          {activeTab === 'overview' && summary && summary.devMessages.length > 0 && (
            <Panel title="Development Updates">
              <ul className="space-y-1.5">
                {summary.devMessages.map((msg, i) => (
                  <li key={i} className="text-sm text-neutral-300">{msg}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {(activeTab === 'overview' || activeTab === 'championships') && <div className={`space-y-4 ${activeTab === 'overview' ? 'xl:col-span-2' : ''}`}>
          {activeTab === 'overview' && <Panel title="Driver Performance">
            <ul className="space-y-2">
              {playerResults.map((r) => {
                const driver = state.drivers.find((d) => d.id === r.driverId);
                const rating = raceRatingText(r, results.length);
                return (
                  <li key={r.driverId} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-200">{driver?.name ?? r.driverId}</span>
                      <span className={r.status === 'DNF' || r.status === 'DSQ' ? 'text-red-400' : 'text-neutral-300'}>
                        {r.status === 'DNF' || r.status === 'DSQ' ? r.status : `P${r.position}`} · {r.points} pts
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/35 px-2 py-1 text-xs">
                      <span className="text-neutral-500">Race rating</span>
                      <span className="font-semibold tabular-nums text-amber-300">{rating}/10</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>}

          {activeTab === 'championships' && <Panel title="Championship Impact">
            <p className="text-sm text-neutral-300">
              Constructors' position: <span className="font-semibold text-neutral-100">
                {isActiveReview
                  ? `P${summary?.constructorPosition ?? '—'}`
                  : `P${state.constructorStandings.findIndex((s) => s.entityId === state.selectedTeamId) + 1 || '—'}`}
              </span>
              {' '}({isActiveReview ? (summary?.constructorPoints ?? 0) : (state.constructorStandings.find((s) => s.entityId === state.selectedTeamId)?.points ?? 0)} pts)
            </p>
          </Panel>}

          {activeTab === 'overview' && <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <NewsPanel
              news={state.news}
              title="Race Reaction"
              maxItems={4}
              categoryFilter={['race_result', 'post_race']}
              emptyMessage="No race reaction stories yet."
            />
            <NewsPanel
              news={state.news}
              title="Championship & Paddock"
              maxItems={4}
              categoryFilter={['championship', 'paddock', 'financial', 'ai_team', 'development', 'driver_market', 'youth_academy']}
              emptyMessage="No paddock or championship stories yet."
            />
          </div>}

          {activeTab === 'championships' && <div className="grid gap-4 lg:grid-cols-2">
            <StandingsTable
              title="Drivers' Championship"
              entries={state.driverStandings.slice(0, 8)}
              nameOf={driverName}
              subtitleOf={teamOfDriver}
              highlightId={playerDriverIds[0]}
            />
            <StandingsTable
              title="Constructors' Championship"
              entries={state.constructorStandings.slice(0, 8)}
              nameOf={teamName}
              colorOf={teamColor}
              highlightId={state.selectedTeamId}
            />
          </div>}
        </div>}
      </div>}
    </div>
  );
}

function FailureInvestigationPanel({ state, raceId, isActiveReview, dispatch }: { state: GameState; raceId: string; isActiveReview: boolean; dispatch: (action: GameAction) => void }) {
  const [tab, setTab] = useState<'team' | 'rivals' | 'history'>('team');
  const cases = failureCasesForRace(state, raceId);
  const teamCases = cases.filter((item) => item.teamId === state.selectedTeamId);
  const rivalCases = cases.filter((item) => item.teamId !== state.selectedTeamId);
  const budget = state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0;
  const driverName = (id?: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id ?? 'Unknown driver';
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const levelLabel = (level: FailureInvestigationLevel) => level === 'QuickReview' ? 'Quick review' : level === 'StandardInvestigation' ? 'Standard investigation' : 'Full technical investigation';
  const responseLabel = (response: FailureResponse) => response.replace(/([A-Z])/g, ' $1').trim();

  return <Panel title="Failure Investigation">
    <div className="mb-4 flex flex-wrap gap-1 border-b border-neutral-800 pb-3">
      {([['team', `Your Team (${teamCases.length})`], ['rivals', `AI Activity (${rivalCases.length})`], ['history', 'History']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded px-3 py-1.5 text-xs font-semibold ${tab === id ? 'bg-sky-500/20 text-sky-200' : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'}`}>{label}</button>)}
    </div>

    {tab === 'team' && (teamCases.length === 0 ? <p className="text-sm text-neutral-500">No failure investigation was triggered for your team in this race.</p> : <div className="grid gap-3 lg:grid-cols-2">
      {teamCases.map((item) => <div key={item.id} className={`rounded-lg border p-4 ${item.status === 'Resolved' ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-orange-500/35 bg-orange-500/5'}`}>
        <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-neutral-100">{driverName(item.driverId)} · {item.trigger.replace(/([A-Z])/g, ' $1').trim()}</div><p className="mt-1 text-xs text-neutral-400">{item.incidentSummary}</p></div><span className="rounded bg-neutral-950/60 px-2 py-1 text-[10px] uppercase text-neutral-400">{item.status.replace(/([A-Z])/g, ' $1').trim()}</span></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><InvestigationFact label="Initial suspicion" value={item.suspectedCause.replace(/([A-Z])/g, ' $1').trim()} /><InvestigationFact label="Confidence" value={`${item.confidence}% · ${confidenceLabel(item.confidence)}`} /><InvestigationFact label="Repeat count" value={String(item.repeatedIssueCount)} /></div>
        {item.status === 'AwaitingInvestigation' && isActiveReview && <div className="mt-4"><div className="mb-2 text-[11px] text-amber-200">Choose depth: higher accuracy costs more. Continuing without a review leaves a reliability penalty active.</div><div className="flex flex-wrap gap-2">{(['QuickReview', 'StandardInvestigation', 'FullTechnicalInvestigation'] as FailureInvestigationLevel[]).map((level) => <Button key={level} variant={level === 'StandardInvestigation' ? 'primary' : 'ghost'} className="px-2 py-1 text-[10px]" disabled={budget < FAILURE_INVESTIGATION_COST[level]} onClick={() => dispatch({ type: 'INVESTIGATE_FAILURE', caseId: item.id, level })}>{levelLabel(level)} · {formatMoney(FAILURE_INVESTIGATION_COST[level])}</Button>)}</div></div>}
        {item.finding && <div className="mt-4 rounded border border-sky-500/25 bg-sky-500/5 p-3"><div className="text-[10px] uppercase text-sky-300">Finding</div><div className="mt-1 font-semibold text-neutral-100">{item.finding.replace(/([A-Z])/g, ' $1').trim()}</div><p className="mt-1 text-xs text-neutral-400">Confidence is {confidenceLabel(item.confidence)}. Unresolved risk: {item.unresolvedRisk}/12.</p></div>}
        {item.status === 'FindingsReady' && isActiveReview && <div className="mt-3 flex flex-wrap gap-2">{(['RepairProperly', 'RushRepair', 'ReplacePart', 'DetunePackage', 'DefendDriver', 'BlameSupplier', 'HideIssue'] as FailureResponse[]).map((response) => <Button key={response} variant={response === 'RepairProperly' ? 'primary' : 'ghost'} className="px-2 py-1 text-[10px]" disabled={budget < FAILURE_RESPONSE_COST[response]} onClick={() => dispatch({ type: 'RESPOND_TO_FAILURE', caseId: item.id, response })}>{responseLabel(response)}{FAILURE_RESPONSE_COST[response] ? ` · ${formatMoney(FAILURE_RESPONSE_COST[response])}` : ''}</Button>)}</div>}
        {item.consequenceSummary && <p className="mt-3 text-xs text-neutral-300">{item.consequenceSummary}</p>}
      </div>)}
    </div>)}

    {tab === 'rivals' && (rivalCases.length === 0 ? <p className="text-sm text-neutral-500">No rival failure investigations were reported.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rivalCases.map((item) => <div key={item.id} className="rounded border border-neutral-800 bg-neutral-900/45 p-3"><div className="font-semibold text-neutral-100">{teamName(item.teamId)}</div><div className="mt-1 text-xs text-neutral-400">{item.trigger.replace(/([A-Z])/g, ' $1').trim()} · {item.investigationLevel ? levelLabel(item.investigationLevel) : 'Review pending'}</div><p className="mt-2 text-xs text-neutral-300">{item.response ? `${responseLabel(item.response)} selected.` : 'Response not yet known.'}</p><p className="mt-2 text-[10px] text-neutral-500">{item.aiDecisionReason ?? 'AI response based on team circumstances.'}</p></div>)}</div>)}

    {tab === 'history' && <div className="space-y-1.5">{(state.phase18?.failureInvestigations?.history ?? []).slice().reverse().slice(0, 12).map((entry, index) => <div key={`${entry}-${index}`} className="rounded bg-neutral-900/45 px-3 py-2 text-xs text-neutral-400">{entry}</div>)}{!(state.phase18?.failureInvestigations?.history.length) && <p className="text-sm text-neutral-500">No investigation history yet.</p>}</div>}
  </Panel>;
}

function InvestigationFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-neutral-950/45 p-2"><div className="text-[9px] uppercase text-neutral-600">{label}</div><div className="mt-1 text-neutral-300">{value}</div></div>;
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function topDemand(track: NonNullable<ReturnType<typeof getTrackById>>): string {
  const demands: [string, number][] = [
    ['engine power', track.setupProfile.powerDemand],
    ['aero efficiency', track.setupProfile.aeroDemand],
    ['mechanical grip', track.setupProfile.mechanicalDemand],
  ];
  demands.sort((a, b) => b[1] - a[1]);
  return `${demands[0][0]} and ${demands[1][0]}`;
}

function raceRatingText(
  result: { rating?: number; position: number | null; gridPosition: number; status: string },
  fieldSize: number,
): string {
  if (typeof result.rating === 'number') return result.rating.toFixed(1);
  if (result.status === 'DNF' || result.status === 'DSQ') return '4.0';
  const finish = result.position ?? fieldSize;
  const movement = result.gridPosition - finish;
  const base = 6.4 + movement * 0.18 + (fieldSize - finish) * 0.08;
  return Math.max(1, Math.min(10, base)).toFixed(1);
}
