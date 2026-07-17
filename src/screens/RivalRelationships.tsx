import { useState } from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { formatMoney } from '../components/ui';
import { useGame } from '../game/GameContext';
import { RIVAL_ACTION_COST, rivalActionUsedThisRound, rivalRelationshipLabel } from '../sim/phase18RivalRelationshipEngine';
import type { RivalAction, RivalRelationship } from '../types/phase18Types';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

type RivalTab = 'matrix' | 'dossier' | 'activity';
const PAGE_SIZE = 6;

export function RivalRelationships() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<RivalTab>('matrix');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  if (!state) return null;
  const playerId = state.selectedTeamId;
  const relationships = Object.values(state.phase18?.rivalRelationships ?? {}).filter((item) => item.teamAId === playerId || item.teamBId === playerId).sort((a, b) => a.score - b.score);
  const rivalIdOf = (item: RivalRelationship) => item.teamAId === playerId ? item.teamBId : item.teamAId;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const selected = relationships.find((item) => rivalIdOf(item) === selectedId) ?? relationships[0];
  const selectedRivalId = selected ? rivalIdOf(selected) : undefined;
  const budget = state.teams.find((team) => team.id === playerId)?.budget ?? 0;
  const currentRound = state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
  const pageCount = Math.max(1, Math.ceil(relationships.length / PAGE_SIZE));
  const visible = relationships.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const activity = relationships.flatMap((relationship) => relationship.history.map((event) => ({ ...event, rivalId: rivalIdOf(relationship) }))).sort((a, b) => b.seasonYear - a.seasonYear || (b.round ?? 0) - (a.round ?? 0)).slice(0, 10);
  const closestAlly = [...relationships].sort((a, b) => b.score - a.score)[0];
  const bitterestRival = relationships[0];

  return <WorkspaceScreen>
    <WorkspaceHeader eyebrow="People center" title="Rival Relationships" subtitle="Sporting respect, political alignment, commercial trust, and technical suspicion across the paddock" />
    <MetricStrip>
      <WorkspaceMetric label="Closest ally" value={closestAlly ? teamName(rivalIdOf(closestAlly)) : '—'} detail="Highest overall relationship" />
      <WorkspaceMetric label="Bitterest rival" value={bitterestRival ? teamName(rivalIdOf(bitterestRival)) : '—'} detail="Lowest overall relationship" />
      <WorkspaceMetric label="Technical rivals" value={relationships.filter((item) => item.tags.includes('TechnicalRival')).length} detail={`${relationships.length} tracked teams`} />
      <WorkspaceMetric label="Open tensions" value={relationships.filter((item) => item.score <= -15).length} detail={`Action budget ${formatMoney(budget)}`} />
    </MetricStrip>
    <WorkspaceTabs
      items={[{ id: 'matrix', label: 'Relationship Matrix' }, { id: 'dossier', label: 'Rival Dossier & Actions' }, { id: 'activity', label: `Activity History (${activity.length})` }]}
      active={tab}
      onChange={setTab}
      ariaLabel="Rival relationship sections"
    />
    <WorkspaceBody className="space-y-4">
    <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="ui-decision-strip-pulse" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-semibold text-neutral-100">Rivalry operations desk</div>
          <div className="truncate text-neutral-400">
            {relationships.filter((item) => item.score <= -15).length > 0
              ? `${relationships.filter((item) => item.score <= -15).length} open tension${relationships.filter((item) => item.score <= -15).length === 1 ? '' : 's'} may require a paddock response.`
              : 'No rivalry is currently at open-tension level.'}
          </div>
        </div>
      </div>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {formatMoney(budget)} action budget
      </span>
    </div>

    {tab === 'matrix' && <Panel title="Team-to-Team Matrix">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => { const rivalId = rivalIdOf(item); return <button key={item.id} type="button" onClick={() => { setSelectedId(rivalId); setTab('dossier'); }} className="rounded-lg border border-neutral-800 bg-neutral-900/45 p-3 text-left hover:border-amber-500/45"><div className="flex items-center justify-between"><span className="font-semibold text-neutral-100">{teamName(rivalId)}</span><Score value={item.score} /></div><div className="mt-1 text-xs text-neutral-500">{rivalRelationshipLabel(item.score)}</div><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-neutral-400"><span>Respect <b className="text-neutral-200">{item.sportingRespect}</b></span><span>Politics <b className="text-neutral-200">{item.politicalAlignment}</b></span><span>Trust <b className="text-neutral-200">{item.commercialTrust}</b></span><span>Suspicion <b className="text-neutral-200">{item.technicalSuspicion}</b></span></div><div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-400">{splitLabel(tag)}</span>)}</div></button>; })}</div>
      {pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-2"><Button variant="ghost" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button><span className="text-xs text-neutral-500">Page {page + 1} of {pageCount}</span><Button variant="ghost" disabled={page >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</Button></div>}
    </Panel>}

    {tab === 'dossier' && selected && selectedRivalId && <Panel title="Rival Dossier">
      <WorkspaceTabs
        items={relationships.map((item) => ({ id: rivalIdOf(item), label: teamName(rivalIdOf(item)) }))}
        active={selectedRivalId}
        onChange={setSelectedId}
        ariaLabel="Rival dossiers"
      />
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-neutral-100">{teamName(selectedRivalId)}</h2><p className="text-xs text-neutral-500">{rivalRelationshipLabel(selected.score)}</p></div><Score value={selected.score} /></div><div className="mt-4 grid grid-cols-2 gap-3"><Meter label="Sporting respect" value={selected.sportingRespect} /><Meter label="Political alignment" value={(selected.politicalAlignment + 100) / 2} display={selected.politicalAlignment} /><Meter label="Commercial trust" value={selected.commercialTrust} /><Meter label="Technical suspicion" value={selected.technicalSuspicion} danger /></div><div className="mt-4 flex flex-wrap gap-1">{selected.tags.map((tag) => <span key={tag} className="rounded bg-[var(--era-accent-soft)] px-2 py-1 text-[10px] text-[var(--era-accent-strong)]">{splitLabel(tag)}</span>)}</div></div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"><h3 className="font-semibold text-neutral-100">Management Actions</h3><p className="mt-1 text-xs text-neutral-500">Each action can be used once per rival in a round. Different actions remain available until used.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(['OpenDialogue', 'TechnicalExchange', 'ScoutPersonnel', 'FileProtest'] as RivalAction[]).map((action) => {
        const used = rivalActionUsedThisRound(state, selectedRivalId, action);
        const insufficientBudget = budget < RIVAL_ACTION_COST[action];
        const disabledReason = used ? `Already used against this rival in round ${currentRound}` : insufficientBudget ? 'Insufficient budget' : undefined;
        return <button key={action} type="button" disabled={used || insufficientBudget} title={disabledReason} onClick={() => dispatch({ type: 'TAKE_RIVAL_ACTION', rivalTeamId: selectedRivalId, action })} className="rounded border border-neutral-700 bg-neutral-950/50 p-3 text-left enabled:hover:border-amber-500/50 disabled:opacity-40"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-amber-300">{splitLabel(action)}</span>{used && <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-400">Used R{currentRound}</span>}</div><p className="mt-1 text-[10px] text-neutral-500">{actionDescription(action)}</p><div className={`mt-2 text-[10px] ${insufficientBudget && !used ? 'text-red-300' : 'text-neutral-400'}`}>{used ? `Available again in round ${currentRound + 1}` : insufficientBudget ? `Needs ${formatMoney(RIVAL_ACTION_COST[action])}` : RIVAL_ACTION_COST[action] ? formatMoney(RIVAL_ACTION_COST[action]) : 'No cost'}</div></button>;
      })}</div></div></div>
    </Panel>}

    {tab === 'activity' && <Panel title="Relationship Activity">{activity.length === 0 ? <p className="text-sm text-neutral-500">No major relationship events have occurred yet.</p> : <div className="grid gap-2 md:grid-cols-2">{activity.map((event) => <div key={event.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><div className="flex justify-between text-[10px] uppercase text-neutral-500"><span>{teamName(event.rivalId)} · {event.category}</span><span>{event.seasonYear}{event.round ? ` R${event.round}` : ''}</span></div><p className="mt-1 text-xs text-neutral-300">{event.reason}</p><div className={`mt-1 text-[10px] ${event.amount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{event.amount >= 0 ? '+' : ''}{event.amount} relationship</div></div>)}</div>}</Panel>}
    </WorkspaceBody>
  </WorkspaceScreen>;
}

function splitLabel(value: string): string { return value.replace(/([A-Z])/g, ' $1').trim(); }
function actionDescription(action: RivalAction): string { if (action === 'OpenDialogue') return 'Lower tension and improve political alignment.'; if (action === 'TechnicalExchange') return 'Build trust and reduce copying suspicion.'; if (action === 'ScoutPersonnel') return 'Monitor staff and drivers, increasing market tension.'; return 'Challenge suspected illegality; success depends on technical suspicion.'; }
function Score({ value }: { value: number }) { const tone = value >= 15 ? 'text-emerald-300' : value <= -15 ? 'text-red-300' : 'text-amber-300'; return <span className={`text-lg font-bold tabular-nums ${tone}`}>{value > 0 ? '+' : ''}{value}</span>; }
function Meter({ label, value, display, danger }: { label: string; value: number; display?: number; danger?: boolean }) { const pct = Math.max(0, Math.min(100, value)); return <div><div className="flex justify-between text-[10px] text-neutral-500"><span>{label}</span><span>{display ?? Math.round(value)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded bg-neutral-800"><div className={`h-full ${danger ? 'bg-orange-500' : 'bg-[var(--era-accent)]'}`} style={{ width: `${pct}%` }} /></div></div>; }
