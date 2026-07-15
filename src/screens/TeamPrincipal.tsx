import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RENEW_THRESHOLD, SACK_THRESHOLD } from '../sim/principalEngine';
import { ratingColor } from '../components/ui';
import type { JobOffer } from '../types/principalTypes';
import { DEPARTMENT_IDS, TEAM_CULTURE_AXES } from '../types/phase18Types';
import {
  cultureDescriptor,
  leadershipGameplayModifiers,
  PRINCIPAL_IDENTITY_DESCRIPTIONS,
  PRINCIPAL_IDENTITY_LABELS,
} from '../sim/phase18IdentityCultureEngine';
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import {
  PRINCIPAL_COMMAND_TABS,
  PRINCIPAL_OFFERS_PER_PAGE,
  principalJobOfferPage,
  type PrincipalCommandTab,
} from './teamPrincipalViewModel';

export function TeamPrincipal() {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = useState<PrincipalCommandTab>('standing');
  const [offerPage, setOfferPage] = useState(0);
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
  const identity = state.phase18?.principalIdentity;
  const culture = state.phase18?.teamCultures[state.selectedTeamId];
  const departments = state.phase18?.departmentMoods[state.selectedTeamId];
  const leadershipModifiers = leadershipGameplayModifiers(state);
  const offerPageCount = Math.max(1, Math.ceil(offers.length / PRINCIPAL_OFFERS_PER_PAGE));
  const safeOfferPage = Math.min(offerPage, offerPageCount - 1);
  const visibleOffers = principalJobOfferPage(offers, safeOfferPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Team Principal</h1>
        <p className="text-sm text-neutral-400">
          Your reputation, contract and job security as a manager. Perform to expectations to stay in
          the seat — or accept a rival's approach to move on. Moves take effect next season.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-1.5">
        <nav className="grid grid-cols-2 gap-1 sm:grid-cols-5" aria-label="Team Principal command center sections">
          {PRINCIPAL_COMMAND_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              title={tab.description}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeTab === tab.id ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <p className="px-2 pb-1 pt-2 text-[11px] text-neutral-500">
          {PRINCIPAL_COMMAND_TABS.find((tab) => tab.id === activeTab)?.description}
        </p>
      </div>

      {activeTab === 'standing' && (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            title="Your Standing"
            actions={<CharacterDossierButton state={state} subject={{ type: 'playerPrincipal' }}>Your Character Card</CharacterDossierButton>}
          >
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
        </div>
      )}

      {identity && activeTab === 'identity' && (
          <Panel title="Leadership Identity">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <div>
                <div className="text-lg font-bold text-amber-300">
                  {PRINCIPAL_IDENTITY_LABELS[identity.dominantIdentity]}
                </div>
                <p className="mt-1 text-sm text-neutral-400">
                  {PRINCIPAL_IDENTITY_DESCRIPTIONS[identity.dominantIdentity]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Tag>{identity.totalIdentityXp} leadership XP</Tag>
                  {identity.secondaryIdentity && (
                    <Tag>Secondary: {PRINCIPAL_IDENTITY_LABELS[identity.secondaryIdentity]}</Tag>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(identity.scores)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([key, score]) => (
                    <RatingBar
                      key={key}
                      label={PRINCIPAL_IDENTITY_LABELS[key as keyof typeof PRINCIPAL_IDENTITY_LABELS]}
                      value={score}
                      max={Math.max(12, ...Object.values(identity.scores))}
                    />
                  ))}
              </div>
            </div>
            {identity.history.length > 0 && (
              <div className="mt-4 border-t border-neutral-800 pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Recent defining decisions</div>
                <ul className="mt-2 space-y-1 text-xs text-neutral-400">
                  {identity.history.slice(-3).reverse().map((entry) => (
                    <li key={entry.id}>+{entry.amount} {PRINCIPAL_IDENTITY_LABELS[entry.identity]} — {entry.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
      )}

      {culture && activeTab === 'culture' && (
          <Panel title="Team Culture">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-neutral-100">{cultureDescriptor(culture)}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  Culture belongs to {currentTeam?.name ?? 'the team'} and remains if its principal changes.
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <Tag>Cohesion {Math.round(culture.cohesion)}</Tag>
                <Tag>Stability {Math.round(culture.stability)}</Tag>
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {TEAM_CULTURE_AXES.map((axis) => (
                <RatingBar key={axis} label={splitLabel(axis)} value={culture.axes[axis]} max={100} />
              ))}
            </div>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
              <ModifierCard label="Development outcomes" value={leadershipModifiers.developmentSuccessBonus} />
              <ModifierCard label="Morale influence" value={leadershipModifiers.moraleEffectMultiplier - 1} />
              <ModifierCard label="Race preparation" value={leadershipModifiers.preparationEffectMultiplier - 1} />
            </div>
          </Panel>
      )}

      {departments && activeTab === 'departments' && (
          <Panel title="Department Confidence">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {DEPARTMENT_IDS.map((departmentId) => {
                const mood = departments[departmentId];
                return (
                  <div key={departmentId} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <div className="text-xs font-semibold text-neutral-200">{splitLabel(departmentId)}</div>
                    <div className="mt-2 space-y-1">
                      <RatingBar label="Trust" value={mood.trustInPrincipal} max={100} compact />
                      <RatingBar label="Alignment" value={mood.strategicAlignment} max={100} compact />
                      <RatingBar label="Morale" value={mood.morale} max={100} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
      )}

      {activeTab === 'career' && (
        <div className="space-y-4">
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
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleOffers.map((offer) => (
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
                {offerPageCount > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-800 pt-3">
                    <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setOfferPage(Math.max(0, safeOfferPage - 1))} disabled={safeOfferPage === 0}>Previous</Button>
                    <span className="text-xs text-neutral-500">Offer page {safeOfferPage + 1} of {offerPageCount}</span>
                    <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setOfferPage(Math.min(offerPageCount - 1, safeOfferPage + 1))} disabled={safeOfferPage >= offerPageCount - 1}>Next</Button>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function securityTone(value: number): string {
  if (value < SACK_THRESHOLD) return 'text-red-400';
  if (value < RENEW_THRESHOLD) return 'text-amber-300';
  return 'text-green-400';
}

function JobSecurityBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = ratingColor(clamped);
  const label =
    value < SACK_THRESHOLD
      ? 'On the brink — a poor season ends your tenure.'
      : value < RENEW_THRESHOLD
        ? 'Under pressure — the board wants results.'
        : 'Secure — the board backs you.';
  return (
    <div className="mt-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full" style={{ width: `${clamped}%`, backgroundColor: color }} />
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

function RatingBar({ label, value, max, compact = false }: { label: string; value: number; max: number; compact?: boolean }) {
  const width = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className={`flex justify-between ${compact ? 'text-[10px]' : 'text-xs'} text-neutral-400`}>
        <span>{label}</span><span>{Math.round(value)}</span>
      </div>
      <div className={`${compact ? 'mt-0.5 h-1' : 'mt-1 h-1.5'} overflow-hidden rounded-full bg-neutral-800`}>
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ModifierCard({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40 p-2 text-neutral-400">
      <div>{label}</div>
      <div className={`font-semibold ${percent > 0 ? 'text-green-400' : percent < 0 ? 'text-red-400' : 'text-neutral-300'}`}>
        {percent > 0 ? '+' : ''}{percent}%
      </div>
    </div>
  );
}

function splitLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}
