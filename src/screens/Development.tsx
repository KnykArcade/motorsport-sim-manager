import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { isSingleSeasonMode, isDevelopmentProjectAllowedForMode } from '../game/modeRestrictions';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { TechnicalTable, TechnicalTableCell, TechnicalTableHead, TechnicalTableRow } from '../components/TechnicalTable';
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
import { leadershipGameplayModifiers } from '../sim/phase18IdentityCultureEngine';
import {
  developmentTabs,
  type DevelopmentTab,
} from './developmentViewModel';
import {
  WorkspaceBody,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

const RISK_COLORS: Record<string, string> = {
  Safe: 'text-green-400',
  Standard: 'text-neutral-300',
  Aggressive: 'text-orange-400',
  Experimental: 'text-red-400',
};

const SIZE_COLORS: Record<string, string> = {
  Small: 'text-[var(--era-accent-strong)]',
  Medium: 'text-neutral-300',
  Major: 'text-[var(--era-accent)]',
  Experimental: 'text-red-400',
};

const OUTCOME_COLORS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'text-green-400',
  FullSuccess: 'text-[var(--era-accent-strong)]',
  PartialSuccess: 'text-amber-300',
  MinorSuccess: 'text-orange-400',
  Failed: 'text-red-400',
  RareBackfire: 'text-red-500',
};

export function DevelopmentBody() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<DevelopmentTab>('active');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [catalogHorizon, setCatalogHorizon] = useState('All');
  const [catalogRisk, setCatalogRisk] = useState('All');
  const [catalogSort, setCatalogSort] = useState<'cost' | 'duration'>('cost');
  if (!state) return null;
  const team = teamById(state, state.selectedTeamId);
  const budget = team?.budget ?? 0;
  const singleSeason = isSingleSeasonMode(state.gameMode);

  const slots = developmentSlots(state.facilities);
  const usedSlots = state.activeDevelopmentProjects.length;
  const staffBonus = developmentSuccessBonus(state.staff ?? []);
  const facSuccessBonus = facilityDevelopmentSuccessBonus(state.facilities);
  const cultureBonus = leadershipGameplayModifiers(state).developmentSuccessBonus;
  const totalSuccessBonus = staffBonus + facSuccessBonus + cultureBonus;
  const tabs = developmentTabs();
  const completedProjects = [...state.completedDevelopmentProjects].reverse();
  const categories = [...new Set(developmentProjectCatalog.map((project) => project.category))];
  const horizons = [...new Set(developmentProjectCatalog.map((project) => project.horizon))];
  const risks = [...new Set(developmentProjectCatalog.map((project) => project.riskLevel ?? 'Standard'))];
  const visibleCatalogProjects = developmentProjectCatalog
    .filter((project) => catalogCategory === 'All' || project.category === catalogCategory)
    .filter((project) => catalogHorizon === 'All' || project.horizon === catalogHorizon)
    .filter((project) => catalogRisk === 'All' || (project.riskLevel ?? 'Standard') === catalogRisk)
    .sort((a, b) => catalogSort === 'cost' ? a.cost - b.cost : a.durationRaces - b.durationRaces);
  const operationsMessage = usedSlots >= slots
    ? 'All development capacity is committed. Review active projects or upgrade facilities before starting new work.'
    : state.activeDevelopmentProjects.length === 0
      ? 'No active project is running. Open the catalog to choose the next technical priority.'
      : `${state.activeDevelopmentProjects.length} active project${state.activeDevelopmentProjects.length === 1 ? '' : 's'} in the technical pipeline.`;

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
    <WorkspaceBody className="space-y-4">
      <WorkspaceTabs
        items={tabs.map((item) => ({
          id: item.id,
          label: `${item.label}${item.id === 'active' ? ` (${state.activeDevelopmentProjects.length})` : item.id === 'results' ? ` (${completedProjects.length})` : item.id === 'catalog' ? ` (${developmentProjectCatalog.length})` : ''}`,
        }))}
        active={tab}
        onChange={setTab}
        ariaLabel="Development sections"
      />
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">Technical operations desk</div>
            <div className="truncate text-neutral-400">{operationsMessage}</div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {usedSlots}/{slots} slots committed
        </span>
      </div>
      {singleSeason && (
        <div className="rounded-lg border border-[var(--era-border-strong)] bg-[var(--era-accent-soft)] p-3 text-sm text-[var(--era-accent-strong)]">
          Single Season Mode only allows development that affects the selected historical season. Next-year development is disabled.
        </div>
      )}

      {usedSlots >= slots && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-300">
          All development slots are in use. Upgrade facilities to increase slots.
        </div>
      )}

      {tab === 'active' && (
        <Panel title="Active Projects">
          {state.activeDevelopmentProjects.length === 0 ? (
            <p className="text-sm text-neutral-500">No active projects. Start one below.</p>
          ) : (
            <TechnicalTable>
              <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Project</TechnicalTableCell><TechnicalTableCell header>Progress</TechnicalTableCell><TechnicalTableCell header>Risk / size</TechnicalTableCell><TechnicalTableCell header>Effects</TechnicalTableCell><TechnicalTableCell header>Action</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
              <tbody>{state.activeDevelopmentProjects.map((p) => {
                const duration = p.adjustedDurationRaces ?? p.durationRaces;
                const progress = Math.min(100, p.progressRaces / duration * 100);
                return <TechnicalTableRow key={p.id}><TechnicalTableCell><span className="font-semibold text-neutral-100">{p.name}</span>{p.rushed && <span className="ml-2 text-red-300">Rushed</span>}</TechnicalTableCell><TechnicalTableCell><div className="min-w-32"><div className="mb-1 flex justify-between text-neutral-500"><span>{p.progressRaces}/{duration} races</span><span>{Math.round(progress)}%</span></div><div className="h-1.5 rounded bg-neutral-800"><div className="h-full rounded bg-[var(--era-accent)]" style={{ width: `${progress}%` }} /></div></div></TechnicalTableCell><TechnicalTableCell>{p.riskLevel ?? 'Standard'} · {p.projectSize ?? 'Medium'}</TechnicalTableCell><TechnicalTableCell className="max-w-xs text-neutral-400">{effectSummary(p)}</TechnicalTableCell><TechnicalTableCell>{!p.rushed && <button className="text-orange-400 hover:text-orange-300" onClick={() => dispatch({ type: 'RUSH_DEVELOPMENT', projectId: p.id })}>Rush {formatMoney(Math.round(p.cost * 0.5))}</button>}</TechnicalTableCell></TechnicalTableRow>;
              })}</tbody>
            </TechnicalTable>
          )}
        </Panel>
      )}

      {tab === 'results' && (
        <Panel title="Recent Results">
          {completedProjects.length === 0 ? (
            <p className="text-sm text-neutral-500">No completed development projects yet.</p>
          ) : (
            <TechnicalTable>
              <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Project</TechnicalTableCell><TechnicalTableCell header>Outcome</TechnicalTableCell><TechnicalTableCell header>Expected gain</TechnicalTableCell><TechnicalTableCell header>Actual gain</TechnicalTableCell><TechnicalTableCell header>Description</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
              <tbody>{completedProjects.map((p) => {
                const result = p.outcomeResult;
                return <TechnicalTableRow key={p.id}><TechnicalTableCell className="font-semibold text-neutral-100">{p.name}</TechnicalTableCell><TechnicalTableCell className={result ? OUTCOME_COLORS[result.outcome] : 'text-neutral-500'}>{result?.label ?? 'No result'}</TechnicalTableCell><TechnicalTableCell className="text-neutral-400">{result ? Object.entries(result.expectedGain).map(([k, v]) => `+${v} ${k}`).join(', ') || 'N/A' : 'N/A'}</TechnicalTableCell><TechnicalTableCell className="text-neutral-400">{result ? Object.entries(result.actualGain).map(([k, v]) => `${v >= 0 ? '+' : ''}${v} ${k}`).join(', ') || 'No gain' : 'N/A'}</TechnicalTableCell><TechnicalTableCell className="max-w-md text-neutral-500">{result?.description ?? '—'}</TechnicalTableCell></TechnicalTableRow>;
              })}</tbody>
            </TechnicalTable>
          )}
        </Panel>
      )}

      {tab === 'catalog' && (
        <Panel title="Available Projects">
          <div className="mb-3 flex flex-wrap gap-2">
            <FilterSelect label="Category" value={catalogCategory} options={categories} onChange={setCatalogCategory} />
            <FilterSelect label="Horizon" value={catalogHorizon} options={horizons} onChange={setCatalogHorizon} />
            <FilterSelect label="Risk" value={catalogRisk} options={risks} onChange={setCatalogRisk} />
            <FilterSelect label="Sort" value={catalogSort} options={['cost', 'duration']} onChange={(value) => setCatalogSort(value as 'cost' | 'duration')} />
          </div>
          <TechnicalTable>
            <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Project</TechnicalTableCell><TechnicalTableCell header>Category</TechnicalTableCell><TechnicalTableCell header>Risk / size</TechnicalTableCell><TechnicalTableCell header>Cost</TechnicalTableCell><TechnicalTableCell header>Duration</TechnicalTableCell><TechnicalTableCell header>Facility / impact</TechnicalTableCell><TechnicalTableCell header>Outcomes / detail</TechnicalTableCell><TechnicalTableCell header>Actions</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
            <tbody>
            {visibleCatalogProjects.map((p) => {
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

            return <TechnicalTableRow key={p.id}>
              <TechnicalTableCell><div className="font-semibold text-neutral-100">{p.name}</div><div className="text-neutral-500">{p.horizon}</div></TechnicalTableCell>
              <TechnicalTableCell>{p.category}</TechnicalTableCell>
              <TechnicalTableCell><span className={RISK_COLORS[riskLevel]}>{riskLevel}</span><div className={SIZE_COLORS[projectSize]}>{projectSize}</div></TechnicalTableCell>
              <TechnicalTableCell className="font-semibold tabular-nums">{formatMoney(p.cost)}</TechnicalTableCell>
              <TechnicalTableCell>{adjustedDuration} races<div className="text-neutral-500">Base {p.durationRaces}</div></TechnicalTableCell>
              <TechnicalTableCell>Facility L{Math.round(facLevel)}<div className="text-neutral-500">Impact x{impactMult.toFixed(1)} · {Math.round(p.carryoverRate * 100)}% carryover</div></TechnicalTableCell>
              <TechnicalTableCell className="max-w-xs"><div className="text-neutral-300">{formatOutcomeChances(chances).join(' · ')}</div><div className="text-neutral-500">{effectSummary(p)}</div>{p.risk && <div className="text-orange-400/80">⚠ {p.risk}</div>}{!modeAllowed && <div className="text-amber-400">Future-only in Single Season</div>}{!slotAvailable && modeAllowed && <div className="text-red-400">No slots available</div>}</TechnicalTableCell>
              <TechnicalTableCell><div className="flex flex-col gap-1"><Button className="px-2 py-1 text-xs" variant={canStart ? 'primary' : 'secondary'} disabled={!canStart} onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: p.id })}>{!modeAllowed ? 'Future-only' : affordable ? (slotAvailable ? 'Start' : 'No slots') : 'No budget'}</Button><Button className="px-2 py-1 text-xs" variant={canRush ? 'primary' : 'secondary'} disabled={!canRush} onClick={() => dispatch({ type: 'START_DEVELOPMENT', projectId: p.id, rushed: true })}>{!modeAllowed ? 'Future-only' : rushAffordable ? (slotAvailable ? `Rush ${formatMoney(rushCost)}` : 'No slots') : 'Cannot rush'}</Button></div></TechnicalTableCell>
            </TechnicalTableRow>;
            })}
            </tbody>
          </TechnicalTable>
        </Panel>
      )}
    </WorkspaceBody>
  );
}

export function Development() {
  return <DevelopmentBody />;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-2 text-xs text-neutral-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"><option value="All">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
