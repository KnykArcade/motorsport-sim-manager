import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameState } from '../game/careerState';
import { Button } from './Button';
import { Panel } from './Panel';
import { recruitmentPipeline, type RecruitmentPipelineStage } from '../screens/recruitmentPipelineViewModel';

const stageTone: Record<RecruitmentPipelineStage, string> = {
  Scouting: 'text-neutral-400 border-neutral-700',
  'Decision ready': 'text-sky-300 border-sky-800',
  'Negotiation active': 'text-emerald-300 border-emerald-800',
  'Rival pressure': 'text-amber-300 border-amber-800',
  'Queued signing': 'text-violet-300 border-violet-800',
  'Confirmed move': 'text-neutral-400 border-neutral-700',
};

export function RecruitmentPipelineBoard({ state, compact = false }: { state: GameState; compact?: boolean }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'needs_action' | 'history'>('needs_action');
  const items = recruitmentPipeline(state);
  const activeItems = items.filter((item) => item.lifecycle === 'active');
  const actionItems = items.filter((item) => item.needsAction);
  const historyItems = items.filter((item) => item.lifecycle === 'history');
  const filteredItems = filter === 'all' ? items : filter === 'history' ? historyItems : actionItems;
  const visible = compact ? filteredItems.slice(0, 4) : filteredItems;
  const filterLabel = filter === 'history' ? 'Recent outcomes' : filter === 'all' ? 'All targets' : 'Needs action';

  return (
    <Panel title={`Recruitment pipeline · ${filterLabel}`} actions={<span className="text-xs text-neutral-500">{activeItems.length} active · {historyItems.length} history</span>}>
      <div className="mb-3 flex flex-wrap gap-1 border-b border-neutral-800 pb-2">
        {([
          ['needs_action', `Needs action (${actionItems.length})`],
          ['all', `All (${items.length})`],
          ['history', `History (${historyItems.length})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${filter === value ? 'bg-sky-500/15 text-sky-300' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.length > 0 ? (
        <div className="space-y-2">
          {visible.map((item) => (
            <div key={`${item.entityType}-${item.entityId}`} className="rounded border border-neutral-800 bg-neutral-950/35 p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-neutral-200">{item.name}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{item.entityType} · {item.knowledgePercentage}% knowledge</div>
                </div>
                <span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${stageTone[item.stage]}`}>{item.stage}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-neutral-400">{item.detail}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-neutral-500">
                  {item.attemptsRemaining !== undefined
                    ? `${item.attemptsRemaining} attempt${item.attemptsRemaining === 1 ? '' : 's'} remaining`
                    : item.deadline
                      ? `Deadline: ${item.deadline}`
                      : item.rivalTeam
                        ? `Destination: ${item.rivalTeam}`
                        : 'No deadline set'}
                </span>
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => navigate(item.nextAction.route)}>
                  {item.nextAction.label} →
                </Button>
              </div>
            </div>
          ))}
          {compact && filteredItems.length > visible.length && (
            <Button variant="secondary" className="w-full px-2 py-1 text-xs" onClick={() => navigate('/market')}>
              Open Recruitment Center ({filteredItems.length}) →
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          {filter === 'history' ? 'No completed recruitment outcomes yet.' : 'No recruitment decisions need attention. Use Scouting to build the next shortlist.'}
        </p>
      )}
    </Panel>
  );
}
