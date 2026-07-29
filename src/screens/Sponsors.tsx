import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { formatMoney } from '../components/ui';
import {
  sponsorAnnualIncome,
  averageSponsorConfidence,
  generateSponsorOffers,
  sponsorSlotCapacity,
  sponsorTerminationBuyout,
} from '../sim/commercialEngine';
import type { Sponsor, SponsorContractTerms, SponsorNegotiation } from '../types/sponsorTypes';
import {
  OWNER_PERSONALITY_LABELS,
  OWNER_PERSONALITY_DESCRIPTIONS,
  type BoardFundingCategory,
  type BoardroomMandateLevel,
} from '../types/expectationTypes';
import { MANDATE_OPTIONS } from '../sim/boardroomEngine';
import {
  publicConfidenceLabel,
  publicExpectationLabel,
  publicMomentumLabel,
  publicReputationFor,
  publicStandingLabel,
} from '../sim/publicReputationEngine';
import { CharacterDossierButton } from '../components/characterCards/CharacterDossier';
import {
  SPONSORS_WORKSPACE_TABS,
  sponsorObjectiveSummary,
  sponsorPage,
  sponsorPageCount,
  sortSponsorNegotiations,
  sortSponsorOffers,
  type SponsorNegotiationSortKey,
  type SponsorOfferSortKey,
  type SponsorSort,
  type SponsorsWorkspaceTab,
} from './sponsorsViewModel';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import { selectedTechnicalRecord } from './technicalCommercialViewModel';

const TYPE_LABEL: Record<Sponsor['type'], string> = {
  Title: 'Title',
  Secondary: 'Secondary',
  TechnicalPartner: 'Technical Partner',
  DriverLinked: 'Driver-Linked',
  PayDriver: 'Pay Driver',
  OneRace: 'One-Race',
};

const FUNDING_OPTIONS: Array<{ id: BoardFundingCategory; label: string }> = [
  { id: 'TechnicalDevelopment', label: 'Technical development' },
  { id: 'Facilities', label: 'Facilities' },
  { id: 'StaffRecruitment', label: 'Staff recruitment' },
  { id: 'DriverContracts', label: 'Driver contracts' },
  { id: 'AcademyInvestment', label: 'Academy investment' },
  { id: 'EmergencySupport', label: 'Emergency support' },
];

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
  const tab: SponsorsWorkspaceTab = SPONSORS_WORKSPACE_TABS.some((item) => item.id === requestedTab)
    ? requestedTab as SponsorsWorkspaceTab
    : 'portfolio';
  const [sponsorListPage, setSponsorListPage] = useState(0);
  const focusedId = searchParams.get('focus');
  const [ownerReviewPage, setOwnerReviewPage] = useState(0);
  const [offerSort, setOfferSort] = useState<SponsorSort<SponsorOfferSortKey>>({ key: 'annualValue', direction: 'desc' });
  const [negotiationSort, setNegotiationSort] = useState<SponsorSort<SponsorNegotiationSortKey>>({ key: 'deadlineRound', direction: 'asc' });

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
  const publicStanding = publicReputationFor(state);
  const sponsors = commercial?.sponsors ?? [];
  const used = sponsors.length;
  const negotiations = commercial?.negotiations ?? [];
  const activeNegotiations = negotiations.filter((item) => item.status === 'Draft' || item.status === 'Countered');
  const orderedOffers = sortSponsorOffers(offers, offerSort);
  const orderedNegotiations = sortSponsorNegotiations(negotiations, negotiationSort);
  const selectedOffer = selectedTechnicalRecord(orderedOffers, focusedId);
  const selectedNegotiation = selectedTechnicalRecord(orderedNegotiations, focusedId);
  const slotsFull = used >= capacity;
  const objectiveSummary = sponsorObjectiveSummary(sponsors);
  const sponsorListPageCount = sponsorPageCount(sponsors.length);
  const safeSponsorListPage = Math.min(sponsorListPage, sponsorListPageCount - 1);
  const visibleSponsors = sponsorPage(sponsors, safeSponsorListPage);
  const selectedSponsor = sponsors.find((sponsor) => sponsor.id === focusedId) ?? sponsors[0];
  const ownerReviews = [...(state.expectationReviews ?? [])]
    .filter((review) => review.teamId === state.selectedTeamId)
    .reverse();
  const ownerReviewPageCount = Math.max(1, Math.ceil(ownerReviews.length / 4));
  const safeOwnerReviewPage = Math.min(ownerReviewPage, ownerReviewPageCount - 1);
  const visibleOwnerReviews = ownerReviews.slice(safeOwnerReviewPage * 4, safeOwnerReviewPage * 4 + 4);

  function selectTab(nextTab: SponsorsWorkspaceTab) {
    const next = new URLSearchParams(searchParams);
    if (nextTab === 'portfolio') next.delete('tab');
    else next.set('tab', nextTab);
    next.delete('focus');
    setSearchParams(next);
    if (nextTab === 'portfolio' || nextTab === 'objectives') setSponsorListPage(0);
  }

  function selectFocusedRecord(id: string, nextTab: SponsorsWorkspaceTab) {
    const next = new URLSearchParams(searchParams);
    if (nextTab === 'portfolio') next.delete('tab');
    else next.set('tab', nextTab);
    next.set('focus', id);
    setSearchParams(next);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-sponsors-screen">
      <WorkspaceHeader
        eyebrow="Commercial center"
        title="Sponsors & Commercial"
        subtitle={`${team?.name ?? 'Team'} · Partnerships, targets, bonuses, and owner pressure`}
        actions={commercial ? (
          <div className="ui-technical-header-readout">
            <span><strong>{used}/{capacity}</strong> sponsor slots</span>
            <span><strong>{formatMoney(annual)}</strong> guaranteed</span>
            <span><strong>{commercial.commercialReputation}/100</strong> reputation</span>
            <span><strong>{averageConfidence}/100</strong> confidence</span>
          </div>
        ) : undefined}
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
            <FmWorkspaceGrid columns="three" className="ui-sponsor-portfolio-grid">
              <FmPane>
                <FmPaneHeader title="Active portfolio" meta={`${used}/${capacity} slots`} />
                <FmPaneBody className="overflow-auto">
                  {sponsors.map((sponsor) => (
                    <FmListButton
                      key={sponsor.id}
                      active={selectedSponsor?.id === sponsor.id}
                      urgent={sponsor.confidence <= 40}
                      onClick={() => {
                        selectFocusedRecord(sponsor.id, tab);
                      }}
                    >
                      <span>{TYPE_LABEL[sponsor.type]}</span>
                      <strong>{sponsor.name}</strong>
                      <small>${sponsor.annualValue}M · confidence {sponsor.confidence}</small>
                    </FmListButton>
                  ))}
                  {sponsors.length === 0 && <p className="ui-technical-empty">No sponsors are currently signed.</p>}
                </FmPaneBody>
              </FmPane>
              <FmPane className="ui-sponsor-detail-pane">
                <FmPaneHeader title={selectedSponsor?.name ?? 'Sponsor profile'} meta={selectedSponsor ? TYPE_LABEL[selectedSponsor.type] : undefined} />
                <FmPaneBody className="overflow-auto">
                  {selectedSponsor && (
                    <SponsorPortfolioCard
                      sponsor={selectedSponsor}
                      canManage={state.gameMode !== 'SingleSeason'}
                      canAffordBuyout={(team?.budget ?? 0) >= sponsorTerminationBuyout(selectedSponsor) * 1_000_000}
                      onRenew={() => dispatch({ type: 'START_SPONSOR_RENEWAL', sponsorId: selectedSponsor.id })}
                      onTerminate={() => dispatch({ type: 'TERMINATE_SPONSOR', sponsorId: selectedSponsor.id })}
                      detailed
                    />
                  )}
                </FmPaneBody>
              </FmPane>
              <FmPane className="ui-sponsor-context-pane">
                <FmPaneHeader title="Commercial context" meta="Portfolio position" />
                <FmPaneBody className="overflow-auto">
                  <div className="ui-technical-dossier">
                    <section>
                      <FmKeyValue label="Guaranteed annual income" value={formatMoney(annual)} />
                      <FmKeyValue label="Available slots" value={`${Math.max(0, capacity - used)}`} />
                      <FmKeyValue label="Average confidence" value={`${averageConfidence}/100`} />
                      <FmKeyValue label="Commercial reputation" value={`${commercial.commercialReputation}/100`} />
                    </section>
                    <section>
                      <h3>Payment structure</h3>
                      <p>25% is paid up front and 75% is distributed across race installments. Objectives and bonuses settle from the existing commercial rules.</p>
                    </section>
                  </div>
                </FmPaneBody>
              </FmPane>
            </FmWorkspaceGrid>
          )}

          {tab === 'opportunities' && (
            <FmWorkspaceGrid columns="three" className="ui-sponsor-opportunity-grid">
              <FmPane>
                <FmPaneHeader
                  title="Available opportunities"
                  meta={`${orderedOffers.length} offers`}
                  actions={<button type="button" className="ui-sponsor-sort-button" onClick={() => updateOfferSort('annualValue', setOfferSort)}>Sort value {offerSort.direction === 'asc' ? '▲' : '▼'}</button>}
                />
                <FmPaneBody className="overflow-auto">
                  {orderedOffers.map((offer) => (
                    <FmListButton
                      key={offer.id}
                      active={selectedOffer?.id === offer.id}
                      onClick={() => {
                        selectFocusedRecord(offer.id, 'opportunities');
                      }}
                    >
                      <span>{TYPE_LABEL[offer.type]}</span>
                      <strong>{offer.name}</strong>
                      <small>${offer.annualValue}M · {offer.contractYearsRemaining} years · confidence {offer.confidence}</small>
                    </FmListButton>
                  ))}
                  {orderedOffers.length === 0 && <p className="ui-technical-empty">No new sponsor deals are on offer right now.</p>}
                </FmPaneBody>
              </FmPane>
              <FmPane className="ui-sponsor-detail-pane">
                <FmPaneHeader title={selectedOffer?.name ?? 'Opportunity dossier'} meta={selectedOffer ? TYPE_LABEL[selectedOffer.type] : undefined} />
                <FmPaneBody className="overflow-auto">
                  {selectedOffer && (
                    <div className="ui-technical-dossier">
                      <section>
                        <FmKeyValue label="Annual value" value={`$${selectedOffer.annualValue}M`} />
                        <FmKeyValue label="Contract term" value={`${selectedOffer.contractYearsRemaining} years`} />
                        <FmKeyValue label="Opening confidence" value={`${selectedOffer.confidence}/100`} />
                        <FmKeyValue label="Renewal outlook" value={`${Math.round(selectedOffer.renewalChance * 100)}%`} />
                      </section>
                      <section>
                        <h3>Objectives</h3>
                        {selectedOffer.objectives.map((objective) => <p key={objective.id}>{objective.description}</p>)}
                        {selectedOffer.objectives.length === 0 && <p>No performance objective.</p>}
                      </section>
                      <section>
                        <h3>Performance bonuses</h3>
                        {selectedOffer.bonusTerms.map((bonus) => <p key={bonus.id}>{bonus.description}</p>)}
                        {selectedOffer.bonusTerms.length === 0 && <p>No bonus terms.</p>}
                      </section>
                      <Button
                        variant="primary"
                        disabled={slotsFull || state.gameMode === 'SingleSeason'}
                        title={state.gameMode === 'SingleSeason' ? 'Sponsor changes are locked in Single Season.' : slotsFull ? 'The sponsor portfolio is full.' : undefined}
                        onClick={() => dispatch({ type: 'SIGN_SPONSOR', offerId: selectedOffer.id })}
                      >
                        Open negotiations
                      </Button>
                    </div>
                  )}
                </FmPaneBody>
              </FmPane>
              <FmPane className="ui-sponsor-context-pane">
                <FmPaneHeader title="Deal context" meta={`Reputation ${commercial.commercialReputation}`} />
                <FmPaneBody className="overflow-auto">
                  <div className="ui-technical-dossier">
                    <section>
                      <FmKeyValue label="Portfolio capacity" value={`${used}/${capacity}`} />
                      <FmKeyValue label="Open negotiation slots" value={slotsFull ? 'Portfolio full' : `${capacity - used} available`} />
                      <FmKeyValue label="Active talks" value={`${activeNegotiations.length}`} />
                    </section>
                    <section>
                      <h3>Recruitment rule</h3>
                      <p>Opening talks reserves no slot. The sponsor may accept, counter, reject, or withdraw as patience and the deadline run down.</p>
                    </section>
                  </div>
                </FmPaneBody>
              </FmPane>
            </FmWorkspaceGrid>
          )}

          {tab === 'negotiations' && (
            <FmWorkspaceGrid columns="three" className="ui-sponsor-negotiation-grid">
              <FmPane>
                <FmPaneHeader
                  title="Contract negotiations"
                  meta={`${activeNegotiations.length} active`}
                  actions={<button type="button" className="ui-sponsor-sort-button" onClick={() => updateNegotiationSort('deadlineRound', setNegotiationSort)}>Sort deadline {negotiationSort.direction === 'asc' ? '▲' : '▼'}</button>}
                />
                <FmPaneBody className="overflow-auto">
                  {orderedNegotiations.map((negotiation) => (
                    <FmListButton
                      key={negotiation.id}
                      active={selectedNegotiation?.id === negotiation.id}
                      urgent={negotiation.status === 'Countered' || negotiation.patience <= 25}
                      onClick={() => {
                        selectFocusedRecord(negotiation.id, 'negotiations');
                      }}
                    >
                      <span>{negotiation.status} · deadline R{negotiation.deadlineRound}</span>
                      <strong>{negotiation.sponsorName}</strong>
                      <small>Patience {negotiation.patience} · {negotiation.attempts} attempts</small>
                    </FmListButton>
                  ))}
                  {orderedNegotiations.length === 0 && <p className="ui-technical-empty">No sponsor talks have been opened.</p>}
                </FmPaneBody>
              </FmPane>
              <FmPane className="ui-sponsor-negotiation-detail">
                <FmPaneHeader title={selectedNegotiation?.sponsorName ?? 'Negotiation room'} meta={selectedNegotiation?.status} />
                <FmPaneBody className="overflow-auto">
                  {selectedNegotiation && (
                    <SponsorNegotiationEditor
                      negotiation={selectedNegotiation}
                      disabled={state.gameMode === 'SingleSeason'}
                      onSubmit={(negotiationId, terms) => dispatch({ type: 'SUBMIT_SPONSOR_NEGOTIATION', negotiationId, terms })}
                      onAcceptCounter={(negotiationId) => dispatch({ type: 'ACCEPT_SPONSOR_COUNTER', negotiationId })}
                      onCancel={(negotiationId) => dispatch({ type: 'CANCEL_SPONSOR_NEGOTIATION', negotiationId })}
                    />
                  )}
                </FmPaneBody>
              </FmPane>
              <FmPane className="ui-sponsor-context-pane">
                <FmPaneHeader title="Agent context" meta="Exact terms · private acceptance" />
                <FmPaneBody className="overflow-auto">
                  <div className="ui-technical-dossier">
                    <section>
                      <FmKeyValue label="Status" value={selectedNegotiation?.status ?? 'No talks selected'} />
                      <FmKeyValue label="Deadline" value={selectedNegotiation ? `Round ${selectedNegotiation.deadlineRound}` : '—'} />
                      <FmKeyValue label="Patience" value={selectedNegotiation ? `${selectedNegotiation.patience}` : '—'} />
                      <FmKeyValue label="Attempts" value={selectedNegotiation ? `${selectedNegotiation.attempts}` : '—'} />
                    </section>
                    <section>
                      <h3>Negotiation rule</h3>
                      <p>Terms are exact, while acceptance logic remains private. Counters, refusals, patience, attempts, and deadlines continue using the existing commercial engine.</p>
                    </section>
                  </div>
                </FmPaneBody>
              </FmPane>
            </FmWorkspaceGrid>
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

          {tab === 'public' && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Panel title="Team Identity">
                  <div className="text-lg font-bold text-neutral-100">{publicStanding.identity}</div>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Results are judged through the expectations attached to this team’s history, resources, and competitive position.
                  </p>
                </Panel>
                <Panel title="Fan Confidence">
                  <div className="text-lg font-bold text-neutral-100">{publicConfidenceLabel(publicStanding.fanConfidence)}</div>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">Support changes with results, reliability, drivers, team orders, sponsors, and public leadership.</p>
                </Panel>
                <Panel title="Public Momentum">
                  <div className="text-lg font-bold text-neutral-100">{publicMomentumLabel(publicStanding.momentum)}</div>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">Sustained momentum can help or hurt sponsor appeal, commercial standing, and owner reviews.</p>
                </Panel>
                <Panel title="Fan Expectation">
                  <div className="text-lg font-bold text-neutral-100">{publicExpectationLabel(publicStanding.fanExpectation)}</div>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">Success gradually raises the standard; rebuilding teams receive more patience than established powers.</p>
                </Panel>
              </div>

              <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
                <Panel title="Public Standing">
                  <div className="space-y-3">
                    <div className="rounded border border-neutral-800 bg-neutral-950/40 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Team</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-200">{publicStandingLabel(publicStanding.teamStanding)}</div>
                    </div>
                    <div className="rounded border border-neutral-800 bg-neutral-950/40 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Team Principal</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-200">{publicStandingLabel(publicStanding.principalStanding)}</div>
                    </div>
                    <p className="text-xs leading-5 text-neutral-500">
                      Team prestige and the principal’s personal reputation move separately. The underlying calculations remain private.
                    </p>
                  </div>
                </Panel>

                <Panel title="Recent Public Reaction">
                  {publicStanding.recentReactions.length === 0 ? (
                    <p className="text-sm text-neutral-500">The season has not yet produced a meaningful supporter reaction.</p>
                  ) : (
                    <div className="space-y-2">
                      {publicStanding.recentReactions.slice(0, 8).map((reaction) => (
                        <article key={reaction.id} className="rounded border border-neutral-800 bg-neutral-950/35 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-neutral-200">{reaction.headline}</div>
                              <div className="mt-1 text-xs leading-5 text-neutral-500">{reaction.detail}</div>
                            </div>
                            <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              reaction.sentiment === 'Positive'
                                ? 'bg-green-500/10 text-green-300'
                                : reaction.sentiment === 'Negative'
                                  ? 'bg-red-500/10 text-red-300'
                                  : 'bg-amber-500/10 text-amber-300'
                            }`}>
                              {reaction.sentiment}
                            </span>
                          </div>
                          <div className="mt-2 text-[10px] uppercase tracking-wide text-neutral-600">
                            {reaction.round > 0 ? `Round ${reaction.round}` : 'Preseason'} · {reaction.trigger.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          )}

          {tab === 'owner' && (
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-2">
              <Panel
                title="Board Mandate"
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
                {!state.boardroom?.mandate && state.currentRaceIndex === 0 && state.gameMode !== 'SingleSeason' && (
                  <div className="mt-3 grid gap-2">
                    {(Object.keys(MANDATE_OPTIONS) as BoardroomMandateLevel[]).map((mandate) => {
                      const option = MANDATE_OPTIONS[mandate];
                      return (
                        <button
                          key={mandate}
                          type="button"
                          onClick={() => dispatch({ type: 'SELECT_BOARDROOM_MANDATE', mandate })}
                          className="rounded-lg border border-neutral-700 bg-neutral-950/40 p-3 text-left hover:border-emerald-500/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-neutral-100">{mandate}</span>
                            <span className="text-xs text-emerald-300">${option.fundingMillions}M support</span>
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">{option.description}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">{option.jobRisk} job risk</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {state.boardroom?.mandate && (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                    <div className="font-semibold text-emerald-200">{state.boardroom.mandate} mandate agreed</div>
                    <div className="mt-1 text-xs text-neutral-400">
                      ${state.boardroom.mandateFundingMillions ?? 0}M support · {state.boardroom.mandateJobRisk ?? 'Standard'} job risk · {state.boardroom.autonomy} autonomy
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Funding Requests">
                {state.gameMode === 'SingleSeason' ? (
                  <p className="text-sm text-neutral-500">Funding requests are unavailable in Single Season. Formal performance reviews remain active.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">Requests are judged against owner personality, confidence, recent requests, and team circumstances. Repeated requests can reduce patience.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {FUNDING_OPTIONS.map((option) => (
                        (() => {
                          const alreadyRequested = (state.boardroom?.fundingRequests ?? []).some((request) =>
                            request.category === option.id && request.requestedRound === state.currentRaceIndex);
                          const activeRequest = (state.boardroom?.fundingRequests ?? []).some((request) =>
                            request.category === option.id && ['Approved', 'Conditional'].includes(request.status));
                          const disabled = state.seasonComplete || alreadyRequested || activeRequest;
                          return (
                        <Button
                          key={option.id}
                          variant="ghost"
                          disabled={disabled}
                          title={alreadyRequested ? 'Already requested this round' : activeRequest ? 'An active funding decision already exists' : undefined}
                          onClick={() => dispatch({ type: 'REQUEST_BOARD_FUNDING', category: option.id })}
                        >
                          Request {option.label}
                        </Button>
                          );
                        })()
                      ))}
                    </div>
                    {(state.boardroom?.fundingRequests ?? []).slice().reverse().slice(0, 4).map((request) => (
                      <div key={request.id} className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-2 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-neutral-200">{FUNDING_OPTIONS.find((item) => item.id === request.category)?.label}</span>
                          <span className={request.status === 'Approved' || request.status === 'Fulfilled' ? 'text-green-300' : request.status === 'Denied' || request.status === 'Breached' ? 'text-red-300' : 'text-amber-300'}>{request.status}</span>
                        </div>
                        <div className="mt-1 text-neutral-400">{request.response}</div>
                        <div className="mt-1 text-neutral-500">${request.approvedMillions}M of ${request.requestedMillions}M released{request.deadlineRound ? ` · deadline round ${request.deadlineRound}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              </div>

              {state.boardroom?.ultimatum && (
                <Panel title="Owner Ultimatum">
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {state.boardroom.ultimatum.requirement} Deadline: round {state.boardroom.ultimatum.deadlineRound}.
                  </div>
                </Panel>
              )}

              <Panel title="Formal Owner Reviews">
                {(state.boardroom?.reviews ?? []).length === 0 && ownerReviews.length === 0 ? (
                  <p className="text-sm text-neutral-500">The early-season, midseason, and postseason reviews have not occurred yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(state.boardroom?.reviews ?? []).slice().reverse().map((review) => (
                      <div key={review.id} className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-neutral-100">{review.stage.replace('Season', '-season')} review · Round {review.round}</div>
                          <span className={review.verdict === 'Impressed' ? 'text-green-300' : review.verdict === 'Satisfied' ? 'text-sky-300' : 'text-red-300'}>{review.verdict}</span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-400">{review.summary}</div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {review.assessments.map((item) => (
                            <div key={item.area} className="rounded border border-neutral-800 p-2 text-xs">
                              <div className="flex justify-between gap-2"><span className="font-semibold text-neutral-300">{item.area}</span><span className={item.assessment === 'Strong' ? 'text-green-300' : item.assessment === 'Concern' ? 'text-red-300' : 'text-amber-300'}>{item.assessment}</span></div>
                              <div className="mt-1 text-neutral-500">{item.summary}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {ownerReviews.length > 0 && (
                      <>
                        <div className="border-t border-neutral-800 pt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Completed season history</div>
                        {visibleOwnerReviews.map((review) => (
                          <div key={`${review.teamId}-${review.seasonYear}`} className="grid grid-cols-[3rem_minmax(0,1fr)_2rem] gap-2 rounded-lg border border-neutral-800 bg-neutral-950/30 p-2 text-sm">
                            <span className="text-neutral-500">{review.seasonYear}</span>
                            <span className={review.primaryObjectiveMet ? 'text-green-300' : 'text-red-300'}>{review.summary}</span>
                            <span className="text-right tabular-nums text-neutral-400">{review.patienceDelta >= 0 ? '+' : ''}{review.patienceDelta}</span>
                          </div>
                        ))}
                        <CompactPagination page={safeOwnerReviewPage} pageCount={ownerReviewPageCount} total={ownerReviews.length} noun="reviews" onPageChange={setOwnerReviewPage} />
                      </>
                    )}
                  </div>
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
  detailed = false,
}: {
  sponsor: Sponsor;
  canManage: boolean;
  canAffordBuyout: boolean;
  onRenew: () => void;
  onTerminate: () => void;
  detailed?: boolean;
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
      {detailed && sponsor.objectives.length > 0 && (
        <div className="mt-4 rounded border border-neutral-800 bg-neutral-950/40 p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-neutral-500">Objectives</div>
          <div className="space-y-1.5">
            {sponsor.objectives.map((objective) => (
              <div key={objective.id} className="text-xs text-neutral-300">
                <span>{objective.description}</span>
                <span className="ml-2 text-[10px] text-neutral-500">{objective.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {canManage && <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={sponsor.contractYearsRemaining > 1} onClick={onRenew} className="rounded border border-neutral-700 px-2 py-1 text-xs font-semibold text-neutral-200 enabled:hover:border-emerald-500/60 disabled:text-neutral-600">Renew</button>
        <button type="button" disabled={!canAffordBuyout} onClick={onTerminate} title={canAffordBuyout ? `Immediate buyout: $${sponsorTerminationBuyout(sponsor)}M` : `Cannot afford the $${sponsorTerminationBuyout(sponsor)}M buyout`} className="rounded border border-neutral-700 px-2 py-1 text-xs font-semibold text-red-300 enabled:hover:border-red-500/60 enabled:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-neutral-600">Buy out ${sponsorTerminationBuyout(sponsor)}M</button>
      </div>}
    </div>
  );
}

function SponsorNegotiationEditor({
  negotiation,
  disabled,
  onSubmit,
  onAcceptCounter,
  onCancel,
}: {
  negotiation: SponsorNegotiation;
  disabled: boolean;
  onSubmit: (negotiationId: string, terms: SponsorContractTerms) => void;
  onAcceptCounter: (negotiationId: string) => void;
  onCancel: (negotiationId: string) => void;
}) {
  const [terms, setTerms] = useState<SponsorContractTerms>(negotiation.counterTerms ?? negotiation.proposedTerms);
  const active = negotiation.status === 'Draft' || negotiation.status === 'Countered';
  return (
    <div className="ui-sponsor-negotiation-editor">
      <div className="ui-sponsor-negotiation-fields">
        <label>Annual value<input type="number" step="0.1" value={terms.annualValue} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, annualValue: Number(event.target.value) })} /></label>
        <label>Contract years<input type="number" min="1" max="5" value={terms.contractYears} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, contractYears: Number(event.target.value) })} /></label>
        <label>Bonus multiplier<select value={terms.bonusMultiplier} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, bonusMultiplier: Number(event.target.value) })}><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        <label>Objective level<select value={terms.objectiveLevel} disabled={!active || disabled} onChange={(event) => setTerms({ ...terms, objectiveLevel: event.target.value as SponsorContractTerms['objectiveLevel'] })}><option>Flexible</option><option>Standard</option><option>Stretch</option></select></label>
      </div>
      {negotiation.counterTerms && (
        <div className="ui-sponsor-counter">
          Counter: ${negotiation.counterTerms.annualValue}M · {negotiation.counterTerms.contractYears} years · {negotiation.counterTerms.objectiveLevel} objectives
        </div>
      )}
      <p className="ui-technical-muted">{negotiation.outcomeMessage ?? 'Player proposal pending.'}</p>
      <div className="ui-sponsor-negotiation-actions">
        <Button variant="primary" disabled={!active || disabled} onClick={() => onSubmit(negotiation.id, terms)}>Submit terms</Button>
        {negotiation.counterTerms && <Button variant="secondary" disabled={!active || disabled} onClick={() => onAcceptCounter(negotiation.id)}>Accept counter</Button>}
        <Button variant="ghost" disabled={!active || disabled} onClick={() => onCancel(negotiation.id)}>End talks</Button>
      </div>
    </div>
  );
}

function updateOfferSort(
  key: SponsorOfferSortKey,
  setSort: React.Dispatch<React.SetStateAction<SponsorSort<SponsorOfferSortKey>>>,
) {
  setSort((current) => current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: key === 'name' || key === 'type' ? 'asc' : 'desc' });
}

function updateNegotiationSort(
  key: SponsorNegotiationSortKey,
  setSort: React.Dispatch<React.SetStateAction<SponsorSort<SponsorNegotiationSortKey>>>,
) {
  setSort((current) => current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: key === 'sponsorName' || key === 'status' ? 'asc' : 'desc' });
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
