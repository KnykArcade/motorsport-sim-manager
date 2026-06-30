import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RENEW_THRESHOLD, SACK_THRESHOLD } from '../sim/principalEngine';
import type { JobOffer } from '../types/principalTypes';

export function TeamPrincipal() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  const principal = state.principal;
  if (!principal) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-100">Team Principal</h1>
        <Panel title="Team Principal">
          <p className="text-sm text-neutral-400">The job market is available in Career Mode.</p>
        </Panel>
      </div>
    );
  }

  const currentTeam = teamById(state, principal.currentTeamId);
  const offers = state.jobOffers ?? [];
  const accepted = state.acceptedJobOfferId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Team Principal</h1>
        <p className="text-sm text-neutral-400">
          Your reputation, contract and job security as a manager. Perform to expectations to stay in
          the seat — or accept a rival's approach to move on. Moves take effect next season.
        </p>
      </div>

      <Panel title="Your Standing">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-neutral-100">{principal.name}</div>
            <div className="text-sm text-amber-400">
              {currentTeam?.name ?? 'Between teams'}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Contract: {principal.contractYearsRemaining} year
              {principal.contractYearsRemaining === 1 ? '' : 's'} remaining
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Reputation" value={String(principal.reputation)} />
            <Metric label="Job Security" value={String(principal.jobSecurity)} tone={securityTone(principal.jobSecurity)} />
            <Metric label="Seasons" value={String(principal.careerStats.seasonsCompleted)} />
          </div>
        </div>
        <JobSecurityBar value={principal.jobSecurity} />
      </Panel>

      <Panel title="Attributes">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Media Image" value={String(principal.attributes.mediaImage)} />
          <Metric label="Board Confidence" value={String(principal.attributes.boardConfidence)} />
          <Metric label="Financial Discipline" value={String(principal.attributes.financialDiscipline)} />
          <Metric label="Driver Management" value={String(principal.attributes.driverManagement)} />
          <Metric label="Development" value={String(principal.attributes.development)} />
          <Metric label="Strategy" value={String(principal.attributes.strategy)} />
        </div>
      </Panel>

      <Panel title="Career Record">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Race Wins" value={String(principal.careerStats.raceWins)} />
          <Metric label="Podiums" value={String(principal.careerStats.podiums)} />
          <Metric label="Drivers' Titles" value={String(principal.careerStats.driverTitles)} />
          <Metric label="Constructors' Titles" value={String(principal.careerStats.constructorTitles)} />
          <Metric label="Teams Managed" value={String(principal.careerStats.teamsManaged.length)} />
        </div>
      </Panel>

      <Panel title="Job Market">
        {offers.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No rival teams are approaching you right now. Strong results draw more interest.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                teamName={teamById(state, offer.teamId)?.name ?? offer.teamId}
                accepted={accepted === offer.id}
                onAccept={() => dispatch({ type: 'ACCEPT_JOB_OFFER', offerId: offer.id })}
                onDecline={() => dispatch({ type: 'DECLINE_JOB_OFFER', offerId: offer.id })}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function securityTone(value: number): string {
  if (value < SACK_THRESHOLD) return 'text-red-400';
  if (value < RENEW_THRESHOLD) return 'text-amber-300';
  return 'text-green-400';
}

function JobSecurityBar({ value }: { value: number }) {
  const tone =
    value < SACK_THRESHOLD ? 'bg-red-500' : value < RENEW_THRESHOLD ? 'bg-amber-400' : 'bg-green-500';
  const label =
    value < SACK_THRESHOLD
      ? 'On the brink — a poor season ends your tenure.'
      : value < RENEW_THRESHOLD
        ? 'Under pressure — the board wants results.'
        : 'Secure — the board backs you.';
  return (
    <div className="mt-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function OfferCard({
  offer,
  teamName,
  accepted,
  onAccept,
  onDecline,
}: {
  offer: JobOffer;
  teamName: string;
  accepted: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const firm = offer.kind === 'Offer';
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold text-neutral-100">{teamName}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
            firm ? 'bg-sky-950/60 text-sky-300' : 'bg-neutral-800 text-neutral-400'
          }`}
        >
          {firm ? 'Firm Offer' : 'Rumor'}
        </span>
      </div>
      <p className="text-xs text-neutral-400">{offer.objective}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        <Tag>Prestige {offer.prestige}</Tag>
        <Tag>{offer.budgetTier}</Tag>
        <Tag>{offer.contractYears}-yr deal</Tag>
      </div>
      <div className="mt-2">
        {!firm ? (
          <div className="text-center text-[11px] text-neutral-500">Informal interest only</div>
        ) : accepted ? (
          <Button variant="secondary" className="w-full px-2 py-1 text-xs" onClick={onAccept}>
            Accepted — click to cancel
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1 px-2 py-1 text-xs" onClick={onAccept}>
              Accept for next season
            </Button>
            <Button variant="secondary" className="px-2 py-1 text-xs" onClick={onDecline}>
              Decline
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${tone ?? 'text-neutral-100'}`}>{value}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-neutral-800/60 px-1.5 py-0.5 text-neutral-300">{children}</span>;
}
