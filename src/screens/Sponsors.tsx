import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { Panel } from '../components/Panel';
import { formatMoney } from '../components/ui';
import {
  sponsorAnnualIncome,
  averageSponsorConfidence,
  generateSponsorOffers,
  sponsorSlotCapacity,
} from '../sim/commercialEngine';
import type { Sponsor } from '../types/sponsorTypes';
import { OWNER_PERSONALITY_LABELS, OWNER_PERSONALITY_DESCRIPTIONS } from '../types/expectationTypes';
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import {
  SPONSORS_WORKSPACE_TABS,
  sponsorObjectiveSummary,
  sponsorPage,
  sponsorPageCount,
  type SponsorsWorkspaceTab,
} from './sponsorsViewModel';

const TYPE_LABEL: Record<Sponsor['type'], string> = {
  Title: 'Title',
  Secondary: 'Secondary',
  TechnicalPartner: 'Technical Partner',
  DriverLinked: 'Driver-Linked',
  PayDriver: 'Pay Driver',
  OneRace: 'One-Race',
};

function confidenceTone(confidence: number): string {
  if (confidence >= 70) return 'text-green-300';
  if (confidence >= 45) return 'text-amber-300';
  return 'text-red-300';
}

export function Sponsors() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<SponsorsWorkspaceTab>('portfolio');
  const [sponsorListPage, setSponsorListPage] = useState(0);
  const [ownerReviewPage, setOwnerReviewPage] = useState(0);

  const commercial = state?.commercial;
  const annual = useMemo(() => sponsorAnnualIncome(commercial), [commercial]);
  const averageConfidence = useMemo(() => averageSponsorConfidence(commercial), [commercial]);
  const team = state ? teamById(state, state.selectedTeamId) : undefined;
  const capacity = team ? sponsorSlotCapacity(team) : 0;
  const offers = useMemo(
    () =>
      state && team
        ? generateSponsorOffers(team, commercial, state.randomSeed, state.seasonYear, state.series)
        : [],
    [state, team, commercial],
  );

  if (!state) return null;

  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const sponsors = commercial?.sponsors ?? [];
  const used = sponsors.length;
  const slotsFull = used >= capacity;
  const objectiveSummary = sponsorObjectiveSummary(sponsors);
  const totalRaces = state.calendar.length;
  const nextRaceInstallment = totalRaces > 0 ? Math.round((annual * 0.75) / totalRaces) : 0;
  const sponsorListPageCount = sponsorPageCount(sponsors.length);
  const safeSponsorListPage = Math.min(sponsorListPage, sponsorListPageCount - 1);
  const visibleSponsors = sponsorPage(sponsors, safeSponsorListPage);
  const ownerReviews = [...(state.expectationReviews ?? [])]
    .filter((review) => review.teamId === state.selectedTeamId)
    .reverse();
  const ownerReviewPageCount = Math.max(1, Math.ceil(ownerReviews.length / 4));
  const safeOwnerReviewPage = Math.min(ownerReviewPage, ownerReviewPageCount - 1);
  const visibleOwnerReviews = ownerReviews.slice(safeOwnerReviewPage * 4, safeOwnerReviewPage * 4 + 4);

  function selectTab(nextTab: SponsorsWorkspaceTab) {
    setTab(nextTab);
    if (nextTab === 'portfolio' || nextTab === 'objectives') setSponsorListPage(0);
  }

  return (
    <div className="era-feature-screen era-sponsors-screen space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Sponsors &amp; Commercial</h1>
          <p className="text-sm text-neutral-400">
            {team?.name} · partnerships, targets, bonuses, and owner pressure
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Commercial reputation</div>
          <div className="text-lg font-bold text-neutral-100">{commercial?.commercialReputation ?? 0} / 100</div>
        </div>
      </div>

      {!commercial ? (
        <Panel title="Commercial">
          <p className="text-sm text-neutral-500">
            No commercial data on this save. Start a new career to generate a sponsor portfolio.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sponsor Slots" value={`${used} / ${capacity}`} tone={slotsFull ? 'bad' : undefined} />
            <Kpi label="Guaranteed / Year" value={formatMoney(annual)} tone="good" />
            <Kpi label="Race Installment" value={formatMoney(nextRaceInstallment)} />
            <Kpi
              label="Average Confidence"
              value={`${averageConfidence} / 100`}
              tone={averageConfidence >= 60 ? 'good' : averageConfidence < 45 ? 'bad' : undefined}
            />
          </div>

          <nav
            aria-label="Sponsor workspaces"
            className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900/50 p-1"
          >
            {SPONSORS_WORKSPACE_TABS.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                aria-current={tab === workspace.id ? 'page' : undefined}
                onClick={() => selectTab(workspace.id)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  tab === workspace.id
                    ? 'bg-sky-500/20 text-sky-200'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                {workspace.label}
                {workspace.id === 'opportunities' ? ` (${offers.length})` : ''}
              </button>
            ))}
          </nav>

          {tab === 'portfolio' && (
            <Panel
              title="Active Sponsor Portfolio"
              actions={<span className="text-xs text-neutral-500">25% upfront · 75% across race installments</span>}
            >
              {sponsors.length === 0 ? (
                <p className="text-sm text-neutral-500">No sponsors are currently signed.</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {visibleSponsors.map((sponsor) => (
                      <SponsorPortfolioCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        onDrop={() => dispatch({ type: 'DROP_SPONSOR', sponsorId: sponsor.id })}
                      />
                    ))}
                  </div>
                  <CompactPagination
                    page={safeSponsorListPage}
                    pageCount={sponsorListPageCount}
                    total={sponsors.length}
                    noun="sponsors"
                    onPageChange={setSponsorListPage}
                  />
                </>
              )}
            </Panel>
          )}

          {tab === 'opportunities' && (
            <Panel
              title="Available Opportunities"
              actions={
                <span className="text-xs text-neutral-500">
                  Deal quality reflects commercial reputation {commercial.commercialReputation}
                </span>
              }
            >
              <p className="mb-3 text-xs text-neutral-500">
                Signing fills a portfolio slot. Guaranteed value follows the standard 25% upfront and
                75% race-installment cash flow. {slotsFull && (
                  <span className="text-red-300">
                    Portfolio full ({used}/{capacity}) — drop a sponsor before signing another.
                  </span>
                )}
              </p>
              {offers.length === 0 ? (
                <p className="text-sm text-neutral-500">No new sponsor deals are on offer right now.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {offers.map((offer) => (
                    <SponsorOfferCard
                      key={offer.id}
                      offer={offer}
                      disabled={slotsFull}
                      onSign={() => dispatch({ type: 'SIGN_SPONSOR', offerId: offer.id })}
                    />
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === 'objectives' && (
            <Panel
              title="Objectives & Performance Bonuses"
              actions={
                <div className="flex gap-2 text-xs">
                  <span className="text-neutral-500">Pending {objectiveSummary.Pending}</span>
                  <span className="text-green-300">Met {objectiveSummary.Met}</span>
                  <span className="text-red-300">Missed {objectiveSummary.Failed}</span>
                </div>
              }
            >
              {sponsors.length === 0 ? (
                <p className="text-sm text-neutral-500">Sign a sponsor to receive objectives and bonuses.</p>
              ) : (
                <>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {visibleSponsors.map((sponsor) => (
                      <SponsorTermsCard key={sponsor.id} sponsor={sponsor} />
                    ))}
                  </div>
                  <CompactPagination
                    page={safeSponsorListPage}
                    pageCount={sponsorListPageCount}
                    total={sponsors.length}
                    noun="sponsors"
                    onPageChange={setSponsorListPage}
                  />
                </>
              )}
            </Panel>
          )}

          {tab === 'owner' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel
                title="Owner Expectations"
                actions={
                  <CharacterDossierButton state={state} subject={{ type: 'owner', teamId: state.selectedTeamId }}>
                    Owner Card
                  </CharacterDossierButton>
                }
              >
                {expectation ? (
                  <OwnerExpectationContent
                    expectation={expectation}
                    ownerPersonality={reputation?.ownerPersonality}
                    ownerPatience={reputation?.ownerPatience ?? expectation.ownerPatience}
                  />
                ) : (
                  <p className="text-sm text-neutral-500">No owner expectations are recorded.</p>
                )}
              </Panel>

              <Panel title="Owner Reviews">
                {ownerReviews.length === 0 ? (
                  <p className="text-sm text-neutral-500">No completed season reviews yet.</p>
                ) : (
                  <>
                    <div className="space-y-2 text-sm">
                      {visibleOwnerReviews.map((review) => (
                        <div
                          key={`${review.teamId}-${review.seasonYear}`}
                          className="grid grid-cols-[3rem_minmax(0,1fr)_2rem] gap-2 rounded-lg border border-neutral-800 bg-neutral-950/30 p-2"
                        >
                          <span className="text-neutral-500">{review.seasonYear}</span>
                          <span className={review.primaryObjectiveMet ? 'text-green-300' : 'text-red-300'}>
                            {review.summary}
                          </span>
                          <span className="text-right tabular-nums text-neutral-400">
                            {review.patienceDelta >= 0 ? '+' : ''}{review.patienceDelta}
                          </span>
                        </div>
                      ))}
                    </div>
                    <CompactPagination
                      page={safeOwnerReviewPage}
                      pageCount={ownerReviewPageCount}
                      total={ownerReviews.length}
                      noun="reviews"
                      onPageChange={setOwnerReviewPage}
                    />
                  </>
                )}
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SponsorPortfolioCard({
  sponsor,
  onDrop,
}: {
  sponsor: Sponsor;
  onDrop: () => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-neutral-100" title={sponsor.name}>{sponsor.name}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{TYPE_LABEL[sponsor.type]}</div>
        </div>
        <span className="shrink-0 font-semibold tabular-nums text-green-300">${sponsor.annualValue}M</span>
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        <Row label="Confidence" value={`${sponsor.confidence} / 100`} valueClass={confidenceTone(sponsor.confidence)} />
        <Row label="Contract" value={`${sponsor.contractYearsRemaining} yr left`} />
        <Row label="Renewal chance" value={`${Math.round(sponsor.renewalChance * 100)}%`} />
        <Row label="Objectives" value={`${sponsor.objectives.length}`} />
      </div>
      <button
        type="button"
        onClick={onDrop}
        className="mt-3 w-full rounded border border-neutral-700 px-2 py-1 text-xs font-semibold text-red-300 hover:border-red-500/60 hover:bg-red-500/10"
      >
        Drop sponsor
      </button>
    </div>
  );
}

function SponsorOfferCard({
  offer,
  disabled,
  onSign,
}: {
  offer: Sponsor;
  disabled: boolean;
  onSign: () => void;
}) {
  const objective = offer.objectives[0];
  const bonus = offer.bonusTerms[0];
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-neutral-100" title={offer.name}>{offer.name}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{TYPE_LABEL[offer.type]}</div>
        </div>
        <span className="shrink-0 font-semibold tabular-nums text-green-300">${offer.annualValue}M</span>
      </div>
      <div className="mt-2 space-y-1 text-[11px] leading-snug text-neutral-400">
        <div>{offer.contractYearsRemaining} year term · confidence {offer.confidence}</div>
        <div className="min-h-7 text-neutral-500">{objective ? `Target: ${objective.description}` : 'No performance objective'}</div>
        <div className="min-h-7 text-neutral-500">{bonus ? `Bonus: ${bonus.description}` : 'No performance bonus'}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSign}
        className="mt-2 w-full rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
      >
        {disabled ? 'No free slot' : 'Sign sponsor'}
      </button>
    </div>
  );
}

function SponsorTermsCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="font-semibold text-neutral-100">{sponsor.name}</div>
        <span className={`text-xs font-semibold ${confidenceTone(sponsor.confidence)}`}>
          Confidence {sponsor.confidence}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Objectives</div>
          {sponsor.objectives.length === 0 ? (
            <div className="text-xs text-neutral-600">No objectives</div>
          ) : sponsor.objectives.map((objective) => (
            <div key={objective.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-neutral-300">{objective.description}</span>
              <ObjectiveStatus status={objective.status} />
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Performance bonuses</div>
          {sponsor.bonusTerms.length === 0 ? (
            <div className="text-xs text-neutral-600">No bonus terms</div>
          ) : sponsor.bonusTerms.map((bonus) => (
            <div key={bonus.id} className="text-xs text-neutral-300">{bonus.description}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OwnerExpectationContent({
  expectation,
  ownerPersonality,
  ownerPatience,
}: {
  expectation: NonNullable<NonNullable<ReturnType<typeof useGame>['state']>['teamExpectations']>[string];
  ownerPersonality?: keyof typeof OWNER_PERSONALITY_LABELS;
  ownerPatience: number;
}) {
  return (
    <div className="space-y-2 text-sm">
      {ownerPersonality && (
        <div className="rounded bg-neutral-800/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">Owner type</span>
            <span className="font-semibold text-neutral-100">{OWNER_PERSONALITY_LABELS[ownerPersonality]}</span>
          </div>
          <div className="mt-1 text-xs text-neutral-500">{OWNER_PERSONALITY_DESCRIPTIONS[ownerPersonality]}</div>
        </div>
      )}
      <Row label="Primary objective" value={expectation.primaryObjective} valueClass="text-neutral-100" />
      {expectation.minimumConstructorPosition !== undefined && (
        <Row label="Minimum constructors position" value={`P${expectation.minimumConstructorPosition}`} />
      )}
      {expectation.targetPoints !== undefined && <Row label="Target points" value={`${expectation.targetPoints}`} />}
      {expectation.requiredWins !== undefined && <Row label="Required wins" value={`${expectation.requiredWins}`} />}
      <div className="border-t border-neutral-800 pt-2">
        <Row label="Owner patience" value={`${ownerPatience} / 100`} valueClass={confidenceTone(ownerPatience)} />
      </div>
      {expectation.secondaryObjectives.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-2 text-xs text-neutral-500">
          {expectation.secondaryObjectives.map((objective) => <div key={objective}>· {objective}</div>)}
        </div>
      )}
    </div>
  );
}

function ObjectiveStatus({ status }: { status?: 'Pending' | 'Met' | 'Failed' }) {
  if (status === 'Met') return <span className="shrink-0 font-semibold text-green-300">Met</span>;
  if (status === 'Failed') return <span className="shrink-0 font-semibold text-red-300">Missed</span>;
  return <span className="shrink-0 text-neutral-500">Pending</span>;
}

function CompactPagination({
  page,
  pageCount,
  total,
  noun,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  noun: string;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-xs text-neutral-500">
      <span>{total} {noun} · Page {page + 1} of {pageCount}</span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-neutral-700 px-2 py-1 text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-green-300' : tone === 'bad' ? 'text-red-300' : 'text-neutral-100';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-0.5 truncate text-xl font-bold ${color}`} title={value}>{value}</div>
    </div>
  );
}

function Row({ label, value, valueClass = 'text-neutral-400' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-neutral-300">{label}</span>
      <span className={`text-right tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
