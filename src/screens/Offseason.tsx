import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { activeDriversForTeam } from '../game/careerState';
import { thirdDriverAmbitions } from '../sim/contractEngine';
import { marketRolloverChanges } from '../sim/careerMarketEngine';
import { crossSeriesCandidates } from '../sim/crossSeriesEngine';
import { academyMemberAge } from '../sim/driverMarketEngine';
import { isPromotionEligible } from '../sim/youthAcademyEngine';
import { loadSeasonBundle, preloadMarketBundle } from '../data';
import type { FirstOptionDecision } from '../types/marketTypes';
import type { MasterDriverEntry } from '../types/registryTypes';

type OffseasonTab = 'overview' | 'lineup' | 'academy' | 'market' | 'advance';

export function Offseason() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [advancing, setAdvancing] = useState(false);
  const [tab, setTab] = useState<OffseasonTab>('overview');
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
  const academyDecisionCount = promotionEligible.filter((driver) => decisionFor(driver.id)).length;
  const unresolvedAcademyRights = promotionEligible.length - academyDecisionCount;
  const atRiskReserves = ambitions.filter((driver) => driver.wantsSeat && !reservePromotionFor(driver.driverId));
  const marketMovement = rollover.newAdults.length + rollover.newYouth.length + rollover.promotedYouth.length + rollover.retirements.length + crossover.length;
  const canAdvance = state.seasonComplete && !advancing;
  const advanceBlockedReason = !state.seasonComplete ? 'Finish the current season first' : advancing ? 'Loading next season data' : undefined;
  const tabs: ReadonlyArray<{ id: OffseasonTab; label: string }> = [
    { id: 'overview', label: 'Transition Overview' },
    { id: 'lineup', label: `Line-up (${signings.length})` },
    { id: 'academy', label: `Academy (${academy.length})` },
    { id: 'market', label: `Market Outlook (${marketMovement})` },
    { id: 'advance', label: 'Advance Season' },
  ];

  const advance = () => {
    setAdvancing(true);
    Promise.all([
      loadSeasonBundle(nextYear, state.series),
      preloadMarketBundle(nextYear, state.series),
    ])
      .then(([nextBundle]) => {
        dispatch({ type: 'ADVANCE_SEASON', nextBundle });
        navigate('/hq');
      })
      .catch(() => {
        dispatch({ type: 'ADVANCE_SEASON' });
        navigate('/hq');
      });
  };

  return (
    <WorkspaceScreen className="era-feature-screen era-offseason-screen">
      <WorkspaceHeader
        eyebrow="Season transition"
        title={`${state.seasonYear} → ${nextYear} Offseason`}
        subtitle="Set the next-year line-up, resolve academy rights, review market movement, and roll the universe forward"
        actions={<>
          <Button variant="ghost" onClick={() => navigate('/')}>Main Menu</Button>
          <Button variant="primary" onClick={advance} disabled={!canAdvance} title={advanceBlockedReason}>
            {advancing ? 'Loading…' : `Advance to ${nextYear} →`}
          </Button>
        </>}
      />
      <MetricStrip>
        <WorkspaceMetric label="Next season" value={`${nextYear} ${state.series}`} detail={`${state.calendar.length} current-year calendar rounds`} />
        <WorkspaceMetric label="Queued seat changes" value={signings.length} detail={signings.length ? 'Applied at season rollover' : 'Current race line-up retained'} />
        <WorkspaceMetric label="Academy rights" value={`${academyDecisionCount}/${promotionEligible.length}`} detail={unresolvedAcademyRights ? `${unresolvedAcademyRights} optional choice${unresolvedAcademyRights === 1 ? '' : 's'} unresolved` : 'All eligible drivers resolved'} />
        <WorkspaceMetric label="Market movement" value={marketMovement} detail={`${atRiskReserves.length} reserve driver${atRiskReserves.length === 1 ? '' : 's'} at risk`} />
      </MetricStrip>
      <WorkspaceTabs items={tabs} active={tab} onChange={setTab} ariaLabel="Offseason management sections" />
      <WorkspaceBody className="space-y-4">

      {tab === 'overview' && <>
        <Panel title="Transition Readiness">
          <div className="grid gap-3 md:grid-cols-2">
            <ReadinessItem label="Season status" value={state.seasonComplete ? 'Complete' : 'In progress'} detail={state.seasonComplete ? `The ${nextYear} rollover is unlocked.` : 'Finish the current championship before advancing.'} tone={state.seasonComplete ? 'good' : 'warning'} />
            <ReadinessItem label="Race line-up" value={signings.length ? `${signings.length} change${signings.length === 1 ? '' : 's'} queued` : 'No changes queued'} detail={signings.length ? 'Queued signings replace their assigned seat drivers at rollover.' : 'The current race line-up will carry into next season.'} />
            <ReadinessItem label="Academy first options" value={unresolvedAcademyRights ? `${unresolvedAcademyRights} unresolved` : 'No unresolved choices'} detail={unresolvedAcademyRights ? 'These choices are optional; undecided drivers remain under academy rights and return next year.' : 'Every promotion-eligible academy driver has a recorded plan.'} tone={unresolvedAcademyRights ? 'warning' : 'good'} />
            <ReadinessItem label="Reserve ambitions" value={atRiskReserves.length ? `${atRiskReserves.length} at risk` : 'Stable'} detail={atRiskReserves.length ? 'Unpromoted out-performers may leave for a rival during rollover.' : 'No reserve driver is currently threatening to leave.'} tone={atRiskReserves.length ? 'danger' : 'good'} />
          </div>
        </Panel>
        <Panel title="What Advances with the Universe">
          <div className="grid gap-2 text-xs text-neutral-400 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><b className="block text-neutral-200">People</b>Queued signings, academy decisions, reserve ambitions, contracts, development, aging, and retirements settle.</div>
            <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><b className="block text-neutral-200">Technical</b>Car carryover, active research, supplier agreements, facility progress, and regulation changes move into {nextYear}.</div>
            <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><b className="block text-neutral-200">Commercial</b>Sponsor objectives, owner review, annual commitments, and next-season finances are processed by the rollover engine.</div>
            <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><b className="block text-neutral-200">Rival teams</b>AI teams resolve their own seats, staff, development, engine, facilities, and strategic offseason choices.</div>
          </div>
        </Panel>
      </>}

      {tab === 'lineup' && <>
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

      </>}
      {tab === 'academy' && <>
      <Panel title={`Academy (${academy.length})`}>
        {academy.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No academy drivers. Sign youth prospects in the Driver Market — they develop each
            offseason toward senior-series readiness.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {academy.map((a) => {
              const age = academyMemberAge(a, nextYear);
              const eligible = isPromotionEligible(a, nextYear);
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 text-neutral-300">
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
                    <span className="mr-2">{a.yearsUntilF1Ready <= 0 ? 'race-seat ready' : `~${a.yearsUntilF1Ready}y to senior seat`}</span>
                    <DriverDossierButton
                      state={state}
                      subject={{ type: 'academy', driver: a }}
                      context={`Academy - ${nextYear} decision`}
                      focus="development"
                    />
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
                        {a.yearsUntilF1Ready <= 0 ? 'race-seat ready' : `~${a.yearsUntilF1Ready}y to senior seat`})
                      </span>
                    </span>
                    <DriverDossierButton
                      state={state}
                      subject={{ type: 'academy', driver: a }}
                      context="First-option decision"
                      focus="development"
                    />
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

      </>}

      {tab === 'lineup' && ambitions.length > 0 && (
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

      {tab === 'market' && <Panel title={`Market Outlook for ${nextYear}`}>
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
      </Panel>}

      {tab === 'advance' && <Panel title="Advance the Season">
        <p className="text-sm text-neutral-300">
          Advancing rolls the team into {nextYear}: queued signings take their seats, academy drivers
          develop, commercial and owner reviews settle, facilities and regulations resolve, your car's
          progress carries over, rival teams make their moves, and a fresh championship begins.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ReadinessItem label="Season gate" value={state.seasonComplete ? 'Ready' : 'Blocked'} detail={state.seasonComplete ? 'The completed season can roll forward.' : 'The current season must be completed first.'} tone={state.seasonComplete ? 'good' : 'danger'} />
          <ReadinessItem label="Optional choices" value={unresolvedAcademyRights + atRiskReserves.length} detail="Unresolved academy rights do not block rollover; at-risk reserves may leave." tone={unresolvedAcademyRights + atRiskReserves.length ? 'warning' : 'good'} />
          <ReadinessItem label="Queued changes" value={signings.length} detail="Seat changes are applied only when the season advances." />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={advance} disabled={!canAdvance} title={advanceBlockedReason}>
            {advancing ? 'Loading…' : `Advance to ${nextYear} Season →`}
          </Button>
          {!state.seasonComplete && (
            <span className="self-center text-xs text-neutral-500">
              Finish the current season first.
            </span>
          )}
        </div>
      </Panel>}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function ReadinessItem({ label, value, detail, tone = 'neutral' }: { label: string; value: string | number; detail: string; tone?: 'neutral' | 'good' | 'warning' | 'danger' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : tone === 'danger' ? 'text-red-300' : 'text-neutral-100';
  return <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className={`mt-1 text-sm font-bold ${color}`}>{value}</div><p className="mt-1 text-xs text-neutral-500">{detail}</p></div>;
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
