import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { isSingleSeasonMode, isDevelopmentProjectAllowedForMode } from '../game/modeRestrictions';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RDTreePanel } from '../components/development/RDTreePanel';
import { PartsInventoryPanel } from '../components/development/PartsInventoryPanel';
import { formatMoney, ratingColor } from '../components/ui';
import type { DevelopmentProject, DevelopmentOutcome } from '../types/gameTypes';
import {
  developmentSlots,
  relevantFacilityLevel,
  facilityOutcomeChances,
  facilityImpactMultiplier,
} from '../sim/facilityEngine';
import {
  computeAdjustedDuration,
  OUTCOME_LABELS,
  RUSH_COST_MULTIPLIER,
} from '../sim/developmentEngine';
import { developmentSuccessBonus } from '../sim/staffEngine';
import { facilityDevelopmentSuccessBonus } from '../sim/facilityEngine';
import type { Facility, FacilityType } from '../types/facilityTypes';

const RISK_COLORS: Record<string, string> = {
  Safe: 'text-green-400',
  Standard: 'text-neutral-300',
  Aggressive: 'text-orange-400',
  Experimental: 'text-red-400',
};

const SIZE_COLORS: Record<string, string> = {
  Small: 'text-blue-400',
  Medium: 'text-neutral-300',
  Major: 'text-purple-400',
  Experimental: 'text-red-400',
};

const OUTCOME_COLORS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'text-green-400',
  FullSuccess: 'text-blue-400',
  PartialSuccess: 'text-yellow-400',
  MinorSuccess: 'text-orange-400',
  Failed: 'text-red-400',
  RareBackfire: 'text-red-500',
};

export function Development() {
  const { state, dispatch } = useGame();
  if (!state) return null;
  const team = teamById(state, state.selectedTeamId);
  const budget = team?.budget ?? 0;
  const singleSeason = isSingleSeasonMode(state.gameMode);

  const slots = developmentSlots(state.facilities);
  const usedSlots = state.activeDevelopmentProjects.length;
  const staffBonus = developmentSuccessBonus(state.staff ?? []);
  const facSuccessBonus = facilityDevelopmentSuccessBonus(state.facilities);
  const totalSuccessBonus = staffBonus + facSuccessBonus;
  const isF11990sFactory = state.series === 'F1' && state.seasonYear >= 1990 && state.seasonYear < 2000;

  const effectSummary = (p: DevelopmentProject) => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(p.currentSeasonEffects ?? {})) parts.push(`+${v} ${k}`);
    if (!singleSeason) {
      for (const [k, v] of Object.entries(p.nextSeasonEffects ?? {})) parts.push(`+${v} ${k} (next yr)`);
    }
    return parts.join(', ') || 'Infrastructure / research';
  };

  const formatOutcomeChances = (chances: Record<DevelopmentOutcome, number>): string[] => {
    const order: DevelopmentOutcome[] = ['GreatSuccess', 'FullSuccess', 'PartialSuccess', 'MinorSuccess', 'Failed', 'RareBackfire'];
    return order
      .filter((o) => chances[o] > 0.001)
      .map((o) => `${OUTCOME_LABELS[o]} ${Math.round(chances[o] * 100)}%`);
  };

  return (
    <div className={`era-feature-screen era-development-screen space-y-6 ${isF11990sFactory ? 'rounded-xl border border-zinc-700 bg-[radial-gradient(circle_at_top_left,rgba(180,83,9,0.16),transparent_32%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(39,39,42,0.92))] p-4 shadow-2xl shadow-black/30' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Development</h1>
          {isF11990sFactory && (
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-300/80">
              {team?.name ?? 'Team'} factory floor - 1990s works program
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-neutral-400">
            Slots: <span className={`font-semibold ${usedSlots >= slots ? 'text-red-400' : 'text-neutral-100'}`}>{usedSlots}/{slots}</span>
          </div>
          <div className="text-sm text-neutral-400">
            Budget: <span className="font-semibold text-neutral-100">{formatMoney(budget)}</span>
          </div>
        </div>
      </div>

      {singleSeason && (
        <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-3 text-sm text-blue-300">
          Single Season Mode only allows development that affects the selected historical season. Next-year development is disabled.
        </div>
      )}

      <RDTreePanel />

      <PartsInventoryPanel />

      {usedSlots >= slots && (
        <div className="rounded-lg border border-orange-800 bg-orange-900/20 p-3 text-sm text-orange-300">
          All development slots are in use. Upgrade facilities to increase slots.
        </div>
      )}

      {isF11990sFactory && (
        <FactoryFloor
          facilities={state.facilities?.facilities ?? []}
          projects={state.activeDevelopmentProjects}
          usedSlots={usedSlots}
          slots={slots}
          budget={budget}
        />
      )}

      <Panel title="Active Projects">
        {state.activeDevelopmentProjects.length === 0 ? (
          <p className="text-sm text-neutral-500">No active projects. Start one below.</p>
        ) : (
          <div className="space-y-2">
            {state.activeDevelopmentProjects.map((p) => {
              const effectiveDuration = p.adjustedDurationRaces ?? p.durationRaces;
              const progressPct = (p.progressRaces / effectiveDuration) * 100;
              return (
                <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-100">{p.name}</span>
                      {p.rushed && (
                        <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">RUSHED</span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500">
                      {p.progressRaces}/{effectiveDuration} races
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full"
                      style={{ width: `${progressPct}%`, backgroundColor: p.rushed ? '#ef4444' : ratingColor(progressPct) }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-neutral-500">{effectSummary(p)}</span>
                    {!p.rushed && (
                      <button
                        className="text-[10px] text-orange-400 hover:text-orange-300"
                        onClick={() => dispatch({ type: 'RUSH_DEVELOPMENT', projectId: p.id })}
                      >
                        Rush ({formatMoney(Math.round(p.cost * 0.5))})
                      </button>
                    )}
                  </div>
                  {p.riskLevel && (
                    <div className="mt-1 flex gap-1.5">
                      <span className={`text-[10px] font-semibold ${RISK_COLORS[p.riskLevel] ?? 'text-neutral-400'}`}>{p.riskLevel}</span>
                      {p.projectSize && (
                        <span className={`text-[10px] font-semibold ${SIZE_COLORS[p.projectSize] ?? 'text-neutral-400'}`}>{p.projectSize}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {state.completedDevelopmentProjects.length > 0 && (
        <Panel title="Recent Results">
          <div className="space-y-2">
            {state.completedDevelopmentProjects.slice(-5).reverse().map((p) => {
              const result = p.outcomeResult;
              return (
                <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-100">{p.name}</span>
                    {result && (
                      <span className={`text-sm font-semibold ${OUTCOME_COLORS[result.outcome]}`}>
                        {result.label}
                      </span>
                    )}
                  </div>
                  {result && (
                    <div className="mt-1 text-xs text-neutral-400">
                      <span className="text-neutral-500">Expected: </span>
                      {Object.entries(result.expectedGain).map(([k, v]) => `+${v} ${k}`).join(', ') || 'N/A'}
                      <span className="ml-2 text-neutral-500">Actual: </span>
                      {Object.entries(result.actualGain).map(([k, v]) => `${v >= 0 ? '+' : ''}${v} ${k}`).join(', ') || 'No gain'}
                    </div>
                  )}
                  {result && <div className="mt-0.5 text-xs text-neutral-500">{result.description}</div>}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel title="Available Projects">
        <div className="grid gap-3 md:grid-cols-2">
          {developmentProjectCatalog.map((p) => {
            const facLevel = relevantFacilityLevel(state.facilities, p.category);
            const riskLevel = p.riskLevel ?? 'Standard';
            const projectSize = p.projectSize ?? 'Medium';
            const adjustedDuration = computeAdjustedDuration(p.durationRaces, facLevel, projectSize);
            const rushCost = Math.round(p.cost * RUSH_COST_MULTIPLIER());
            const chances = facilityOutcomeChances(facLevel, riskLevel, totalSuccessBonus);
            const impactMult = facilityImpactMultiplier(facLevel);
            const affordable = budget >= p.cost;
            const rushAffordable = budget >= rushCost;
            const slotAvailable = usedSlots < slots;
            const modeAllowed = isDevelopmentProjectAllowedForMode(p, state.gameMode);
            const canStart = affordable && slotAvailable && modeAllowed;
            const canRush = rushAffordable && slotAvailable && modeAllowed;

            return (
              <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-neutral-100">{p.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{p.category}</span>
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{p.horizon}</span>
                      {p.riskLevel && (
                        <span className={`rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold ${RISK_COLORS[p.riskLevel]}`}>{p.riskLevel}</span>
                      )}
                      {p.projectSize && (
                        <span className={`rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold ${SIZE_COLORS[p.projectSize]}`}>{p.projectSize}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-neutral-100">{formatMoney(p.cost)}</span>
                </div>
                <div className="mt-2 text-xs text-neutral-400">{effectSummary(p)}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  {adjustedDuration} races (base {p.durationRaces}) · Facility L{Math.round(facLevel)} · Impact x{impactMult.toFixed(1)}{!singleSeason ? ` · ${Math.round(p.carryoverRate * 100)}% carryover` : ''}
                </div>
                <div className="mt-1.5 text-xs text-neutral-400">
                  <span className="text-neutral-500">Outcomes: </span>
                  {formatOutcomeChances(chances).join(' · ')}
                </div>
                {p.risk && <div className="mt-1 text-xs text-orange-400/80">⚠ {p.risk}</div>}
                {!modeAllowed && (
                  <div className="mt-1 text-xs text-amber-400">Disabled in Single Season: this project only affects future seasons.</div>
                )}
                {!slotAvailable && modeAllowed && (
                  <div className="mt-1 text-xs text-red-400">No slots available — upgrade facilities.</div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    variant={canStart ? 'primary' : 'secondary'}
                    disabled={!canStart}
                    onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: p.id })}
                  >
                    {!modeAllowed ? 'Future-Only' : affordable ? (slotAvailable ? 'Start' : 'No Slots') : 'Insufficient Budget'}
                  </Button>
                  <Button
                    className="flex-1"
                    variant={canRush ? 'primary' : 'secondary'}
                    disabled={!canRush}
                    onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: p.id, rushed: true })}
                  >
                    {!modeAllowed ? 'Future-Only' : rushAffordable ? (slotAvailable ? `Rush (${formatMoney(rushCost)})` : 'No Slots') : 'Cannot Rush'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function FactoryFloor({
  facilities,
  projects,
  usedSlots,
  slots,
  budget,
}: {
  facilities: Facility[];
  projects: DevelopmentProject[];
  usedSlots: number;
  slots: number;
  budget: number;
}) {
  const bays: Array<{
    title: string;
    facilityTypes: FacilityType[];
    categories: DevelopmentProject['category'][];
    note: string;
  }> = [
    { title: 'Wind Tunnel', facilityTypes: ['WindTunnel'], categories: ['Aero', 'Research'], note: 'Aero maps, wing profiles and tunnel correlation.' },
    { title: 'Engine Bench', facilityTypes: ['Factory', 'DataCenter'], categories: ['Engine'], note: 'Power delivery, cooling margins and dyno runs.' },
    { title: 'Fabrication', facilityTypes: ['Manufacturing', 'Factory'], categories: ['Mechanical', 'Facilities'], note: 'Suspension, chassis fit and fast-turnaround parts.' },
    { title: 'Reliability Rig', facilityTypes: ['ReliabilityLab', 'Manufacturing'], categories: ['Reliability'], note: 'Heat cycles, vibration checks and failure analysis.' },
    { title: 'Pit Crew Bay', facilityTypes: ['PitCrewCenter'], categories: ['PitCrew'], note: 'Stop rehearsals, crew timing and equipment prep.' },
    { title: 'Data Office', facilityTypes: ['Simulator', 'DataCenter'], categories: ['Strategy', 'Driver'], note: 'Run plans, driver feedback and strategy modelling.' },
  ];

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/55 p-4 shadow-inner shadow-black/40">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-100">Factory Floor</h2>
          <p className="text-xs text-neutral-400">Choose work from the same development catalog, with the active shop load visible first.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-200">
            Bays busy: {usedSlots}/{slots}
          </span>
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
            Budget: {formatMoney(budget)}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {bays.map((bay) => {
          const level = facilityBayLevel(facilities, bay.facilityTypes);
          const active = projects.filter((p) => bay.categories.includes(p.category));
          return (
            <div key={bay.title} className="rounded border border-zinc-700 bg-zinc-900/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-neutral-100">{bay.title}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">{bay.note}</div>
                </div>
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-amber-200">L{level}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full"
                  style={{ width: `${Math.min(100, level * 20)}%`, backgroundColor: ratingColor(Math.min(100, level * 20)) }}
                />
              </div>
              <div className="mt-2 text-[11px] text-neutral-400">
                {active.length > 0 ? (
                  active.map((project) => (
                    <div key={project.id} className="truncate">
                      Active: <span className="text-neutral-200">{project.name}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-neutral-500">No active work in this bay.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function facilityBayLevel(facilities: Facility[], types: FacilityType[]): number {
  const matching = facilities.filter((facility) => types.includes(facility.type));
  if (matching.length === 0) return 1;
  const avg = matching.reduce((sum, facility) => sum + facility.level, 0) / matching.length;
  return Math.max(1, Math.round(avg));
}
