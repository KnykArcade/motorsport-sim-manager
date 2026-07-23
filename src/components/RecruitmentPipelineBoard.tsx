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
  const items = recruitmentPipeline(state);
  const visible = compact ? items.slice(0, 4) : items;

  return (
    <Panel title="Recruitment pipeline" actions={<span className="text-xs text-neutral-500">{items.length} active target{items.length === 1 ? '' : 's'}</span>}>
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
          {compact && items.length > visible.length && (
            <Button variant="secondary" className="w-full px-2 py-1 text-xs" onClick={() => navigate('/market')}>
              Open Recruitment Center ({items.length}) →
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No active recruitment targets. Use Scouting to build the next shortlist.</p>
      )}
    </Panel>
  );
}
