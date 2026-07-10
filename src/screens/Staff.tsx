import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { getStaffPool } from '../data';
import { toMoney } from '../sim/financeEngine';
import {
  developmentSuccessBonus,
  setupConfidenceBonus,
  staffByRole,
} from '../sim/staffEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { StatBar } from '../components/StatBar';
import { formatMoney } from '../components/ui';
import { ROLE_EFFECT, STAFF_ROLES, type StaffMember, type StaffRole } from '../types/staffTypes';

export function Staff() {
  const { state, dispatch } = useGame();
  const [activeRole, setActiveRole] = useState<StaffRole>(STAFF_ROLES[0]);
  if (!state) return null;

  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;
  const roster = state.staff ?? [];
  const hiredById = new Set(roster.map((s) => s.id));
  const byRole = staffByRole(roster);
  const pool = getStaffPool(state.seasonYear, state.series);

  const devBonus = developmentSuccessBonus(roster);
  const setupBonus = setupConfidenceBonus(roster);

  const current = byRole[activeRole];
  const candidates = pool
    .filter((s) => s.role === activeRole)
    .sort((a, b) => b.rating - a.rating);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Staff</h1>
        <p className="text-sm text-neutral-400">
          Hire specialists to sharpen operations. Budget:{' '}
          <span className="font-semibold text-neutral-200">{formatMoney(budget)}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Hired" value={`${roster.length} / ${STAFF_ROLES.length}`} />
        <Kpi label="Dev Success Bonus" value={`${devBonus >= 0 ? '+' : ''}${Math.round(devBonus * 100)}%`} />
        <Kpi label="Setup Confidence Bonus" value={`${setupBonus >= 0 ? '+' : ''}${setupBonus.toFixed(1)}`} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-neutral-800">
        {STAFF_ROLES.map((role) => {
          const filled = !!byRole[role];
          const isActive = role === activeRole;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setActiveRole(role)}
              className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-amber-500 text-neutral-100'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {role}
              <span
                className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  filled ? 'bg-emerald-500' : 'bg-neutral-600'
                }`}
                title={filled ? 'Position filled' : 'Vacant'}
              />
            </button>
          );
        })}
      </div>

      <Panel title={activeRole}>
        <p className="mb-3 text-xs text-neutral-500">{ROLE_EFFECT[activeRole]}</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {candidates.map((s) => (
            <StaffCard
              key={s.id}
              s={s}
              hired={hiredById.has(s.id)}
              current={current?.id === s.id}
              affordable={toMoney(s.signingFee) <= budget}
              onHire={() => dispatch({ type: 'HIRE_STAFF', staffId: s.id })}
              onFire={() => dispatch({ type: 'FIRE_STAFF', staffId: s.id })}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function StaffCard({
  s,
  hired,
  current,
  affordable,
  onHire,
  onFire,
}: {
  s: StaffMember;
  hired: boolean;
  current: boolean;
  affordable: boolean;
  onHire: () => void;
  onFire: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        current ? 'border-amber-500/60 bg-amber-500/5' : 'border-neutral-800 bg-neutral-900/40'
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-neutral-100">{s.name}</div>
          <div className="text-xs text-neutral-500">{s.nationality}</div>
        </div>
        {current && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
            on staff
          </span>
        )}
      </div>
      <div className="mb-2">
        <StatBar label="Rating" value={s.rating} max={10} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Salary/yr">{formatMoney(toMoney(s.salary))}</Stat>
        <Stat label="Signing">{formatMoney(toMoney(s.signingFee))}</Stat>
      </div>
      <p className="mt-2 text-[11px] italic text-neutral-500">{s.bio}</p>
      <div className="mt-3 border-t border-neutral-800 pt-2">
        {hired ? (
          <Button variant="danger" className="w-full px-2 py-1 text-xs" onClick={onFire}>
            Release
          </Button>
        ) : (
          <Button
            variant="primary"
            className="w-full px-2 py-1 text-xs"
            disabled={!affordable}
            onClick={onHire}
          >
            {affordable ? 'Hire' : 'Insufficient budget'}
          </Button>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-neutral-800/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold tabular-nums text-neutral-200">{children}</div>
    </div>
  );
}
