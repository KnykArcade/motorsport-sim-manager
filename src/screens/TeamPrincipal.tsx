import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RENEW_THRESHOLD, SACK_THRESHOLD } from '../sim/principalEngine';
import { ratingColor } from '../components/ui';
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
  principalCareerTimeline,
  principalCommitmentRows,
  principalJobOfferPage,
  principalRelationshipRows,
  principalTabFromQuery,
  selectedPrincipalJobOffer,
  type PrincipalCommandTab,
} from './teamPrincipalViewModel';
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

export function TeamPrincipal() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PrincipalCommandTab>(() => principalTabFromQuery(searchParams.get('tab')));
  const [offerPage, setOfferPage] = useState(0);
  const [selectedOfferId, setSelectedOfferId] = useState<string>();
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
  const selectedOffer = selectedPrincipalJobOffer(visibleOffers, selectedOfferId);
  const relationships = principalRelationshipRows(state);
  const commitments = principalCommitmentRows(state);
  const careerTimeline = principalCareerTimeline(state);
  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const createdPrincipal = state.teamPrincipal;

  return (
    <WorkspaceScreen className="ui-team-people-screen">
      <WorkspaceHeader
        eyebrow="People center"
        title="Team Principal"
        subtitle={`${principal.name} · ${currentTeam?.name ?? 'Between teams'} · Reputation, leadership identity, and career standing`}
        actions={<CharacterDossierButton state={state} subject={{ type: 'playerPrincipal' }}>Character Card</CharacterDossierButton>}
      />
      <div className="ui-principal-profile-strip">
        <div className="ui-principal-monogram">{principal.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</div>
        <div className="ui-principal-profile-name">
          <span>Team Principal</span>
          <strong>{principal.name}</strong>
          <small>{currentTeam?.name ?? 'Between teams'} · {principal.contractYearsRemaining} year contract</small>
        </div>
        <div className="ui-principal-profile-stat"><span>Reputation</span><strong>{principal.reputation}</strong></div>
        <div className="ui-principal-profile-stat"><span>Job security</span><strong className={securityTone(principal.jobSecurity)}>{principal.jobSecurity}</strong></div>
        <div className="ui-principal-profile-stat"><span>Career market</span><strong>{offers.length}</strong></div>
      </div>
      <WorkspaceTabs
        items={PRINCIPAL_COMMAND_TABS.map((item) => ({ id: item.id, label: `${item.label}${item.id === 'career' && offers.length ? ` (${offers.length})` : ''}` }))}
        active={activeTab}
        onChange={setActiveTab}
        ariaLabel="Team Principal command center sections"
      />
      <WorkspaceBody className="space-y-3">
      <p className="text-[11px] text-neutral-500">{PRINCIPAL_COMMAND_TABS.find((item) => item.id === activeTab)?.description}</p>

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
            {createdPrincipal && (
              <div className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-400">
                <div className="grid gap-2 sm:grid-cols-2">
                  <FmKeyValue label="Background" value={humanize(createdPrincipal.background)} />
                  <FmKeyValue label="Management style" value={humanize(createdPrincipal.managementStyle)} />
                  <FmKeyValue label="Primary strength" value={humanize(createdPrincipal.primaryStrength)} />
                  <FmKeyValue label="Race philosophy" value={humanize(createdPrincipal.raceStrategyPhilosophy)} />
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Board Targets">
            <FmKeyValue label="Primary objective" value={expectation?.primaryObjective ?? 'No current owner target'} />
            <FmKeyValue label="Constructor minimum" value={expectation?.minimumConstructorPosition ? `P${expectation.minimumConstructorPosition}` : 'Not specified'} />
            <FmKeyValue label="Target points" value={expectation?.targetPoints ?? 'Not specified'} />
            <FmKeyValue label="Required wins" value={expectation?.requiredWins ?? 'Not specified'} />
            <FmKeyValue label="Board autonomy" value={state.boardroom?.autonomy ?? 'Standard'} />
          </Panel>
        </div>
      )}

      {activeTab === 'relationships' && (
        <FmWorkspaceGrid columns="two">
          <FmPane>
            <FmPaneHeader title="Driver Relationships" meta={`${relationships.length} active drivers`} />
            <FmPaneBody className="overflow-auto">
              {relationships.map((relationship) => (
                <FmListButton
                  key={relationship.driverId}
                  urgent={relationship.trust < 35 || relationship.frustration >= 80}
                  onClick={() => navigate(`/relationships?driver=${encodeURIComponent(relationship.driverId)}`)}
                >
                  <span className="ui-news-list-source">Trust {Math.round(relationship.trust)}% · Frustration {Math.round(relationship.frustration)}%</span>
                  <strong>{relationship.driverName}</strong>
                  <span>Morale {Math.round(relationship.morale)}% · Confidence {Math.round(relationship.confidence)}%</span>
                  <small>{relationship.activePromises} active promise{relationship.activePromises === 1 ? '' : 's'} · Open relationship file →</small>
                </FmListButton>
              ))}
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Leadership Commitments" meta={`${commitments.length} active`} />
            <FmPaneBody className="overflow-auto">
              {commitments.map((commitment) => (
                <article key={commitment.id} className="border-b border-neutral-800 p-3 text-xs">
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-neutral-500">
                    <span>{commitment.scope}</span>
                    <span>Due {commitment.due}</span>
                  </div>
                  <strong className="mt-1 block text-neutral-100">{commitment.title}</strong>
                  <p className="mt-1 text-neutral-400">{commitment.detail}</p>
                  <small className="mt-2 block text-amber-300">{commitment.status}</small>
                </article>
              ))}
              {commitments.length === 0 && <div className="ui-inbox-empty">No active driver, department, or public commitment.</div>}
            </FmPaneBody>
            <div className="border-t border-neutral-800 p-2">
              <Button variant="secondary" onClick={() => navigate('/relationships')}>Open Relationship Center</Button>
            </div>
          </FmPane>
        </FmWorkspaceGrid>
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
                <Tag>Cohesion: {culture.cohesion >= 70 ? 'United' : culture.cohesion >= 45 ? 'Mixed' : 'Fragmented'}</Tag>
                <Tag>Stability: {culture.stability >= 70 ? 'Settled' : culture.stability >= 45 ? 'Watchful' : 'Volatile'}</Tag>
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {TEAM_CULTURE_AXES.map((axis) => (
                <RatingBar key={axis} label={splitLabel(axis)} value={culture.axes[axis]} max={100} />
              ))}
            </div>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
              <ModifierCard label="Development outcomes" value={modifierOutlook(leadershipModifiers.developmentSuccessBonus)} />
              <ModifierCard label="Morale influence" value={modifierOutlook(leadershipModifiers.moraleEffectMultiplier - 1)} />
              <ModifierCard label="Race preparation" value={modifierOutlook(leadershipModifiers.preparationEffectMultiplier - 1)} />
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
        <div className="ui-principal-career-layout">
          <Panel title="Career Record">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label="Race Wins" value={String(principal.careerStats.raceWins)} />
              <Metric label="Podiums" value={String(principal.careerStats.podiums)} />
              <Metric label="Drivers' Titles" value={String(principal.careerStats.driverTitles)} />
              <Metric label="Constructors' Titles" value={String(principal.careerStats.constructorTitles)} />
              <Metric label="Teams Managed" value={String(principal.careerStats.teamsManaged.length)} />
            </div>
            <div className="mt-4 border-t border-neutral-800 pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Career timeline</div>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                {careerTimeline.map((entry) => (
                  <article key={entry.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="block text-neutral-100">{entry.teamName}</strong>
                        <span className="text-neutral-500">{entry.role}</span>
                      </div>
                      <Tag>{entry.seasons}</Tag>
                    </div>
                    <p className="mt-2 text-neutral-400">{entry.joinedReason}</p>
                    {entry.leftReason && <p className="mt-1 text-neutral-500">Departure: {entry.leftReason}</p>}
                  </article>
                ))}
              </div>
            </div>
          </Panel>

          <div className="ui-principal-market">
            <FmWorkspaceGrid columns="two">
              <FmPane>
                <FmPaneHeader title="Job Market" meta={`${offers.length} approaches`} />
                <FmPaneBody className="overflow-auto">
                  {visibleOffers.map((offer) => (
                    <FmListButton key={offer.id} active={selectedOffer?.id === offer.id} urgent={offer.kind === 'Offer'} onClick={() => setSelectedOfferId(offer.id)}>
                      <span className="ui-news-list-source">{offer.kind === 'Offer' ? 'Firm offer' : 'Rumor'} · {offer.contractYears} years</span>
                      <strong>{teamById(state, offer.teamId)?.name ?? offer.teamId}</strong>
                      <span>{offer.objective}</span>
                      <small>Prestige {offer.prestige} · {offer.budgetTier}</small>
                    </FmListButton>
                  ))}
                  {offers.length === 0 && <div className="ui-inbox-empty">No rival team is approaching you right now.</div>}
                </FmPaneBody>
                {offerPageCount > 1 && (
                  <div className="ui-team-list-pagination">
                    <button type="button" onClick={() => { setOfferPage(Math.max(0, safeOfferPage - 1)); setSelectedOfferId(undefined); }} disabled={safeOfferPage === 0}>Previous</button>
                    <span>{safeOfferPage + 1} / {offerPageCount}</span>
                    <button type="button" onClick={() => { setOfferPage(Math.min(offerPageCount - 1, safeOfferPage + 1)); setSelectedOfferId(undefined); }} disabled={safeOfferPage >= offerPageCount - 1}>Next</button>
                  </div>
                )}
              </FmPane>
              <FmPane>
                <FmPaneHeader title={selectedOffer ? teamById(state, selectedOffer.teamId)?.name ?? selectedOffer.teamId : 'Offer Detail'} meta={selectedOffer?.kind ?? 'Career market'} />
                <FmPaneBody className="ui-principal-offer-detail overflow-auto">
                  {selectedOffer ? (
                    <>
                      <section>
                        <h3>{selectedOffer.kind === 'Offer' ? 'Formal approach' : 'Informal interest'}</h3>
                        <p>{selectedOffer.objective}</p>
                        <FmKeyValue label="Prestige" value={selectedOffer.prestige} />
                        <FmKeyValue label="Budget tier" value={selectedOffer.budgetTier} />
                        <FmKeyValue label="Contract" value={`${selectedOffer.contractYears} years`} />
                        <FmKeyValue label="Expires" value={selectedOffer.expiresSeasonYear} />
                      </section>
                      <section className="ui-principal-offer-actions">
                        {selectedOffer.kind !== 'Offer' ? (
                          <p>Informal interest only. No action is currently available.</p>
                        ) : accepted === selectedOffer.id ? (
                          <Button variant="secondary" onClick={() => dispatch({ type: 'ACCEPT_JOB_OFFER', offerId: selectedOffer.id })}>Accepted — click to cancel</Button>
                        ) : (
                          <>
                            <Button variant="primary" onClick={() => dispatch({ type: 'ACCEPT_JOB_OFFER', offerId: selectedOffer.id })}>Accept for next season</Button>
                            <Button variant="secondary" onClick={() => dispatch({ type: 'DECLINE_JOB_OFFER', offerId: selectedOffer.id })}>Decline</Button>
                          </>
                        )}
                      </section>
                    </>
                  ) : <div className="ui-inbox-empty">Select an approach to review it.</div>}
                </FmPaneBody>
              </FmPane>
            </FmWorkspaceGrid>
          </div>
        </div>
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
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

function ModifierCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40 p-2 text-neutral-400">
      <div>{label}</div>
      <div className="font-semibold text-neutral-200">{value}</div>
    </div>
  );
}

function modifierOutlook(value: number): string {
  if (value >= 0.05) return 'Strong positive';
  if (value > 0.005) return 'Slight positive';
  if (value <= -0.05) return 'Clear concern';
  if (value < -0.005) return 'Slight concern';
  return 'Neutral';
}

function splitLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
