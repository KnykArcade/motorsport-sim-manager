import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { activeDriversForTeam } from '../game/careerState';
import { thirdDriverAmbitions } from '../sim/contractEngine';
import { marketRolloverChanges } from '../sim/careerMarketEngine';
import { crossSeriesCandidates } from '../sim/crossSeriesEngine';
import { academyMemberAge } from '../sim/driverMarketEngine';
import { isPromotionEligible } from '../sim/youthAcademyEngine';
import { loadSeasonBundle } from '../data';
import type { FirstOptionDecision } from '../types/marketTypes';
import type { MasterDriverEntry } from '../types/registryTypes';

export function Offseason() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [advancing, setAdvancing] = useState(false);
  if (!state) return null;

  const nextYear = state.seasonYear + 1;
  const rollover = marketRolloverChanges(state, nextYear);
  const crossover = crossSeriesCandidates(state);
  const signings = state.pendingSignings ?? [];
  const academy = state.academy ?? [];
  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;

  const ambitions = thirdDriverAmbitions(state);
  const seatDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const reservePromotionFor = (thirdDriverId: string) =>
    signings.find((s) => s.source === 'reserve' && s.sourceId === thirdDriverId);

  // Academy Rights / First Option: academy drivers who reach 18 next season.
  const academyDecisions = state.academyDecisions ?? [];
  const promotionEligible = academy.filter((a) => isPromotionEligible(a, nextYear));
  const decisionFor = (academyId: string) =>
    academyDecisions.find((d) => d.academyId === academyId);

  const advance = () => {
    setAdvancing(true);
    loadSeasonBundle(nextYear, state.series)
      .then((nextBundle) => {
        dispatch({ type: 'ADVANCE_SEASON', nextBundle });
        navigate('/hq');
      })
      .catch(() => {
        dispatch({ type: 'ADVANCE_SEASON' });
        navigate('/hq');
      });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Offseason</h1>
          <p className="text-sm text-neutral-400">
            Prepare for {nextYear}. Confirm your driver line-up, then advance the season.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>Main Menu</Button>
      </div>

      <Panel title={`Driver Line-up for ${nextYear}`}>
        {signings.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No seat changes queued — you keep your current drivers. Visit the{' '}
            <button className="text-amber-400 hover:underline" onClick={() => navigate('/market')}>
              Driver Market
            </button>{' '}
            to sign a new driver or promote an academy talent.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {signings.map((s) => (
              <li key={s.seatDriverId} className="flex items-center justify-between">
                <span className="text-neutral-200">
                  <span className="font-semibold">{s.name}</span>{' '}
                  <span className="text-neutral-500">replaces {driverName(s.seatDriverId)}</span>
                  {s.source === 'academy' && (
                    <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                      academy promotion
                    </span>
                  )}
                </span>
                <button
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => dispatch({ type: 'RELEASE_SIGNING', seatDriverId: s.seatDriverId })}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Academy (${academy.length})`}>
        {academy.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No academy drivers. Sign youth prospects in the Driver Market — they develop each
            offseason toward F1-readiness.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {academy.map((a) => {
              const age = academyMemberAge(a, nextYear);
              const eligible = isPromotionEligible(a, nextYear);
              return (
                <li key={a.id} className="flex items-center justify-between text-neutral-300">
                  <span>
                    {a.name}{' '}
                    <span className="text-neutral-500">
                      (age {age} · {a.overall.toFixed(1)} → {a.potential.toFixed(1)} pot)
                    </span>
                    {eligible && (
                      <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                        promotion eligible
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {a.yearsUntilF1Ready <= 0 ? 'F1-ready' : `~${a.yearsUntilF1Ready}y to F1`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-neutral-500">
          Youth academy holds drivers aged 12–17; they gain ratings each season. At 18 they become
          promotion eligible and your team gets first option before they can reach the open market.
        </p>
      </Panel>

      {promotionEligible.length > 0 && (
        <Panel title="Academy Rights — First Option">
          <p className="mb-3 text-sm text-neutral-400">
            These academy drivers turn 18 for {nextYear} and are now promotion eligible. Your team
            holds first option: promote them, extend their development rights, or release them to the
            open Driver Market. Undecided drivers stay under academy rights and are re-offered next
            year.
          </p>
          <ul className="space-y-3 text-sm">
            {promotionEligible.map((a) => {
              const decision = decisionFor(a.id);
              const clear = () =>
                dispatch({ type: 'CLEAR_ACADEMY_DECISION', academyId: a.id });
              const set = (d: FirstOptionDecision, seatDriverId?: string) =>
                dispatch({ type: 'SET_ACADEMY_DECISION', academyId: a.id, decision: d, seatDriverId });
              return (
                <li
                  key={a.id}
                  className="rounded border border-neutral-800 bg-neutral-900/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-100">
                      {a.name}{' '}
                      <span className="text-xs font-normal text-neutral-500">
                        (age {academyMemberAge(a, nextYear)} · {a.overall.toFixed(1)} ovr →{' '}
                        {a.potential.toFixed(1)} pot ·{' '}
                        {a.yearsUntilF1Ready <= 0 ? 'F1-ready' : `~${a.yearsUntilF1Ready}y to F1`})
                      </span>
                    </span>
                  </div>
                  {decision ? (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-green-300">
                        {decisionLabel(decision.decision)}
                        {decision.seatDriverId && ` → replaces ${driverName(decision.seatDriverId)}`}
                      </span>
                      <button className="text-red-400 hover:text-red-300" onClick={clear}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {seatDrivers.map((s) => (
                        <Button
                          key={s.id}
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => set('race_seat', s.id)}
                        >
                          Race seat → #{s.number} {s.name}
                        </Button>
                      ))}
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => set('third')}>
                        3rd driver
                      </Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => set('reserve')}>
                        Reserve
                      </Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => set('test')}>
                        Test driver
                      </Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => set('extend')}>
                        Extend rights
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-400"
                        onClick={() => set('release')}
                      >
                        Release to market
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {ambitions.length > 0 && (
        <Panel title="3rd Driver Contracts">
          <p className="mb-3 text-sm text-neutral-400">
            Your reserve drivers want to talk about their future. Promote one into a race seat for{' '}
            {nextYear}, or risk losing an out-performer to a rival team.
          </p>
          <ul className="space-y-3 text-sm">
            {ambitions.map((a) => {
              const queued = reservePromotionFor(a.driverId);
              return (
                <li
                  key={a.driverId}
                  className="rounded border border-neutral-800 bg-neutral-900/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-100">{a.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        a.wantsSeat
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {a.wantsSeat ? 'Wants a race seat' : 'Happy as reserve'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Scored {a.points} pts as 3rd driver (weakest seat driver: {a.bestSeatPoints} pts).
                    {a.wantsSeat && ' Will leave for another team if not promoted.'}
                  </div>
                  <div className="mt-2">
                    {queued ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-300">
                          Promoting → replaces {driverName(queued.seatDriverId)}
                        </span>
                        <button
                          className="text-red-400 hover:text-red-300"
                          onClick={() =>
                            dispatch({ type: 'RELEASE_SIGNING', seatDriverId: queued.seatDriverId })
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {seatDrivers.map((s) => (
                          <Button
                            key={s.id}
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() =>
                              dispatch({
                                type: 'PROMOTE_THIRD_DRIVER',
                                seatDriverId: s.id,
                                thirdDriverId: a.driverId,
                              })
                            }
                          >
                            Promote → seat of #{s.number} {s.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Panel title={`Market Outlook for ${nextYear}`}>
        <p className="mb-3 text-sm text-neutral-400">
          How the living driver market changes when you advance — drawn from the Master Driver
          Registry. Your current line-up and contracts are unaffected.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <OutlookGroup
            label="Newly available drivers"
            accent="text-green-300"
            entries={rollover.newAdults}
          />
          <OutlookGroup
            label="New youth prospects"
            accent="text-sky-300"
            entries={rollover.newYouth}
          />
          <OutlookGroup
            label="Youth aging into the senior market"
            accent="text-amber-300"
            entries={rollover.promotedYouth}
          />
          <OutlookGroup
            label="Retirements"
            accent="text-red-300"
            entries={rollover.retirements}
          />
          <OutlookGroup
            label="Cross-series drivers open to switching"
            accent="text-cyan-300"
            entries={crossover.map((c) => ({
              driverId: c.id,
              displayName: c.name,
            }))}
          />
        </div>
      </Panel>

      <Panel title="Advance the Season">
        <p className="text-sm text-neutral-300">
          Advancing rolls the team into {nextYear}: queued signings take their seats, academy drivers
          develop, your car's progress carries over, and a fresh championship begins.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={advance} disabled={!state.seasonComplete || advancing}>
            {advancing ? 'Loading…' : `Advance to ${nextYear} Season →`}
          </Button>
          {!state.seasonComplete && (
            <span className="self-center text-xs text-neutral-500">
              Finish the current season first.
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Coming in Later Phases">
        <p className="text-sm text-neutral-400">
          Budget allocation, regulation changes, staff decisions, new car design and AI driver-market
          activity arrive with the management systems (Phase D) and multi-year data (Phase E).
        </p>
      </Panel>
    </div>
  );
}

// Short label for a queued first-option decision.
function decisionLabel(d: FirstOptionDecision): string {
  switch (d) {
    case 'race_seat':
      return 'Promoting to a race seat';
    case 'third':
      return 'Signing as 3rd driver';
    case 'reserve':
      return 'Signing as reserve driver';
    case 'test':
      return 'Signing as test driver';
    case 'extend':
      return 'Extending development rights';
    case 'release':
      return 'Releasing to the driver market';
  }
}

// One category of the Market Outlook: a labelled, capped list of registry
// drivers (or an em-dash when the category is empty).
function OutlookGroup({
  label,
  accent,
  entries,
  max = 6,
}: {
  label: string;
  accent: string;
  entries: Pick<MasterDriverEntry, 'driverId' | 'displayName'>[];
  max?: number;
}) {
  const shown = entries.slice(0, max);
  const rest = entries.length - shown.length;
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {label}
        </span>
        <span className={`text-sm font-bold ${accent}`}>{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs text-neutral-600">—</p>
      ) : (
        <p className="mt-1 text-xs text-neutral-400">
          {shown.map((e) => e.displayName).join(', ')}
          {rest > 0 && <span className="text-neutral-600"> +{rest} more</span>}
        </p>
      )}
    </div>
  );
}
