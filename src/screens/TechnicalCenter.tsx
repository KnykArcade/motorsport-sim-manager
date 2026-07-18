import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import type { GameState } from '../game/careerState';
import { getRouteRestrictionInfo } from '../game/modeRestrictions';
import { developmentSlots } from '../sim/facilityEngine';
import { formatMoney } from '../components/ui';
import { Panel } from '../components/Panel';
import { WorkspaceBody, WorkspaceHeader, WorkspaceMetric, WorkspaceScreen, WorkspaceTabs, MetricStrip } from '../components/workspace/Workspace';
import { DevelopmentBody } from './Development';
import { FacilitiesBody } from './Facilities';
import { EngineSupplierBody } from './EngineSupplier';
import { RDTreePanel } from '../components/development/RDTreePanel';
import { PartsInventoryPanel } from '../components/development/PartsInventoryPanel';

type TechnicalSection = 'command' | 'development' | 'research' | 'parts' | 'facilities' | 'engine';

const sections: ReadonlyArray<{ id: TechnicalSection; label: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'development', label: 'Development' },
  { id: 'research', label: 'R&D' },
  { id: 'parts', label: 'Parts & Factory' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'engine', label: 'Engine' },
];

export function TechnicalCenter() {
  const { state } = useGame();
  const [section, setSection] = useState<TechnicalSection>('command');
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const research = state.teamResearch?.[state.selectedTeamId];
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
        <WorkspaceMetric label="Technical capacity" value={`${state.activeDevelopmentProjects.length}/${slots}`} detail="Development slots in use" />
        <WorkspaceMetric label="Technical budget" value={formatMoney(team?.budget ?? 0)} detail={`${research?.tpp.balance ?? 0} Team Principal Points`} />
        <WorkspaceMetric label="Technical pipeline" value={`${state.activeDevelopmentProjects.length + (research?.activeProjects.length ?? 0)}`} detail={`${state.activeDevelopmentProjects.length} development · ${research?.activeProjects.length ?? 0} research`} />
        <WorkspaceMetric label="Operations queue" value={`${parts?.manufacturingQueue.length ?? 0} factory`} detail={`${state.facilities?.pendingUpgrades.length ?? 0} facility upgrades pending`} />
      </MetricStrip>
      <WorkspaceTabs items={sections} active={section} onChange={setSection} ariaLabel="Technical Center sections" />
      <WorkspaceBody className="space-y-4">
        {section === 'command' && <CommandPanel state={state} />}
        {section === 'development' && <DevelopmentBody />}
        {section === 'research' && <RDTreePanel />}
        {section === 'parts' && <PartsInventoryPanel />}
        {section === 'facilities' && <FacilitiesBody />}
        {section === 'engine' && (lockInfo ? <LockedEnginePanel title={lockInfo.title} reason={lockInfo.reason} focus={lockInfo.focus} /> : <EngineSupplierBody />)}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function CommandPanel({ state }: { state: GameState }) {
  const research = state.teamResearch?.[state.selectedTeamId];
  const parts = state.teamParts?.[state.selectedTeamId];
  return (
    <Panel title="Technical command">
      <p className="text-sm text-neutral-400">A concise view of the team’s current technical workload.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <CommandMetric label="Active development" value={state.activeDevelopmentProjects.length} />
        <CommandMetric label="Active research" value={research?.activeProjects.length ?? 0} />
        <CommandMetric label="Factory orders" value={parts?.manufacturingQueue.length ?? 0} />
        <CommandMetric label="Facility upgrades" value={state.facilities?.pendingUpgrades.length ?? 0} />
      </div>
    </Panel>
  );
}

function CommandMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3"><div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-1 text-2xl font-bold text-neutral-100">{value}</div></div>;
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
