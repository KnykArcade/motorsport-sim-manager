import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  teamById,
  driversForTeam,
} from '../game/careerState';
import { getTrackById, getRegulationSet } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { developmentSlots } from '../sim/facilityEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { NewsPanel } from '../components/NewsPanel';
import { formatMoney } from '../components/ui';
import { isPreseasonChecklistComplete, getPreseasonApprovals } from '../game/careerPhaseEngine';
import { OWNER_PERSONALITY_LABELS, OWNER_PERSONALITY_DESCRIPTIONS } from '../types/expectationTypes';

export function PreSeasonSetup() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('teamOverview' as string);

  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const drivers = driversForTeam(state, state.selectedTeamId);
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const carRatings = car ? effectiveCarRatings(car) : null;
  const slots = developmentSlots(state.facilities);

  const isCareer = state.gameMode === 'Career';
  const isSingleSeason = state.gameMode === 'SingleSeason';

  const approvals = getPreseasonApprovals(state);
  const checklistComplete = isPreseasonChecklistComplete(state);

  // Calculate progress count.
  const approvedCount = Object.values(approvals).filter(Boolean).length;
  const totalTabs = 7;

  const advanceToBriefing = () => {
    if (!checklistComplete) return;
    dispatch({ type: 'COMPLETE_PRESEASON_SETUP' });
    navigate('/briefing');
  };

  const approveTab = (tabId: 'teamOverview' | 'budget' | 'driverLineup' | 'carDevelopment' | 'sponsorsEngine' | 'seasonObjectives' | 'roundOnePreview') => {
    dispatch({ type: 'APPROVE_PRESEASON_TAB', tabId });
  };

  // Engine supplier info.
  const engineDeal = state.engine?.deals?.[state.selectedTeamId] ?? state.engine?.currentDeal;

  // Sponsors.
  const sponsors = state.commercial?.sponsors ?? [];

  // Season objectives (from team expectations).
  const expectation = state.teamExpectations?.[state.selectedTeamId];

  // Tab definitions.
  const tabs = [
    { id: 'teamOverview', label: 'Team Overview' },
    { id: 'budget', label: 'Budget / Finance' },
    { id: 'driverLineup', label: 'Driver Lineup' },
    { id: 'carDevelopment', label: 'Car & Development' },
    { id: 'sponsorsEngine', label: 'Sponsors / Engine' },
    { id: 'seasonObjectives', label: 'Season Objectives' },
    { id: 'roundOnePreview', label: 'Round 1 Preview' },
  ];

  // Driver lineup validation: F1 requires 2 race drivers.
  const hasValidLineup = activeDrivers.length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Pre-Season Setup</h1>
          <p className="text-sm text-neutral-400">
            {state.seasonYear} {state.series} · {isCareer ? 'Career Mode' : 'Single Season'}
            {isSingleSeason && ' · Historical replay — team setup is locked'}
          </p>
        </div>
        <div className="text-sm text-neutral-400">
          Approval Progress: {approvedCount} / {totalTabs}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto border-b border-neutral-800 pb-2">
        {tabs.map((tab) => {
          const isApproved = approvals[tab.id as keyof typeof approvals];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-300'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  isApproved ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-400'
                }`}
              >
                {isApproved ? '✓' : '○'}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">

        {/* Season Preview News */}
        <div className="grid gap-4 lg:grid-cols-2">
          <NewsPanel
            news={state.news}
            title="Season Preview"
            maxItems={4}
            categoryFilter={['preseason', 'driver_market', 'financial']}
            emptyMessage="Season preview stories will appear here."
          />
          <NewsPanel
            news={state.news}
            title="Youth Academy Watch"
            maxItems={3}
            categoryFilter={['youth_academy']}
            emptyMessage="No youth academy news this season."
          />
        </div>
        {activeTab === 'teamOverview' && (
          <Panel title="Team Overview">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Team</div>
                <div className="text-sm text-neutral-200">{team?.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Reputation</div>
                <div className="text-sm text-neutral-200">{Math.round(team?.reputation ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Team Morale</div>
                <div className="text-sm text-neutral-200">{Math.round(team?.morale ?? 0)}%</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Budget</div>
                <div className="text-sm text-neutral-200">{team ? formatMoney(team.budget) : '—'}</div>
              </div>
            </div>
            {(() => {
              const regSet = getRegulationSet(state.regulationSetId);
              if (!regSet) return null;
              return (
                <div className="mt-4 rounded-lg bg-neutral-800/40 p-4 space-y-2">
                  <div className="text-xs font-semibold uppercase text-neutral-500">Season Regulations</div>
                  <div className="text-sm text-neutral-200">{regSet.eraLabel}</div>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs text-neutral-400">
                    <div>Qualifying: {regSet.qualifyingFormat}</div>
                    <div>Refueling: {regSet.refuelingAllowed ? 'Allowed' : 'Banned'}</div>
                    <div>DRS: {regSet.drsEnabled ? 'Enabled' : 'Not in use'}</div>
                    <div>Sprint: {regSet.sprintSupport ? 'Supported' : 'Not in use'}</div>
                    {regSet.pushToPass && <div>Push-to-Pass: Available</div>}
                    {regSet.budgetCap && <div>Budget Cap: ${regSet.budgetCap}M</div>}
                  </div>
                  {isSingleSeason && (
                    <div className="text-xs text-amber-300">Regulations are locked to the historical {state.seasonYear} season.</div>
                  )}
                </div>
              );
            })()}
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => approveTab('teamOverview')}
                disabled={approvals.teamOverview}
              >
                {approvals.teamOverview ? 'Confirmed' : 'Confirm Team Overview'}
              </Button>
            </div>
          </Panel>
        )}

        {activeTab === 'budget' && (
          <Panel title="Budget / Financial Review">
            <div className="text-sm text-neutral-200">{team ? formatMoney(team.budget) : '—'}</div>
            <div className="mt-2 text-xs text-neutral-500">
              Prize money per point: $250K. Budget is used for development, staff, facilities, and race packages.
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => approveTab('budget')}
                disabled={approvals.budget}
              >
                {approvals.budget ? 'Approved' : 'Approve Budget Review'}
              </Button>
            </div>
          </Panel>
        )}

        {activeTab === 'driverLineup' && (
          <Panel title="Driver Lineup Review">
            <ul className="space-y-2">
              {activeDrivers.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-200">{d.name} · #{d.number}</span>
                  <span className="text-neutral-400">
                    Overall {d.ratings.overall} · Morale {Math.round(d.morale)}%
                  </span>
                </li>
              ))}
              {drivers.length > activeDrivers.length && (
                <li className="text-xs text-neutral-500">
                  Reserve drivers: {drivers.slice(activeDrivers.length).map((d) => d.name).join(', ')}
                </li>
              )}
            </ul>
            {!hasValidLineup && (
              <div className="mt-3 rounded-lg bg-orange-950/30 p-3 text-sm text-orange-300">
                <p className="font-semibold">Incomplete Lineup</p>
                <p className="text-xs">
                  Your team requires 2 active race drivers. Visit the Driver Market to sign a second driver.
                </p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {!hasValidLineup && (
                <Button variant="secondary" onClick={() => navigate('/market')}>
                  Visit Driver Market
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => approveTab('driverLineup')}
                disabled={approvals.driverLineup || !hasValidLineup}
              >
                {approvals.driverLineup ? 'Confirmed' : 'Confirm Race Lineup'}
              </Button>
            </div>
          </Panel>
        )}

        {activeTab === 'carDevelopment' && (
          <Panel title="Car & Development Overview">
            {carRatings && (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatChip label="Power" value={carRatings.enginePower.toFixed(1)} />
                <StatChip label="Aero" value={carRatings.aeroEfficiency.toFixed(1)} />
                <StatChip label="Grip" value={carRatings.mechanicalGrip.toFixed(1)} />
                <StatChip label="Reliability" value={carRatings.reliability.toFixed(1)} />
                <StatChip label="Pit Crew" value={carRatings.pitCrewOperations.toFixed(1)} />
              </div>
            )}
            <div className="mt-3 text-sm text-neutral-400">
              Car condition: {Math.round(car?.condition ?? 0)}%
            </div>
            <div className="mt-4 text-sm text-neutral-300">
              <span className="text-neutral-200">{slots}</span> development slot(s) available.
              {state.activeDevelopmentProjects.length > 0 && (
                <span className="text-neutral-500"> · {state.activeDevelopmentProjects.length} project(s) active.</span>
              )}
            </div>
            {isCareer && (
              <div className="mt-2 text-xs text-neutral-500">
                Visit the Development screen to assign projects to available slots.
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => approveTab('carDevelopment')}
                disabled={approvals.carDevelopment}
              >
                {approvals.carDevelopment ? 'Confirmed' : 'Confirm Development Plan'}
              </Button>
            </div>
          </Panel>
        )}

        {activeTab === 'sponsorsEngine' && (
          <Panel title="Sponsors / Engine Supplier">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500 mb-2">Sponsors</div>
                {isSingleSeason && (
                  <div className="mb-2 rounded-md bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                    Sponsors are locked to historical data for Single Season mode.
                  </div>
                )}
                {sponsors.length > 0 ? (
                  <ul className="space-y-2">
                    {sponsors.map((s) => (
                      <li key={s.id} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-200">{s.name}</span>
                        <span className="text-neutral-400">{Math.round(s.confidence)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-neutral-500">No active sponsors.</p>
                )}
                {isCareer && (
                  <div className="mt-2 text-xs text-neutral-500">
                    Visit the Sponsors screen to manage commercial deals.
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500 mb-2">Engine Supplier</div>
                {isSingleSeason && (
                  <div className="mb-2 rounded-md bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                    Engine supplier is locked to historical data for Single Season mode.
                  </div>
                )}
                {engineDeal ? (
                  <div className="space-y-1 text-sm">
                    <div className="text-neutral-200">{engineDeal.supplierName}</div>
                    <div className="text-neutral-400">Deal type: {engineDeal.dealType}</div>
                    <div className="text-xs text-green-400">Power: {engineDeal.powerRating}/10 · Reliability: {engineDeal.reliabilityRating}/10</div>
                    <div className="text-xs text-neutral-500">{engineDeal.contractYearsRemaining} year(s) remaining</div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Engine deal assigned by historical data.</p>
                )}
                {isCareer && (
                  <div className="mt-2 text-xs text-neutral-500">
                    Visit the Engine Supplier screen to review or change deals.
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => approveTab('sponsorsEngine')}
                disabled={approvals.sponsorsEngine}
              >
                {approvals.sponsorsEngine ? 'Confirmed' : 'Confirm Sponsor & Engine Setup'}
              </Button>
            </div>
          </Panel>
        )}

        {activeTab === 'seasonObjectives' && (
          <Panel title="Season Objectives">
            {expectation ? (
              <div className="space-y-1 text-sm">
                {state.teamReputations?.[state.selectedTeamId]?.ownerPersonality && (
                  <div className="mb-2 rounded bg-neutral-800/50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">Owner type</span>
                      <span className="font-semibold text-neutral-100">{OWNER_PERSONALITY_LABELS[state.teamReputations[state.selectedTeamId].ownerPersonality!]}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">{OWNER_PERSONALITY_DESCRIPTIONS[state.teamReputations[state.selectedTeamId].ownerPersonality!]}</div>
                  </div>
                )}
                <div className="text-neutral-200">{expectation.primaryObjective}</div>
                {expectation.secondaryObjectives.length > 0 && (
                  <div className="text-neutral-400">{expectation.secondaryObjectives.join(', ')}</div>
                )}
                {expectation.minimumConstructorPosition && (
                  <div className="text-xs text-neutral-500">Target: P{expectation.minimumConstructorPosition} or better</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                {isCareer ? 'Objectives will be set based on team reputation.' : 'Historical replay mode — no custom objectives.'}
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => approveTab('seasonObjectives')}
                disabled={approvals.seasonObjectives}
              >
                {approvals.seasonObjectives ? 'Confirmed' : 'Confirm Season Objective'}
              </Button>
            </div>
          </Panel>
        )}

        {activeTab === 'roundOnePreview' && (
          <Panel title="Round 1 Preview">
            {race && track ? (
              <>
                <div className="text-sm text-neutral-200">{race.gpName} — {race.trackName}</div>
                <div className="text-xs text-neutral-500">{track.archetype} · Round {race.round}</div>
                <div className="mt-3">
                  <TrackDemandBars track={track} />
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-500">Race data not available.</p>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => approveTab('roundOnePreview')}
                disabled={approvals.roundOnePreview}
              >
                {approvals.roundOnePreview ? 'Confirmed' : 'Confirm Round 1 Preview'}
              </Button>
            </div>
          </Panel>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={advanceToBriefing} disabled={!checklistComplete}>
          {checklistComplete ? 'Advance to Pre-Race Briefing →' : `Complete all ${totalTabs} approvals to continue`}
        </Button>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-700 bg-neutral-900/40 px-3 py-2 text-center">
      <div className="text-xs font-semibold uppercase text-neutral-500">{label}</div>
      <div className="text-sm font-bold text-neutral-200">{value}</div>
    </div>
  );
}
