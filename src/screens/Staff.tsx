import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
} from '../components/workspace/Workspace';
import { ROLE_EFFECT, STAFF_ROLES, type StaffRole } from '../types/staffTypes';
import type { GameState } from '../game/careerState';
import type { GameAction } from '../game/gameReducer';

export function Staff() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  return <StaffDepartments state={state} dispatch={dispatch} />;
}

function StaffDepartments({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: (action: GameAction) => void;
}) {
  const principalPoints = state.principal?.skillPoints ?? 0;
  const roster = state.staff ?? [];

  return (
    <WorkspaceScreen>
      <WorkspaceHeader
        eyebrow="Principal Points"
        title="Team Departments"
        subtitle="Your Technical Director, Race Engineer, Pit Crew Chief, and Strategist are permanent departments. Improve their ratings with Principal Points."
        actions={
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200">
            {principalPoints} Principal Points available
          </span>
        }
      />
      <MetricStrip>
        <WorkspaceMetric label="Departments" value={`${STAFF_ROLES.length}`} detail="Always active for your team" />
        <WorkspaceMetric label="Principal Points" value={`${principalPoints}`} detail="Earned through principal progression" />
        <WorkspaceMetric label="Technical effect" value={ROLE_EFFECT['Technical Director']} detail="Department ratings feed existing simulation bonuses" />
      </MetricStrip>
      <WorkspaceBody className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Staff departments replace personnel transactions on this screen. Existing staff records and simulation bonuses remain intact; each point raises a department by one rating level.
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {STAFF_ROLES.map((role) => (
            <DepartmentCard
              key={role}
              role={role}
              rating={departmentRating(roster, role)}
              principalPoints={principalPoints}
              onUpgrade={() => dispatch({ type: 'UPGRADE_STAFF_DEPARTMENT', role })}
            />
          ))}
        </div>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function DepartmentCard({
  role,
  rating,
  principalPoints,
  onUpgrade,
}: {
  role: StaffRole;
  rating: number;
  principalPoints: number;
  onUpgrade: () => void;
}) {
  const level = Math.max(1, Math.round(rating / 10));
  const canImprove = rating < 100 && principalPoints > 0;

  return (
    <Panel title={role} actions={<span className="text-xs font-semibold text-amber-300">Level {level} · {rating}/100</span>}>
      <p className="text-sm text-neutral-400">{ROLE_EFFECT[role]}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800" role="progressbar" aria-label={`${role} rating`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rating}>
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${rating}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span>Existing role rating · no contract transaction required</span>
        <span>{rating >= 100 ? 'Maximum' : `${100 - rating} rating to max`}</span>
      </div>
      <Button variant="primary" className="mt-3 w-full" disabled={!canImprove} onClick={onUpgrade}>
        {rating >= 100 ? 'Department maxed' : principalPoints > 0 ? 'Spend 1 Principal Point' : 'No Principal Points available'}
      </Button>
    </Panel>
  );
}

function departmentRating(roster: GameState['staff'], role: StaffRole): number {
  const member = roster?.find((entry) => entry.role === role);
  if (!member) return 50;
  return Math.max(0, Math.min(100, member.rating <= 10 ? member.rating * 10 : member.rating));
}
