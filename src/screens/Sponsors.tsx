import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { Panel } from '../components/Panel';
import { formatMoney } from '../components/ui';
import {
  sponsorAnnualIncome,
  averageSponsorConfidence,
  generateSponsorOffers,
  sponsorSlotCapacity,
  sponsorTerminationBuyout,
} from '../sim/commercialEngine';
import type { Sponsor, SponsorContractTerms, SponsorNegotiation } from '../types/sponsorTypes';
import { OWNER_PERSONALITY_LABELS, OWNER_PERSONALITY_DESCRIPTIONS } from '../types/expectationTypes';
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import {
  SPONSORS_WORKSPACE_TABS,
  sponsorObjectiveSummary,
  sponsorPage,
  sponsorPageCount,
  type SponsorsWorkspaceTab,
} from './sponsorsViewModel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

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

function relationshipLabel(sponsor: Sponsor): string {
  if (sponsor.confidence <= 20) return 'Breach';
  if (sponsor.confidence <= 40) return 'Warning';
  if (sponsor.confidence <= 65) return 'Monitoring';
  return 'Secure';
}

export function Sponsors() {
  const { state, dispatch } = useGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = SPONSORS_WORKSPACE_TABS.some((item) => item.id === requestedTab)
    ? requestedTab as SponsorsWorkspaceTab
    : 'portfolio';
  const [tab, setTab] = useState<SponsorsWorkspaceTab>(initialTab);
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
        ? generateSponsorOffers(team, commercial, state.randomSeed, state.seasonYear, state.series, state.currentRaceIndex)
        : [],
    [state, team, commercial],
  );

  if (!state) return null;

  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const sponsors = commercial?.sponsors ?? [];
  const used = sponsors.length;
  const negotiations = commercial?.negotiations ?? [];
  const activeNegotiations = negotiations.filter((item) => item.status === 'Draft' || item.status === 'Countered');
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
    setSearchParams(nextTab === 'portfolio' ? {} : { tab: nextTab }, { replace: true });
    if (nextTab === 'portfolio' || nextTab === 'objectives') setSponsorListPage(0);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-sponsors-screen">
      <WorkspaceHeader
        eyebrow="Commercial center"
        title="Sponsors & Commercial"
        subtitle={`${team?.name ?? 'Team'} · Partnerships, targets, bonuses, and owner pressure`}
      />

      {!commercial ? (
        <WorkspaceBody>
          <Panel title="Commercial">
            <p className="text-sm text-neutral-500">
              No commercial data on this save. Start a new career to generate a sponsor portfolio.
            </p>
          </Panel>
        </WorkspaceBody>
      ) : (
        <>
          <MetricStrip>
            <WorkspaceMetric label="Sponsor capacity" value={`${used}/${capacity}`} detail={slotsFull ? 'Portfolio full' : `${capacity - used} slots available`} />
            <WorkspaceMetric label="Guaranteed income" value={formatMoney(annual)} detail="Annual contracted value" />
            <WorkspaceMetric label="Race installment" value={formatMoney(nextRaceInstallment)} detail="75% paid across the calendar" />
            <WorkspaceMetric label="Commercial standing" value={`${commercial.commercialReputation}/100`} detail={`${averageConfidence}/100 average confidence`} />
          </MetricStrip>
          <WorkspaceTabs
            items={SPONSORS_WORKSPACE_TABS.map((workspace) => ({
              id: workspace.id,
              label: `${workspace.label}${workspace.id === 'opportunities' ? ` (${offers.length})` : workspace.id === 'negotiations' ? ` (${activeNegotiations.length})` : workspace.id === 'objectives' ? ` (${objectiveSummary.Pending})` : ''}`,
            }))}
            active={tab}
            onChange={selectTab}
            ariaLabel="Sponsor workspaces"
          />
          <WorkspaceBody className="space-y-4">
          <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className="ui-decision-strip-pulse" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-semibold text-neutral-100">Commercial operations desk</div>
                <div className="truncate text-neutral-400">
                  {objectiveSummary.Pending > 0
                    ? `${objectiveSummary.Pending} sponsor objective${objectiveSummary.Pending === 1 ? '' : 's'} need monitoring.`
                    : !slotsFull && offers.length > 0
                      ? `${offers.length} commercial opportunit${offers.length === 1 ? 'y is' : 'ies are'} available for review.`
                      : slotsFull
                        ? 'Sponsor portfolio is full. Review current commitments before signing another deal.'
                        : 'No immediate commercial decision is required.'}
                </div>
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              {used}/{capacity} sponsor slots used
            </span>
          </div>

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
                        canManage={state.gameMode !== 'SingleSeason'}
                        canAffordBuyout={(team?.budget ?? 0) >= sponsorTerminationBuyout(sponsor) * 1_000_000}
                        onRenew={() => dispatch({ type: 'START_SPONSOR_RENEWAL', sponsorId: sponsor.id })}
                        onTerminate={() => dispatch({ type: 'TERMINATE_SPONSOR', sponsorId: sponsor.id })}
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
                Opening talks reserves no slot. Sponsors may accept, counter, reject, or withdraw as patience and the deadline run down. {slotsFull && (
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
                      disabled={slotsFull || state.gameMode === 'SingleSeason'}
                      onSign={() => dispatch({ type: 'SIGN_SPONSOR', offerId: offer.id })}
                    />
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === 'negotiations' && (
            <Panel title="Contract Negotiations" actions={<span className="text-xs text-neutral-500">Terms are exact; acceptance logic remains private</span>}>
              {negotiations.length === 0 ? (
                <p className="text-sm text-neutral-500">No sponsor talks have been opened.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {[...negotiations].reverse().map((negotiation) => (
                    <SponsorNegotiationCard
                      key={negotiation.id}
                      negotiation={negotiation}
                      disabled={state.gameMode === 'SingleSeason'}
                      onSubmit={(terms) => dispatch({ type: 'SUBMIT_SPONSOR_NEGOTIATION', negotiationId: negotiation.id, terms })}
                      onAcceptCounter={() => dispatch({ type: 'ACCEPT_SPONSOR_COUNTER', negotiationId: negotiation.id })}
                      onCancel={() => dispatch({ type: 'CANCEL_SPONSOR_NEGOTIATION', negotiationId: negotiation.id })}
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
              <p className="mb-3 text-xs text-neutral-500">
                Objective progress is reviewed after every championship round. Rewards pay immediately; missed deadlines settle once at their listed round.
              </p>
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
          </WorkspaceBody>
        </>
      )}
    </WorkspaceScreen>
  );
}

function SponsorPortfolioCard({
  sponsor,
  canManage,
  canAffordBuyout,
  onRenew,
  onTerminate,
}: {
  sponsor: Sponsor;
  canManage: boolean;
  canAffordBuyout: boolean;
  onRenew: () => void;
  onTerminate: () => void;
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
        <Row label="Relationship" value={relationshipLabel(sponsor)} valueClass={confidenceTone(sponsor.confidence)} />
        <Row label="Contract" value={`${sponsor.contractYearsRemaining} yr left`} />
        <Row label="Renewal chance" value={`${Math.round(sponsor.renewalChance * 100)}%`} />
        <Row label="Objectives" value={`${sponsor.objectives.length}`} />
      </div>
      {canManage && <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={sponsor.contractYearsRemaining > 1} onClick={onRenew} className="rounded border border-neutral-700 px-2 py-1 text-xs font-semibold text-neutral-200 enabled:hover:border-emerald-500/60 disabled:text-neutral-600">Renew</button>
        <button type="button" disabled={!canAffordBuyout} onClick={onTerminate} title={canAffordBuyout ? `Immediate buyout: $${sponsorTerminationBuyout(sponsor)}M` : `Cannot afford the $${sponsorTerminationBuyout(sponsor)}M buyout`} className="rounded border border-neutral-700 px-2 py-1 text-xs font-semibold text-red-300 enabled:hover:border-red-500/60 enabled:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-neutral-600">Buy out ${sponsorTerminationBuyout(sponsor)}M</button>
      </div>}
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
        <div className="min-h-7 text-neutral-500">
          {objective
            ? `Target: ${objective.description}${objective.reward ? ` · +$${objective.reward}M` : ''}${objective.penalty ? ` / -$${objective.penalty}M` : ''}`
            : 'No performance objective'}
        </div>
        <div className="min-h-7 text-neutral-500">{bonus ? `Bonus: ${bonus.description}` : 'No performance bonus'}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSign}
        className="mt-2 w-full rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
      >
        {disabled ? 'No free slot' : 'Open negotiations'}
      </button>
    </div>
  );
}

function SponsorNegotiationCard({ negotiation, disabled, onSubmit, onAcceptCounter, onCancel }: {
  negotiation: SponsorNegotiation;
  disabled: boolean;
  onSubmit: (terms: SponsorContractTerms) => void;
  onAcceptCounter: () => void;
  onCancel: () => void;
}) {
  const [terms, setTerms] = useState<SponsorContractTerms>(negotiation.counterTerms ?? negotiation.proposedTerms);
  const active = negotiation.status === 'Draft' || negotiation.status === 'Countered';
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div><div className="font-semibold text-neutral-100">{negotiation.sponsorName}</div><div className="text-[10px] uppercase tracking-wide text-neutral-500">{negotiation.kind} deal · deadline round {negotiation.deadlineRound}</div></div>
        <span className={active ? 'text-amber-300' : negotiation.status === 'Accepted' ? 'text-green-300' : 'text-neutral-400'}>{negotiation.status}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <label className="text-neutral-400">Annual value ($M)<input type="number" step="0.1" value={terms.annualValue} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, annualValue: Number(event.target.value) })} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100" /></label>
        <label className="text-neutral-400">Years<input type="number" min="1" max="5" value={terms.contractYears} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, contractYears: Number(event.target.value) })} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100" /></label>
        <label className="text-neutral-400">Bonus multiplier<input type="number" step="0.1" min="0.5" max="2" value={terms.bonusMultiplier} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, bonusMultiplier: Number(event.target.value) })} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100" /></label>
        <label className="text-neutral-400">Objectives<select value={terms.objectiveLevel} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, objectiveLevel: event.target.value as SponsorContractTerms['objectiveLevel'] })} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100"><option>Flexible</option><option>Standard</option><option>Stretch</option></select></label>
      </div>
      <div className="mt-2 text-xs text-neutral-500">Patience: {negotiation.patience} · Attempts: {negotiation.attempts}{negotiation.outcomeMessage ? ` · ${negotiation.outcomeMessage}` : ''}</div>
      {negotiation.counterTerms && active && <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-200">Counter: ${negotiation.counterTerms.annualValue}M · {negotiation.counterTerms.contractYears} years · {negotiation.counterTerms.bonusMultiplier}× bonuses · {negotiation.counterTerms.objectiveLevel} objectives</div>}
      {active && !disabled && <div className="mt-3 flex gap-2"><button type="button" onClick={() => onSubmit(terms)} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Submit proposal</button>{negotiation.counterTerms && <button type="button" onClick={onAcceptCounter} className="rounded border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-200">Accept counter</button>}<button type="button" onClick={onCancel} className="ml-auto text-xs text-neutral-500">End talks</button></div>}
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
            <div key={objective.id} className="border-b border-neutral-800/70 py-1.5 last:border-0">
              <div className="flex items-start justify-between gap-2 text-xs">
                <span className="text-neutral-300">{objective.description}</span>
                <ObjectiveStatus status={objective.status} />
              </div>
              <div className="mt-0.5 text-[10px] text-neutral-500">
                {objective.deadlineRound ? `Deadline: round ${objective.deadlineRound}` : objective.deadline ? `Deadline: ${objective.deadline}` : 'No deadline'}
                {objective.reward ? ` · Reward +$${objective.reward}M` : ''}
                {objective.penalty ? ` · Miss -$${objective.penalty}M and confidence` : ''}
              </div>
              {objective.progressLabel && <div className="mt-1 text-[10px] font-medium text-neutral-400">Progress: {objective.progressLabel}</div>}
              {objective.revisionNote && <div className="mt-1 text-[10px] text-amber-300">Revised: {objective.revisionNote}</div>}
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

function Row({ label, value, valueClass = 'text-neutral-400' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-neutral-300">{label}</span>
      <span className={`text-right tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
