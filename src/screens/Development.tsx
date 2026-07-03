import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { isSingleSeasonMode } from '../game/modeRestrictions';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { formatMoney } from '../components/ui';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">Development</h1>
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

      {usedSlots >= slots && (
        <div className="rounded-lg border border-orange-800 bg-orange-900/20 p-3 text-sm text-orange-300">
          All development slots are in use. Upgrade facilities to increase slots.
        </div>
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
                      className={`h-full ${p.rushed ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${progressPct}%` }}
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
            const canStart = affordable && slotAvailable;
            const canRush = rushAffordable && slotAvailable;

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
                {!slotAvailable && (
                  <div className="mt-1 text-xs text-red-400">No slots available — upgrade facilities.</div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    variant={canStart ? 'primary' : 'secondary'}
                    disabled={!canStart}
                    onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: p.id })}
                  >
                    {affordable ? (slotAvailable ? 'Start' : 'No Slots') : 'Insufficient Budget'}
                  </Button>
                  <Button
                    className="flex-1"
                    variant={canRush ? 'primary' : 'secondary'}
                    disabled={!canRush}
                    onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: p.id, rushed: true })}
                  >
                    {rushAffordable ? (slotAvailable ? `Rush (${formatMoney(rushCost)})` : 'No Slots') : 'Cannot Rush'}
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

