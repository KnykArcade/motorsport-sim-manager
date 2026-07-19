import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import type { GameState } from '../game/careerState';
import { getRouteRestrictionInfo } from '../game/modeRestrictions';
import { developmentSlots } from '../sim/facilityEngine';
import { formatMoney } from '../components/ui';
import { Panel } from '../components/Panel';
import { WorkspaceBody, WorkspaceHeader, WorkspaceMetric, WorkspaceScreen, WorkspaceTabs, MetricStrip } from '../components/workspace/Workspace';
import { TechnicalTable, TechnicalTableCell, TechnicalTableHead, TechnicalTableRow } from '../components/TechnicalTable';
import { activeDriversForTeam } from '../game/careerState';
import { carWithFittedParts } from '../sim/partsEngine';
import { carPerformanceRating, effectiveCarRatings } from '../sim/trackFitEngine';
import { ratingColor } from '../components/ui';
import { activeUpgradePrograms, researchStateForTeam } from '../sim/technicalAdapters';
import { technicalDirectorProposals } from '../sim/technicalAdvisorEngine';
import { staffByRole } from '../sim/staffEngine';
import { Button } from '../components/Button';
import { TppExplainer } from '../components/development/TppExplainer';

const UnifiedDevelopmentBody = lazy(() => import('./UnifiedDevelopment').then((m) => ({ default: m.UnifiedDevelopmentBody })));
const FacilitiesBody = lazy(() => import('./Facilities').then((m) => ({ default: m.FacilitiesBody })));
const EngineSupplierBody = lazy(() => import('./EngineSupplier').then((m) => ({ default: m.EngineSupplierBody })));
const PartsInventoryPanel = lazy(() => import('../components/development/PartsInventoryPanel').then((m) => ({ default: m.PartsInventoryPanel })));

type TechnicalSection = 'command' | 'development' | 'parts' | 'facilities' | 'engine';

const sections: ReadonlyArray<{ id: TechnicalSection; label: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'development', label: 'Development' },
  { id: 'parts', label: 'Parts & Factory' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'engine', label: 'Engine' },
];

function sectionFromQuery(value: string | null): TechnicalSection {
  return sections.some((section) => section.id === value)
    ? value as TechnicalSection
    : 'command';
}

export function TechnicalCenter() {
  const { state } = useGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<TechnicalSection>(() => sectionFromQuery(searchParams.get('section')));
  const activeSection = searchParams.has('section') ? sectionFromQuery(searchParams.get('section')) : section;
  const navigateTechnicalSection = (next: TechnicalSection) => {
    setSection(next);
    setSearchParams(next === 'command' ? {} : { section: next });
  };
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const research = researchStateForTeam(state, state.selectedTeamId);
  const activeUpgrades = activeUpgradePrograms(state);
  const parts = state.teamParts?.[state.selectedTeamId];
  const slots = developmentSlots(state.facilities);
  const lockInfo = getRouteRestrictionInfo('/engine', state.gameMode);

  return (
    <WorkspaceScreen className="era-feature-screen era-technical-screen">
      <WorkspaceHeader
        eyebrow="Technical center"
        title="Technical Center"
        subtitle={`${team?.name ?? 'Team'} · ${state.seasonYear} ${state.series}`}
      />
      <MetricStrip>
        <WorkspaceMetric label="Technical capacity" value={`${activeUpgrades.length + (research?.activeProjects.length ?? 0)}/${slots}`} detail="Development + research slots in use" />
        <WorkspaceMetric label="Technical budget" value={formatMoney(team?.budget ?? 0)} detail={`${research?.tpp.balance ?? 0} TPP · cash funds operations`} />
        <WorkspaceMetric label="Technical pipeline" value={`${activeUpgrades.length + (research?.activeProjects.length ?? 0)}`} detail={`${activeUpgrades.length} development · ${research?.activeProjects.length ?? 0} research`} />
        <WorkspaceMetric label="Operations queue" value={`${parts?.manufacturingQueue.length ?? 0} factory`} detail={`${state.facilities?.pendingUpgrades.length ?? 0} facility upgrades pending`} />
      </MetricStrip>
      <WorkspaceTabs
        items={sections}
        active={activeSection}
        onChange={navigateTechnicalSection}
        ariaLabel="Technical Center sections"
      />
      <WorkspaceBody className="space-y-4">
        <Suspense fallback={<div className="py-8 text-center text-sm text-neutral-500">Loading…</div>}>
          {activeSection === 'command' && <CommandPanel state={state} onNavigate={navigateTechnicalSection} />}
          {activeSection === 'development' && <UnifiedDevelopmentBody />}
          {activeSection === 'parts' && <PartsInventoryPanel />}
          {activeSection === 'facilities' && <FacilitiesBody />}
          {activeSection === 'engine' && (lockInfo ? <LockedEnginePanel title={lockInfo.title} reason={lockInfo.reason} focus={lockInfo.focus} /> : <EngineSupplierBody />)}
        </Suspense>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function CommandPanel({ state, onNavigate }: { state: GameState; onNavigate: (section: TechnicalSection) => void }) {
  const team = teamById(state, state.selectedTeamId);
  const research = researchStateForTeam(state, state.selectedTeamId);
  const activeUpgrades = activeUpgradePrograms(state);
  const parts = state.teamParts?.[state.selectedTeamId];
  const drivers = activeDriversForTeam(state, state.selectedTeamId);
  const baseCar = state.cars.find((car) => car.id === team?.carId);
  const effectiveCars = baseCar ? drivers.map((driver) => ({ driver, car: carWithFittedParts(baseCar, parts, driver.id) })) : [];
  const facilities = state.facilities?.facilities ?? [];
  const activeResearch = research?.activeProjects ?? [];
  const totalCommitted = activeUpgrades.length + activeResearch.length;
  const alerts = [
    totalCommitted >= developmentSlots(state.facilities) ? 'All technical capacity is committed.' : undefined,
    effectiveCars.some(({ car }) => Object.values(car.componentCondition ?? {}).some((condition) => condition !== undefined && condition < 30)) ? 'A fitted component is at critical condition.' : undefined,
    state.facilities?.pendingUpgrades.some((upgrade) => upgrade.weeksRemaining <= 1) ? 'A facility upgrade completes at the next rollover.' : undefined,
  ].filter((alert): alert is string => !!alert);
  return (
    <div className="space-y-4">
      <TechnicalBriefingPanel state={state} onNavigate={onNavigate} />
      <Panel title="Car performance snapshot">
        {effectiveCars.length === 0 ? <p className="text-sm text-neutral-500">Current car ratings are not available yet.</p> : <TechnicalTable>
          <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Driver / car</TechnicalTableCell><TechnicalTableCell header>Overall</TechnicalTableCell><TechnicalTableCell header>Power unit</TechnicalTableCell><TechnicalTableCell header>Aero</TechnicalTableCell><TechnicalTableCell header>Mechanical</TechnicalTableCell><TechnicalTableCell header>Reliability</TechnicalTableCell><TechnicalTableCell header>Parts condition</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
          <tbody>{effectiveCars.map(({ driver, car }) => { const ratings = effectiveCarRatings(car); return <TechnicalTableRow key={driver.id}><TechnicalTableCell className="font-semibold text-neutral-100">{driver.name}<div className="text-neutral-500">Car #{driver.number}</div></TechnicalTableCell><TechnicalTableCell className="font-semibold tabular-nums" style={{ color: ratingColor(carPerformanceRating(car)) }}>{carPerformanceRating(car).toFixed(1)}</TechnicalTableCell>{(['enginePower', 'aeroEfficiency', 'mechanicalGrip', 'reliability'] as const).map((rating) => <TechnicalTableCell key={rating} className="font-semibold tabular-nums" style={{ color: ratingColor(ratings[rating]) }}>{ratings[rating].toFixed(1)}<div className="text-[10px] font-normal text-neutral-500">base {car.ratings[rating].toFixed(1)} · {ratings[rating] - car.ratings[rating] >= 0 ? '+' : ''}{(ratings[rating] - car.ratings[rating]).toFixed(1)} effective</div></TechnicalTableCell>)}<TechnicalTableCell>{car.componentCondition ? `${Math.round(Object.values(car.componentCondition).filter((value): value is number => value !== undefined).reduce((sum, value) => sum + value, 0) / Object.values(car.componentCondition).filter((value): value is number => value !== undefined).length)}% avg` : '—'}</TechnicalTableCell></TechnicalTableRow>; })}</tbody>
        </TechnicalTable>}
        <p className="mt-2 text-xs text-neutral-500">Effective ratings include development, fitted-part effects, engine contribution, and the canonical 100-point clamp. The sub-line shows each rating&apos;s base value and net effective delta.</p>
      </Panel>
      <Panel title="Technical pipeline" actions={<TppExplainer />}>
        <TechnicalTable>
          <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Workstream</TechnicalTableCell><TechnicalTableCell header>Item</TechnicalTableCell><TechnicalTableCell header>ETA</TechnicalTableCell><TechnicalTableCell header>Open</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
          <tbody>
            {activeUpgrades.map((project) => <TechnicalTableRow key={`dev-${project.id}`}><TechnicalTableCell>Development</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{project.name}</TechnicalTableCell><TechnicalTableCell>{Math.max(0, (project.adjustedDurationRaces ?? project.durationRaces) - project.progressRaces)} races</TechnicalTableCell><TechnicalTableCell><JumpButton onClick={() => onNavigate('development')} /></TechnicalTableCell></TechnicalTableRow>)}
            {activeResearch.map((project) => <TechnicalTableRow key={`rd-${project.id}`}><TechnicalTableCell>Research</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{project.nodeName ?? 'Research node'}</TechnicalTableCell><TechnicalTableCell>{Math.max(0, project.durationRounds - project.progressRounds)} rounds</TechnicalTableCell><TechnicalTableCell><JumpButton onClick={() => onNavigate('development')} /></TechnicalTableCell></TechnicalTableRow>)}
            {(parts?.manufacturingQueue ?? []).map((order) => <TechnicalTableRow key={`factory-${order.id}`}><TechnicalTableCell>Factory</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{order.quantity}x {order.type}</TechnicalTableCell><TechnicalTableCell>{order.roundsRemaining} rounds</TechnicalTableCell><TechnicalTableCell><JumpButton onClick={() => onNavigate('parts')} /></TechnicalTableCell></TechnicalTableRow>)}
            {(state.facilities?.pendingUpgrades ?? []).map((upgrade) => <TechnicalTableRow key={`facility-${upgrade.facilityId}`}><TechnicalTableCell>Facilities</TechnicalTableCell><TechnicalTableCell className="font-semibold text-neutral-100">{facilities.find((facility) => facility.id === upgrade.facilityId)?.type ?? upgrade.facilityId} → L{upgrade.toLevel}</TechnicalTableCell><TechnicalTableCell>{upgrade.weeksRemaining} weeks</TechnicalTableCell><TechnicalTableCell><JumpButton onClick={() => onNavigate('facilities')} /></TechnicalTableCell></TechnicalTableRow>)}
          </tbody>
        </TechnicalTable>
      </Panel>
      <Panel title="Technical alerts">
        {alerts.length === 0 ? <p className="text-sm text-neutral-500">No immediate technical actions.</p> : <ul className="space-y-2">{alerts.map((alert) => <li key={alert} className="border-l-2 border-amber-500 px-3 py-1 text-sm text-amber-200">{alert}</li>)}</ul>}
      </Panel>
    </div>
  );
}

function TechnicalBriefingPanel({ state, onNavigate }: { state: GameState; onNavigate: (section: TechnicalSection) => void }) {
  const { dispatch } = useGame();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const director = staffByRole(state.staff ?? [])['Technical Director'];
  const proposals = technicalDirectorProposals(state).filter((proposal) => !dismissed.has(proposal.id));
  const dismiss = (id: string) => setDismissed((prev) => new Set([...prev, id]));
  return (
    <Panel
      title="Technical Director's briefing"
      actions={<span className="text-xs text-neutral-500">{director ? `${director.name} · Technical Director` : 'No Technical Director hired — baseline recommendations'}</span>}
    >
      {proposals.length === 0 ? (
        <p className="text-sm text-neutral-500">No recommendations this round — the technical programme is in good shape.</p>
      ) : (
        <ul className="space-y-2">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="flex flex-wrap items-center gap-3 rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-neutral-100">{proposal.title}</div>
                <div className="text-xs text-neutral-400">{proposal.reason}</div>
              </div>
              <div className="text-xs tabular-nums text-neutral-300">{proposal.costLabel}<div className="text-neutral-500">{proposal.durationLabel}</div></div>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => { dispatch(proposal.action); dismiss(proposal.id); }}>Approve</Button>
                <button type="button" className="text-xs text-[var(--era-accent-strong)] hover:underline" onClick={() => onNavigate(proposal.section)}>Open →</button>
                <button type="button" className="text-xs text-neutral-500 hover:text-neutral-300" onClick={() => dismiss(proposal.id)} aria-label={`Dismiss ${proposal.title}`}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function JumpButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="text-[var(--era-accent-strong)] hover:underline" onClick={onClick}>Open →</button>;
}

function LockedEnginePanel({ title, reason, focus }: { title: string; reason: string; focus: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-600/40 bg-amber-900/20 text-xl text-amber-400">🔒</span><h2 className="text-2xl font-bold text-neutral-100">{title}</h2></div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"><p className="text-sm text-neutral-300">{reason}</p></div>
      <div className="rounded-lg border border-sky-800/50 bg-sky-900/20 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-sky-400">What to focus on</div><p className="mt-1 text-sm text-sky-200">{focus}</p></div>
    </div>
  );
}
