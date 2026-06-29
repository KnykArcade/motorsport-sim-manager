import { useMemo } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { Panel } from '../components/Panel';
import {
  sponsorAnnualIncome,
  averageSponsorConfidence,
} from '../sim/commercialEngine';
import type { Sponsor } from '../types/sponsorTypes';

const TYPE_LABEL: Record<Sponsor['type'], string> = {
  Title: 'Title',
  Secondary: 'Secondary',
  TechnicalPartner: 'Technical Partner',
  DriverLinked: 'Driver-Linked',
  PayDriver: 'Pay Driver',
  OneRace: 'One-Race',
};

function confidenceTone(c: number): string {
  if (c >= 70) return 'text-green-300';
  if (c >= 45) return 'text-amber-300';
  return 'text-red-300';
}

export function Sponsors() {
  const { state } = useGame();

  const commercial = state?.commercial;
  const annual = useMemo(() => sponsorAnnualIncome(commercial), [commercial]);
  const avgConfidence = useMemo(() => averageSponsorConfidence(commercial), [commercial]);

  if (!state) return null;
  const team = teamById(state, state.selectedTeamId);
  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const reputation = state.teamReputations?.[state.selectedTeamId];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Sponsors &amp; Commercial</h1>
        <p className="text-sm text-neutral-400">{team?.name} · portfolio, objectives &amp; owner expectations</p>
      </div>

      {!commercial ? (
        <Panel title="Commercial">
          <p className="text-sm text-neutral-500">
            No commercial data on this save. Start a new career to generate a sponsor portfolio.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sponsors" value={String(commercial.sponsors.length)} />
            <Kpi label="Annual Income" value={`$${(annual / 1_000_000).toFixed(1)}M`} tone="good" />
            <Kpi label="Avg. Confidence" value={`${avgConfidence}`} tone={avgConfidence >= 60 ? 'good' : avgConfidence >= 45 ? undefined : 'bad'} />
            <Kpi label="Commercial Rep." value={`${commercial.commercialReputation}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {commercial.sponsors.map((s) => (
              <Panel key={s.id} title={s.name}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-300">
                      {TYPE_LABEL[s.type]}
                    </span>
                    <span className="tabular-nums text-neutral-200">${s.annualValue}M / yr</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-400">Confidence</span>
                    <span className={`font-semibold tabular-nums ${confidenceTone(s.confidence)}`}>{s.confidence}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>Contract: {s.contractYearsRemaining} yr left</span>
                    <span>Renewal: {Math.round(s.renewalChance * 100)}%</span>
                  </div>

                  {s.bonusTerms.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Performance bonuses</div>
                      <ul className="space-y-0.5 text-sm text-neutral-300">
                        {s.bonusTerms.map((b) => (
                          <li key={b.id}>• {b.description}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {s.objectives.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Objectives</div>
                      <ul className="space-y-0.5 text-sm">
                        {s.objectives.map((o) => (
                          <li key={o.id} className="flex items-center justify-between">
                            <span className="text-neutral-300">{o.description}</span>
                            <ObjectiveStatus status={o.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}

      {expectation && (
        <Panel title="Owner Expectations">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-300">Primary objective</span>
              <span className="font-semibold text-neutral-100">{expectation.primaryObjective}</span>
            </div>
            {expectation.minimumConstructorPosition !== undefined && (
              <Row label="Minimum constructors position" value={`P${expectation.minimumConstructorPosition}`} />
            )}
            {expectation.targetPoints !== undefined && (
              <Row label="Target points" value={`${expectation.targetPoints}`} />
            )}
            {expectation.requiredWins !== undefined && (
              <Row label="Required wins" value={`${expectation.requiredWins}`} />
            )}
            <div className="flex items-center justify-between border-t border-neutral-800 pt-2">
              <span className="text-neutral-300">Owner patience</span>
              <span className={`font-semibold tabular-nums ${confidenceTone(reputation?.ownerPatience ?? expectation.ownerPatience)}`}>
                {reputation?.ownerPatience ?? expectation.ownerPatience}
              </span>
            </div>
            {expectation.secondaryObjectives.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-neutral-500">
                {expectation.secondaryObjectives.map((o) => (
                  <li key={o}>• {o}</li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      )}

      {(state.expectationReviews?.length ?? 0) > 0 && (
        <Panel title="Owner Reviews">
          <div className="space-y-1.5 text-sm">
            {[...(state.expectationReviews ?? [])]
              .filter((r) => r.teamId === state.selectedTeamId)
              .reverse()
              .map((r) => (
                <div key={`${r.teamId}-${r.seasonYear}`} className="flex items-start justify-between gap-3 border-t border-neutral-800/60 pt-1.5">
                  <span className="text-neutral-500">{r.seasonYear}</span>
                  <span className={`flex-1 ${r.primaryObjectiveMet ? 'text-green-300' : 'text-red-300'}`}>{r.summary}</span>
                  <span className="tabular-nums text-neutral-400">{r.patienceDelta >= 0 ? '+' : ''}{r.patienceDelta}</span>
                </div>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function ObjectiveStatus({ status }: { status?: 'Pending' | 'Met' | 'Failed' }) {
  if (status === 'Met') return <span className="text-xs font-semibold text-green-300">Met</span>;
  if (status === 'Failed') return <span className="text-xs font-semibold text-red-300">Missed</span>;
  return <span className="text-xs text-neutral-500">Pending</span>;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-green-300' : tone === 'bad' ? 'text-red-300' : 'text-neutral-100';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-300">{label}</span>
      <span className="tabular-nums text-neutral-400">{value}</span>
    </div>
  );
}
