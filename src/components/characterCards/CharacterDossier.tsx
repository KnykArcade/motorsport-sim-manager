import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameState } from '../../game/careerState';
import type { StaffMember } from '../../types/staffTypes';
import { Button } from '../Button';
import { formatMoney, ratingColor } from '../ui';
import {
  OWNER_PERSONALITY_DESCRIPTIONS,
  OWNER_PERSONALITY_LABELS,
} from '../../types/expectationTypes';
import {
  PRINCIPAL_IDENTITY_DESCRIPTIONS,
  PRINCIPAL_IDENTITY_LABELS,
} from '../../sim/phase18IdentityCultureEngine';
import { contractClauseLabel } from '../../sim/phase18ContractClauseEngine';
import { staffRatingOutOfTen } from '../../sim/staffEngine';
import type { CharacterInteractionTarget } from '../../types/characterInteractionTypes';
import { interactionHistoryForTarget } from '../../sim/characterInteractionEngine';
import { CharacterActionPanel } from './CharacterActionPanel';

export type CharacterDossierSubject =
  | { type: 'playerPrincipal' }
  | { type: 'aiPrincipal'; teamId: string }
  | { type: 'owner'; teamId: string }
  | { type: 'staff'; staff: StaffMember };

type DossierTab = 'profile' | 'standing' | 'actions' | 'history';

type DossierMetric = {
  label: string;
  value: string | number;
  score?: number;
};

type DossierHistoryEntry = {
  key: string;
  title: string;
  detail: string;
  meta?: string;
};

export type CharacterDossierModel = {
  id: string;
  name: string;
  role: string;
  organization: string;
  accent: string;
  context: string;
  summary: string;
  identityLabel: string;
  identityDescription: string;
  facts: Array<{ label: string; value: string }>;
  traits: string[];
  metrics: DossierMetric[];
  commitments: string[];
  history: DossierHistoryEntry[];
  playerRead: string;
  route: string;
};

function splitLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

function statusLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Stable';
  if (score >= 35) return 'Under pressure';
  return 'Critical';
}

function teamPosition(state: GameState, teamId: string): string {
  const ranked = [...state.constructorStandings].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums,
  );
  const position = ranked.findIndex((standing) => standing.entityId === teamId);
  return position >= 0 ? `P${position + 1}` : 'Not classified';
}

// Kept beside the modal so the subject-to-view-model contract cannot drift from
// the dossier UI; exported for deterministic coverage without rendering a DOM.
// eslint-disable-next-line react-refresh/only-export-components
export function buildCharacterDossier(
  state: GameState,
  subject: CharacterDossierSubject,
): CharacterDossierModel {
  if (subject.type === 'playerPrincipal') {
    const profile = state.principal;
    const created = state.teamPrincipal;
    const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
    const identity = state.phase18?.principalIdentity;
    const clauses = (state.phase18?.contractClauses ?? []).filter(
      (clause) => clause.partyType === 'TeamPrincipal' && clause.partyId === profile?.id,
    );
    const identityLabel = identity
      ? PRINCIPAL_IDENTITY_LABELS[identity.dominantIdentity]
      : 'Developing Leader';
    return {
      id: profile?.id ?? created?.id ?? 'player-principal',
      name: profile?.name ?? created?.name ?? 'Team Principal',
      role: 'Team Principal / Crew Chief',
      organization: team?.name ?? 'Between teams',
      accent: team?.color ?? '#f59e0b',
      context: 'Your management dossier',
      summary: 'You control the sporting, personnel, technical, and race-weekend direction of the team.',
      identityLabel,
      identityDescription: identity
        ? PRINCIPAL_IDENTITY_DESCRIPTIONS[identity.dominantIdentity]
        : 'Your leadership identity develops from the decisions you make during the career.',
      facts: [
        { label: 'Nationality', value: created?.nationality ?? 'Not specified' },
        { label: 'Age', value: created?.age ? String(created.age) : 'Not specified' },
        { label: 'Contract', value: profile ? `${profile.contractYearsRemaining} year${profile.contractYearsRemaining === 1 ? '' : 's'}` : 'Not recorded' },
        { label: 'Championship', value: teamPosition(state, state.selectedTeamId) },
      ],
      traits: [
        created?.managementStyle,
        created?.background,
        identity?.secondaryIdentity ? PRINCIPAL_IDENTITY_LABELS[identity.secondaryIdentity] : undefined,
      ].filter((value): value is string => !!value),
      metrics: profile ? [
        { label: 'Reputation', value: profile.reputation, score: profile.reputation },
        { label: 'Job Security', value: profile.jobSecurity, score: profile.jobSecurity },
        { label: 'Driver Management', value: profile.attributes.driverManagement, score: profile.attributes.driverManagement },
        { label: 'Development', value: profile.attributes.development, score: profile.attributes.development },
        { label: 'Strategy', value: profile.attributes.strategy, score: profile.attributes.strategy },
        { label: 'Board Confidence', value: profile.attributes.boardConfidence, score: profile.attributes.boardConfidence },
      ] : [],
      commitments: clauses.map((clause) => `${contractClauseLabel(clause.clauseType)} — ${clause.status}`),
      history: [
        ...(identity?.history.slice(-8).reverse().map((entry) => ({
          key: entry.id,
          title: `+${entry.amount} ${PRINCIPAL_IDENTITY_LABELS[entry.identity]}`,
          detail: entry.reason,
          meta: `${entry.seasonYear}${entry.round ? ` · Round ${entry.round}` : ''}`,
        })) ?? []),
        ...(profile ? [{
          key: 'career-record',
          title: `${profile.careerStats.raceWins} wins · ${profile.careerStats.podiums} podiums`,
          detail: `${profile.careerStats.driverTitles} drivers' titles and ${profile.careerStats.constructorTitles} constructors' titles`,
          meta: `${profile.careerStats.seasonsCompleted} completed seasons`,
        }] : []),
      ],
      playerRead: profile
        ? `${statusLabel(profile.jobSecurity)} board standing. Your decisions are shaping a ${identityLabel.toLowerCase()} reputation.`
        : 'Career-mode standing will appear once your principal profile is created.',
      route: '/principal',
    };
  }

  if (subject.type === 'aiPrincipal') {
    const team = state.teams.find((candidate) => candidate.id === subject.teamId);
    const principal = state.aiPrincipals?.[subject.teamId];
    const identity = state.phase18?.aiPrincipalIdentities[subject.teamId];
    const memory = state.aiTeamMemory?.[subject.teamId];
    const identityLabel = identity
      ? PRINCIPAL_IDENTITY_LABELS[identity.dominantIdentity]
      : 'Unknown Operator';
    const pressureStanding = principal ? Math.max(0, 100 - principal.pressure) : 50;
    return {
      id: principal?.principalId ?? `principal-${subject.teamId}`,
      name: principal?.name ?? `${team?.shortName ?? 'Rival'} Team Principal`,
      role: 'Rival Team Principal',
      organization: team?.name ?? subject.teamId,
      accent: team?.color ?? '#38bdf8',
      context: 'Paddock leadership file',
      summary: `${principal?.name ?? 'This principal'} controls the sporting and organizational direction of ${team?.name ?? 'their team'}.`,
      identityLabel,
      identityDescription: identity
        ? PRINCIPAL_IDENTITY_DESCRIPTIONS[identity.dominantIdentity]
        : 'Leadership tendencies have not yet been fully observed.',
      facts: [
        { label: 'Contract', value: principal ? `${principal.contractYearsRemaining} year${principal.contractYearsRemaining === 1 ? '' : 's'}` : 'Unknown' },
        { label: 'Tenure', value: principal ? `${principal.seasonsAtTeam} season${principal.seasonsAtTeam === 1 ? '' : 's'}` : 'Unknown' },
        { label: 'Team position', value: teamPosition(state, subject.teamId) },
        { label: 'Status', value: principal?.fired ? 'Departing' : statusLabel(pressureStanding) },
      ],
      traits: [
        identityLabel,
        identity?.secondaryIdentity ? PRINCIPAL_IDENTITY_LABELS[identity.secondaryIdentity] : undefined,
        state.aiTeamStates?.[subject.teamId]?.archetype ? splitLabel(state.aiTeamStates[subject.teamId].archetype) : undefined,
      ].filter((value): value is string => !!value),
      metrics: principal?.attributes ? [
        { label: 'Pressure Control', value: pressureStanding, score: pressureStanding },
        { label: 'Media Image', value: principal.attributes.mediaImage, score: principal.attributes.mediaImage },
        { label: 'Financial Discipline', value: principal.attributes.financialDiscipline, score: principal.attributes.financialDiscipline },
        { label: 'Driver Management', value: principal.attributes.driverManagement, score: principal.attributes.driverManagement },
        { label: 'Development', value: principal.attributes.development, score: principal.attributes.development },
        { label: 'Strategy', value: principal.attributes.strategy, score: principal.attributes.strategy },
      ] : [{ label: 'Pressure Control', value: pressureStanding, score: pressureStanding }],
      commitments: [],
      history: [
        ...(identity?.history.slice(-8).reverse().map((entry) => ({
          key: entry.id,
          title: `+${entry.amount} ${PRINCIPAL_IDENTITY_LABELS[entry.identity]}`,
          detail: entry.reason,
          meta: `${entry.seasonYear}${entry.round ? ` · Round ${entry.round}` : ''}`,
        })) ?? []),
        ...(memory ? [{
          key: `team-memory-${subject.teamId}`,
          title: `${memory.totalWins} wins · ${memory.totalPodiums} podiums`,
          detail: `Best constructors' finish: ${memory.bestConstructorPosition ? `P${memory.bestConstructorPosition}` : 'none recorded'}`,
          meta: `${memory.seasonsTracked} tracked seasons · ${memory.trendDirection}`,
        }] : []),
      ],
      playerRead: principal
        ? `${principal.name} is under ${principal.pressure}/100 pressure and projects as a ${identityLabel.toLowerCase()}.`
        : 'Leadership information is limited for this team.',
      route: '/teams',
    };
  }

  if (subject.type === 'owner') {
    const team = state.teams.find((candidate) => candidate.id === subject.teamId);
    const reputation = state.teamReputations?.[subject.teamId];
    const expectation = state.teamExpectations?.[subject.teamId];
    const personality = reputation?.ownerPersonality;
    const reviews = (state.expectationReviews ?? [])
      .filter((review) => review.teamId === subject.teamId)
      .slice(-10)
      .reverse();
    const patience = reputation?.ownerPatience ?? expectation?.ownerPatience ?? 50;
    return {
      id: `owner-${subject.teamId}`,
      name: `${team?.name ?? 'Team'} Ownership`,
      role: 'Owner / Board Representative',
      organization: team?.name ?? subject.teamId,
      accent: team?.color ?? '#a78bfa',
      context: 'Board and ownership file',
      summary: personality
        ? OWNER_PERSONALITY_DESCRIPTIONS[personality]
        : 'The ownership group sets the budget, objectives, and limits of the team principal’s authority.',
      identityLabel: personality ? OWNER_PERSONALITY_LABELS[personality] : 'Private Ownership',
      identityDescription: personality
        ? OWNER_PERSONALITY_DESCRIPTIONS[personality]
        : 'Ownership priorities have not yet been fully established.',
      facts: [
        { label: 'Primary objective', value: expectation?.primaryObjective ?? 'No objective recorded' },
        { label: 'Team position', value: teamPosition(state, subject.teamId) },
        { label: 'Budget', value: team ? formatMoney(team.budget) : 'Unknown' },
        { label: 'Review history', value: `${reviews.length} recorded review${reviews.length === 1 ? '' : 's'}` },
      ],
      traits: [
        personality ? OWNER_PERSONALITY_LABELS[personality] : 'Private ownership',
        expectation?.budgetDisciplineTarget ? 'Budget discipline' : undefined,
        expectation?.requiredWins ? 'Win demand' : undefined,
      ].filter((value): value is string => !!value),
      metrics: [
        { label: 'Owner Patience', value: patience, score: patience },
        { label: 'Team Reputation', value: reputation?.reputation ?? team?.reputation ?? 50, score: reputation?.reputation ?? team?.reputation ?? 50 },
        { label: 'Financial Stability', value: reputation?.financialStability ?? 50, score: reputation?.financialStability ?? 50 },
        { label: 'Sponsor Confidence', value: reputation?.sponsorConfidence ?? 50, score: reputation?.sponsorConfidence ?? 50 },
        { label: 'Fan Expectation', value: reputation?.fanExpectation ?? 50, score: reputation?.fanExpectation ?? 50 },
        { label: 'Competitiveness', value: reputation?.currentCompetitiveness ?? 50, score: reputation?.currentCompetitiveness ?? 50 },
      ],
      commitments: [
        ...(expectation?.secondaryObjectives ?? []),
        ...(expectation?.minimumConstructorPosition ? [`Minimum constructors' position: P${expectation.minimumConstructorPosition}`] : []),
        ...(expectation?.targetPoints ? [`Target points: ${expectation.targetPoints}`] : []),
        ...(expectation?.requiredWins ? [`Required wins: ${expectation.requiredWins}`] : []),
      ],
      history: reviews.map((review) => ({
        key: `owner-review-${review.teamId}-${review.seasonYear}`,
        title: review.primaryObjectiveMet ? 'Objective met' : 'Objective missed',
        detail: review.summary,
        meta: `${review.seasonYear} · Patience ${review.patienceDelta >= 0 ? '+' : ''}${review.patienceDelta}`,
      })),
      playerRead: `${statusLabel(patience)} ownership patience. ${expectation?.primaryObjective ?? 'The board has not issued a formal objective.'}`,
      route: subject.teamId === state.selectedTeamId ? '/sponsors' : '/teams',
    };
  }

  const staff = subject.staff;
  const active = (state.staff ?? []).some((member) => member.id === staff.id);
  const employerTeamId = Object.entries(state.aiStaff ?? {}).find(([, roster]) => roster.some((member) => member.id === staff.id))?.[0];
  const employer = state.teams.find((team) => team.id === employerTeamId);
  const clauses = (state.phase18?.contractClauses ?? []).filter(
    (clause) => clause.partyType === 'Staff' && clause.partyId === staff.id,
  );
  const recommendations = (state.phase18?.advisorRecommendations ?? []).filter(
    (recommendation) => recommendation.advisorId === staff.id || recommendation.advisorName === staff.name,
  );
  const roleRating = staffRatingOutOfTen(staff.rating);
  return {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    organization: active
      ? state.teams.find((team) => team.id === state.selectedTeamId)?.name ?? 'Your Team'
      : employer?.name ?? 'Available Personnel',
    accent: active
      ? state.teams.find((team) => team.id === state.selectedTeamId)?.color ?? '#f59e0b'
      : employer?.color ?? '#64748b',
    context: active ? 'Team personnel file' : employer ? 'Rival personnel file' : 'Recruitment dossier',
    summary: staff.bio,
    identityLabel: active ? 'Current Staff Member' : employer ? 'Rival Staff Member' : 'Recruitment Candidate',
    identityDescription: `${staff.role}: ${staff.bio}`,
    facts: [
      { label: 'Nationality', value: staff.nationality },
      { label: 'Salary', value: formatMoney(staff.salary * 1_000_000) },
      { label: 'Signing fee', value: formatMoney(staff.signingFee * 1_000_000) },
      { label: 'Status', value: active ? 'Under contract with your team' : employer ? `Under contract with ${employer.name}` : 'Available' },
      ...(active || employer ? [{ label: 'Contract', value: `${staff.contractYearsRemaining ?? 2} year${(staff.contractYearsRemaining ?? 2) === 1 ? '' : 's'} remaining` }] : []),
    ],
    traits: [staff.role, active ? 'Integrated with team' : employer ? 'Employed by rival' : 'Available to hire'],
    metrics: [{ label: 'Role Rating', value: `${roleRating.toFixed(1)}/10`, score: roleRating * 10 }],
    commitments: clauses.map((clause) => `${contractClauseLabel(clause.clauseType)} — ${clause.status}`),
    history: recommendations.slice(-10).reverse().map((recommendation) => ({
      key: recommendation.id,
      title: recommendation.recommendation,
      detail: recommendation.resolutionNote ?? recommendation.rationale,
      meta: `${recommendation.createdSeasonYear}${recommendation.createdRound ? ` · Round ${recommendation.createdRound}` : ''} · ${recommendation.status}`,
    })),
    playerRead: active
      ? `${staff.name} is your ${staff.role.toLowerCase()} and has a ${roleRating.toFixed(1)}/10 role rating.`
      : employer
        ? `${staff.name} is ${employer.name}'s ${staff.role.toLowerCase()} with a ${roleRating.toFixed(1)}/10 role rating. Recruiting them requires contract compensation.`
        : `${staff.name} is available with a ${roleRating.toFixed(1)}/10 role rating and a ${formatMoney(staff.signingFee * 1_000_000)} signing fee.`,
    route: '/staff',
  };
}

type ButtonProps = {
  state: GameState;
  subject: CharacterDossierSubject;
  children?: ReactNode;
  className?: string;
};

function interactionTargetFor(
  state: GameState,
  subject: CharacterDossierSubject,
  model: CharacterDossierModel,
): CharacterInteractionTarget | undefined {
  if (subject.type === 'playerPrincipal') return undefined;
  if (subject.type === 'aiPrincipal') {
    return { type: 'RivalPrincipal', id: model.id, name: model.name, teamId: subject.teamId };
  }
  if (subject.type === 'owner') {
    return { type: 'Owner', id: model.id, name: model.name, teamId: subject.teamId };
  }
  const active = (state.staff ?? []).some((member) => member.id === subject.staff.id);
  const employerTeamId = Object.entries(state.aiStaff ?? {}).find(([, roster]) => roster.some((member) => member.id === subject.staff.id))?.[0];
  return {
    type: active ? 'Staff' : 'StaffCandidate',
    id: subject.staff.id,
    name: subject.staff.name,
    teamId: active ? state.selectedTeamId : employerTeamId,
  };
}

export function CharacterDossierButton({ state, subject, children, className = '' }: ButtonProps) {
  const [open, setOpen] = useState(false);
  const model = useMemo(() => buildCharacterDossier(state, subject), [state, subject]);
  return (
    <>
      <Button
        variant="ghost"
        className={`px-2 py-1 text-xs ${className}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children ?? 'Character Card'}
      </Button>
      {open && <CharacterDossierModal state={state} subject={subject} model={model} onClose={() => setOpen(false)} />}
    </>
  );
}

function CharacterDossierModal({ state, subject, model, onClose }: { state: GameState; subject: CharacterDossierSubject; model: CharacterDossierModel; onClose: () => void }) {
  const [tab, setTab] = useState<DossierTab>('profile');
  const navigate = useNavigate();
  const interactionTarget = interactionTargetFor(state, subject, model);
  const interactionHistory = interactionTarget ? interactionHistoryForTarget(state, interactionTarget) : [];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${model.name} character dossier`}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl" style={{ borderTopColor: model.accent, borderTopWidth: 4 }}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 bg-neutral-900/80 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border text-xl font-black" style={{ borderColor: model.accent, color: model.accent, backgroundColor: `${model.accent}18` }}>
              {initials(model.name)}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{model.context}</div>
              <h2 className="truncate text-2xl font-bold text-neutral-100">{model.name}</h2>
              <p className="text-sm text-neutral-400">{model.role} · <span style={{ color: model.accent }}>{model.organization}</span></p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800" aria-label="Close character dossier">Close</button>
        </header>

        <nav className="flex gap-1 border-b border-neutral-800 bg-neutral-950 px-4 pt-2" aria-label="Character dossier sections">
          {(['profile', 'standing', 'actions', 'history'] as DossierTab[]).map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-t-md border-b-2 px-4 py-2 text-xs font-semibold capitalize ${tab === item ? 'border-amber-400 text-amber-300' : 'border-transparent text-neutral-500 hover:text-neutral-200'}`}>{item}</button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'profile' && (
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <DossierSection title={model.identityLabel}>
                <p className="text-sm leading-relaxed text-neutral-300">{model.identityDescription}</p>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">{model.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">{model.traits.map((trait) => <span key={trait} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300">{splitLabel(trait)}</span>)}</div>
              </DossierSection>
              <DossierSection title="Identity File">
                <dl className="space-y-2">{model.facts.map((fact) => <div key={fact.label} className="flex justify-between gap-4 border-b border-neutral-800/70 pb-2 text-xs"><dt className="text-neutral-500">{fact.label}</dt><dd className="text-right font-medium text-neutral-200">{fact.value}</dd></div>)}</dl>
              </DossierSection>
            </div>
          )}

          {tab === 'standing' && (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <DossierSection title="Standing & Capability">
                {model.metrics.length ? <div className="grid gap-3 sm:grid-cols-2">{model.metrics.map((metric) => <Metric key={metric.label} metric={metric} />)}</div> : <Empty>No measurable standing is available yet.</Empty>}
              </DossierSection>
              <DossierSection title="Commitments">
                {model.commitments.length ? <ul className="space-y-2 text-xs text-neutral-300">{model.commitments.map((commitment) => <li key={commitment} className="rounded border border-neutral-800 bg-neutral-900/50 p-2">{commitment}</li>)}</ul> : <Empty>No recorded clauses or formal commitments.</Empty>}
              </DossierSection>
            </div>
          )}

          {tab === 'actions' && (
            <DossierSection title="Management Actions">
              <CharacterActionPanel state={state} target={interactionTarget} />
            </DossierSection>
          )}

          {tab === 'history' && (
            <DossierSection title="Career Memory">
              {interactionHistory.length > 0 && (
                <div className="mb-4 grid gap-2 md:grid-cols-2">
                  {interactionHistory.map((entry) => <article key={entry.id} className="rounded border border-amber-900/60 bg-amber-950/15 p-3"><div className="text-sm font-semibold text-amber-200">{entry.actionLabel}</div><p className="mt-1 text-xs text-neutral-400">{entry.outcome}</p><div className="mt-2 text-[10px] uppercase tracking-wide text-neutral-600">{entry.seasonYear} · Round {entry.round} · {entry.tone}</div></article>)}
                </div>
              )}
              {model.history.length ? <div className="grid gap-2 md:grid-cols-2">{model.history.map((entry) => <article key={entry.key} className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><div className="text-sm font-semibold text-neutral-200">{entry.title}</div><p className="mt-1 text-xs text-neutral-400">{entry.detail}</p>{entry.meta && <div className="mt-2 text-[10px] uppercase tracking-wide text-neutral-600">{entry.meta}</div>}</article>)}</div> : interactionHistory.length === 0 ? <Empty>No major career events have been recorded yet.</Empty> : null}
            </DossierSection>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 bg-neutral-900/60 px-5 py-3">
          <p className="max-w-2xl text-xs text-neutral-400"><span className="font-semibold text-amber-300">Management read:</span> {model.playerRead}</p>
          <button type="button" onClick={() => { onClose(); navigate(model.route); }} className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400">Open related screen</button>
        </footer>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : words[0]?.slice(0, 2) ?? '??').toUpperCase();
}

function DossierSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-neutral-800 bg-neutral-900/35 p-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{title}</h3>{children}</section>;
}

function Metric({ metric }: { metric: DossierMetric }) {
  const score = metric.score == null ? undefined : Math.max(0, Math.min(100, metric.score));
  return <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3"><div className="flex items-center justify-between text-xs"><span className="text-neutral-500">{metric.label}</span><strong className="text-neutral-100">{metric.value}</strong></div>{score != null && <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-800"><div className="h-full rounded" style={{ width: `${score}%`, backgroundColor: ratingColor(score) }} /></div>}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}
