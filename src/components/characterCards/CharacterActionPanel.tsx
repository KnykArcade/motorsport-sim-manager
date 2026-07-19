import { useState } from 'react';
import type { GameState } from '../../game/careerState';
import { useGame } from '../../game/GameContext';
import {
  availableCharacterActions,
  characterRequestHistoryForTarget,
  interactionHistoryForTarget,
  isCharacterInteractionAvailable,
} from '../../sim/characterInteractionEngine';
import type { CharacterInteractionTarget } from '../../types/characterInteractionTypes';
import {
  characterAgendaLabel,
  characterMemoriesForTarget,
  characterOpinionFor,
  characterOpinionLabel,
} from '../../sim/characterOpinionEngine';
import { activeAmbitionForTarget } from '../../sim/characterAmbitionEngine';
import { connectedCharacter, connectionsForTarget, factionsForTarget } from '../../sim/characterConnectionEngine';
import { disputesForTarget } from '../../sim/characterDisputeEngine';
import { commitmentsForTarget } from '../../sim/characterCommitmentEngine';
import { influenceForTarget } from '../../sim/characterInfluenceEngine';
import { initiativesForTarget } from '../../sim/characterInitiativeEngine';
import { mandatesForTarget } from '../../sim/characterMandateEngine';
import { breakingPointsForTarget, stabilityForTarget } from '../../sim/characterBreakingPointEngine';
import { characterFutureIntentLabel, futureIntentForTarget } from '../../sim/characterFutureIntentEngine';

type Props = {
  state: GameState;
  target?: CharacterInteractionTarget;
  initialSection?: CharacterActionSection;
};

type CharacterActionSection = 'overview' | 'interact' | 'connections' | 'recent';

const TONE_CLASS = {
  Positive: 'border-emerald-800/70 bg-emerald-950/30 text-emerald-200',
  Mixed: 'border-amber-800/70 bg-amber-950/30 text-amber-200',
  Negative: 'border-red-800/70 bg-red-950/30 text-red-200',
  Informational: 'border-sky-800/70 bg-sky-950/30 text-sky-200',
} as const;

const PRESSURE_CLASS = {
  Calm: 'text-emerald-300',
  Watchful: 'text-sky-300',
  Pressing: 'text-amber-300',
  Ultimatum: 'text-red-300',
} as const;

const INFLUENCE_CLASS = {
  Champion: 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300',
  Supportive: 'border-sky-700/60 bg-sky-950/30 text-sky-300',
  Neutral: 'border-neutral-700 bg-neutral-900 text-neutral-300',
  Resistant: 'border-amber-700/60 bg-amber-950/30 text-amber-300',
  Obstructive: 'border-red-700/60 bg-red-950/30 text-red-300',
} as const;

export function CharacterActionPanel({ state, target, initialSection = 'overview' }: Props) {
  const { dispatch } = useGame();
  const [section, setSection] = useState<CharacterActionSection>(initialSection);
  if (!target) {
    return <p className="text-sm text-neutral-500">This is your own management dossier. Actions are taken with the people around you.</p>;
  }

  const actions = availableCharacterActions(state, target);
  const available = isCharacterInteractionAvailable(state, target);
  const latest = interactionHistoryForTarget(state, target)[0];
  const requestHistory = characterRequestHistoryForTarget(state, target).slice(0, 3);
  const opinion = characterOpinionFor(state, target);
  const allMemories = characterMemoriesForTarget(state, target);
  const memories = allMemories.slice(0, 3);
  const ambition = activeAmbitionForTarget(state, target);
  const connections = connectionsForTarget(state, target).slice(0, 6);
  const factions = factionsForTarget(state, target);
  const disputes = disputesForTarget(state, target).filter((dispute) => dispute.status !== 'Resolved');
  const commitments = commitmentsForTarget(state, target);
  const activeCommitments = commitments.filter((commitment) => commitment.status === 'Active').slice(0, 2);
  const resolvedCommitments = commitments.filter((commitment) => commitment.status !== 'Active').slice(0, 3);
  const influence = influenceForTarget(state, target);
  const initiatives = initiativesForTarget(state, target);
  const activeInitiative = initiatives.find((initiative) => initiative.status === 'Active');
  const recentInitiatives = initiatives.filter((initiative) => initiative.status !== 'Active').slice(0, 3);
  const mandates = mandatesForTarget(state, target);
  const activeMandate = mandates.find((mandate) => mandate.status === 'Active');
  const recentMandates = mandates.filter((mandate) => mandate.status !== 'Active').slice(0, 3);
  const stability = stabilityForTarget(state, target);
  const breakingPoints = breakingPointsForTarget(state, target);
  const activeBreakingPoint = breakingPoints.find((entry) => entry.status === 'Active');
  const recentBreakingPoints = breakingPoints.filter((entry) => entry.status !== 'Active').slice(0, 3);
  const futureIntent = futureIntentForTarget(state, target);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1">
        {([
          ['overview', 'Opinion & ambition'],
          ['interact', 'Direct actions'],
          ['connections', 'Connections'],
          ['recent', 'Recent history'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`flex-1 rounded px-2 py-2 text-[11px] font-semibold transition-colors ${section === id ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Opinion of you</div>
              <div className="mt-1 text-lg font-semibold text-neutral-100">
                {characterOpinionLabel(opinion.score)} <span className="text-sm font-normal text-neutral-500">{opinion.score > 0 ? '+' : ''}{opinion.score}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"><span className="block text-neutral-500">Trust</span><strong className="text-neutral-200">{opinion.trust}</strong></div>
              <div className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"><span className="block text-neutral-500">Respect</span><strong className="text-neutral-200">{opinion.respect}</strong></div>
              <div className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"><span className="block text-neutral-500">Memories</span><strong className="text-neutral-200">{allMemories.length}</strong></div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded bg-amber-950/60 px-2 py-1 text-amber-200">Agenda: {characterAgendaLabel(opinion.agenda)}</span>
            {opinion.traits.map((trait) => <span key={trait} className="rounded bg-neutral-900 px-2 py-1 text-neutral-400">{trait}</span>)}
          </div>
          {influence && (
            <div className={`mt-3 rounded border p-2.5 ${INFLUENCE_CLASS[influence.stance]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Internal influence</div>
                  <strong className="mt-0.5 block text-xs">{influence.stance}</strong>
                </div>
                <div className="flex gap-3 text-[10px]">
                  <span>Power <strong>{influence.power}</strong></span>
                  <span>Support <strong>{influence.support > 0 ? '+' : ''}{influence.support}</strong></span>
                </div>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-300">{influence.effectLabel}</p>
              <div className="mt-1 line-clamp-1 text-[10px] text-neutral-500">{influence.basis.join(' · ')}</div>
            </div>
          )}
          {stability && (
            <div className={`mt-3 rounded border p-2.5 ${stability.band === 'BreakingPoint' ? 'border-red-800/70 bg-red-950/25' : stability.band === 'Unsettled' ? 'border-amber-800/60 bg-amber-950/20' : 'border-neutral-800 bg-neutral-900/70'}`}>
              <div className="flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Relationship stability</div><strong className="mt-0.5 block text-xs text-neutral-200">{stability.band}</strong></div><span className={`text-sm font-bold ${stability.band === 'BreakingPoint' ? 'text-red-300' : stability.band === 'Unsettled' ? 'text-amber-300' : 'text-neutral-300'}`}>{stability.score}/100</span></div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-500">{stability.reasons.join(' · ') || 'No major destabilizing pressure is currently recorded.'}</p>
              {activeBreakingPoint && <div className="mt-2 rounded border border-red-900/50 bg-red-950/30 px-2 py-1.5 text-[10px] font-semibold text-red-300">Required response pending in Paddock Week</div>}
            </div>
          )}
          {futureIntent && (
            <div className={`mt-3 rounded border p-2.5 ${futureIntent.status === 'WantsExit' ? 'border-red-800/70 bg-red-950/25' : futureIntent.status === 'TestingMarket' ? 'border-amber-800/60 bg-amber-950/20' : 'border-emerald-900/50 bg-emerald-950/10'}`}>
              <div className="flex items-center justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Future intention</div><strong className="mt-0.5 block text-xs text-neutral-200">{characterFutureIntentLabel(target, futureIntent.status)}</strong></div><span className="text-[10px] font-semibold text-neutral-400">Leverage {futureIntent.leverage}</span></div>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{futureIntent.reason}</p>
              {target.type === 'Driver' && futureIntent.negotiationModifier !== 0 && <div className={`mt-1 text-[10px] font-semibold ${futureIntent.negotiationModifier > 0 ? 'text-emerald-300' : 'text-red-300'}`}>Renewal willingness {futureIntent.negotiationModifier > 0 ? '+' : ''}{futureIntent.negotiationModifier}</div>}
            </div>
          )}
          {activeInitiative && (
            <div className="mt-3 rounded border border-fuchsia-800/60 bg-fuchsia-950/20 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fuchsia-300">Active initiative</div><strong className="mt-1 block text-xs text-neutral-200">{activeInitiative.title}</strong></div>
                <span className="text-[10px] font-semibold text-amber-300">R{activeInitiative.startedRound}</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">{activeInitiative.motive}</p>
            </div>
          )}
          {activeMandate && (
            <div className="mt-3 rounded border border-cyan-800/60 bg-cyan-950/20 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">Delegated mandate · {activeMandate.authority}</div><strong className="mt-1 block text-xs text-neutral-200">{activeMandate.title}</strong></div>
                <span className="text-[10px] font-semibold text-amber-300">Due R{activeMandate.dueRound}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.min(100, Math.round((activeMandate.currentValue / Math.max(1, activeMandate.targetValue)) * 100))}%` }} /></div>
              <div className="mt-1 flex justify-between gap-2 text-[10px] text-neutral-500"><span>{activeMandate.measureLabel}</span><span>{activeMandate.currentValue}/{activeMandate.targetValue}</span></div>
            </div>
          )}
          {ambition && (
            <div className="mt-3 rounded border border-neutral-800 bg-neutral-900/70 p-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Active ambition</div>
                  <strong className="mt-1 block text-xs text-neutral-200">{ambition.title}</strong>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${PRESSURE_CLASS[ambition.pressure]}`}>{ambition.pressure}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{ambition.description}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.round((ambition.currentValue / Math.max(1, ambition.targetValue)) * 100))}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-neutral-500">
                <span>{ambition.measureLabel}: {ambition.currentValue}/{ambition.targetValue}</span>
                <span>Due {ambition.deadlineSeason} · R{ambition.deadlineRound}</span>
              </div>
            </div>
          )}
          {activeCommitments.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{activeCommitments.map((commitment) => <article key={commitment.id} className="rounded border border-violet-800/60 bg-violet-950/20 p-2.5"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Your commitment</div><strong className="mt-1 block text-xs text-neutral-200">{commitment.title}</strong></div><span className="text-[10px] font-semibold text-amber-300">Due R{commitment.dueRound}</span></div><p className="mt-1 text-[10px] leading-relaxed text-neutral-400">{commitment.measureLabel}: {commitment.currentValue}/{commitment.targetValue} {commitment.direction === 'AtMost' ? 'maximum' : 'required'}</p></article>)}</div>}
          {memories.length > 0 && (
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {memories.map((memory) => (
                <article key={memory.id} className={`rounded border p-2 ${TONE_CLASS[memory.tone]}`}>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-semibold">
                    <span>{memory.label}</span>
                    <span className="opacity-60">{memory.seasonYear} · R{memory.round}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-300">{memory.description}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {section === 'interact' && (
        <div className="space-y-3">
          {!actions.length ? (
            <p className="rounded border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-500">No direct management actions are available with this character in their current role.</p>
          ) : (
            <>
              <div className="rounded border border-neutral-800 bg-neutral-950/70 p-3">
                <div className="text-xs font-semibold text-neutral-200">
                  {available ? 'Choose one meaningful interaction this round' : 'Interaction completed for this round'}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {available
                    ? 'The result changes the relationship or management state immediately and is recorded in this career.'
                    : `You have already met with ${target.name}. Another action becomes available next round.`}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {actions.map((action) => (
                  <article key={action.id} className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                    <h4 className="text-sm font-semibold text-neutral-100">{action.label}</h4>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-neutral-400">{action.description}</p>
                    <p className="mt-2 text-[11px] text-amber-300/80">Likely effect: {action.effectPreview}</p>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => dispatch({ type: 'PERFORM_CHARACTER_INTERACTION', target, action: action.id })}
                      className="mt-3 rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
                    >
                      {available ? action.label : 'Used this round'}
                    </button>
                  </article>
                ))}
              </div>
              {latest && (
                <section className={`rounded-lg border p-3 ${TONE_CLASS[latest.tone]}`}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em]">Latest outcome · {latest.actionLabel}</div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-200">{latest.outcome}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {latest.effects.map((effect) => <span key={effect} className="rounded bg-black/25 px-2 py-1 text-[10px]">{effect}</span>)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {section === 'connections' && (
        <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          {disputes.length > 0 && <section className="rounded-lg border border-red-900/70 bg-red-950/15 p-3 lg:col-span-2"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">Active disputes</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{disputes.map((dispute) => { const other = dispute.characterA.id === target.id && dispute.characterA.type === target.type ? dispute.characterB : dispute.characterA; return <article key={dispute.id} className="rounded border border-red-900/50 bg-neutral-950/60 p-2.5"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-neutral-200">With {other.name}</strong><span className="text-[10px] font-bold text-red-300">{dispute.status} · {dispute.intensity}</span></div><p className="mt-1 text-[10px] leading-relaxed text-neutral-400">Disagreement over {dispute.issue}.</p>{dispute.resolutionLabel && <div className="mt-1 text-[10px] text-amber-300">Last intervention: {dispute.resolutionLabel}</div>}</article>; })}</div></section>}
          <section className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Personal network</div>
            {connections.length > 0 ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {connections.map((connection) => {
                  const other = connectedCharacter(connection, target);
                  const positive = connection.affinity >= 0;
                  return (
                    <article key={connection.id} className="rounded border border-neutral-800 bg-neutral-900/60 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="block text-xs text-neutral-200">{other.name}</strong>
                          <span className="text-[10px] text-neutral-500">{connection.kind.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
                        </div>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${positive ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                          {connection.band} {connection.affinity > 0 ? '+' : ''}{connection.affinity}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] leading-relaxed text-neutral-400">{connection.basis}</p>
                      <div className="mt-1 text-[10px] text-neutral-600">Influence strength {connection.strength}</div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="mt-2 text-xs text-neutral-500">No meaningful connections have formed around {target.name} yet.</p>}
          </section>
          <section className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Factions and camps</div>
            {factions.length > 0 ? (
              <div className="mt-2 space-y-2">
                {factions.map((faction) => (
                  <article key={faction.id} className="rounded border border-neutral-800 bg-neutral-900/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-xs text-neutral-200">{faction.name}</strong>
                      <span className="text-[10px] font-semibold text-amber-300">{faction.stance}</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">{faction.description}</p>
                    <div className="mt-2 flex gap-3 text-[10px] text-neutral-500">
                      <span>Cohesion {faction.cohesion}</span><span>Influence {faction.influence}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="mt-2 text-xs text-neutral-500">This character is not currently part of an influential camp.</p>}
          </section>
        </div>
      )}

      {section === 'recent' && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Recent requests and decisions</div>
          {requestHistory.length > 0 ? (
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              {requestHistory.map((record) => (
                <article key={record.id} className="rounded border border-neutral-800 bg-neutral-900/50 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <strong className="text-neutral-200">{record.optionLabel}</strong>
                    <span className="text-[10px] text-neutral-600">{record.seasonYear} · R{record.round}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{record.outcome}</p>
                </article>
              ))}
            </div>
          ) : <p className="mt-2 text-xs text-neutral-500">No character-request decisions have been recorded with {target.name} yet.</p>}
          {resolvedCommitments.length > 0 && <div className="mt-3 border-t border-neutral-800 pt-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Commitment outcomes</div><div className="mt-2 grid gap-2 lg:grid-cols-3">{resolvedCommitments.map((commitment) => <article key={commitment.id} className={`rounded border p-2.5 ${commitment.status === 'Fulfilled' ? 'border-emerald-900/70 bg-emerald-950/20' : 'border-red-900/70 bg-red-950/20'}`}><div className="flex items-center justify-between gap-2"><strong className="text-xs text-neutral-200">{commitment.title}</strong><span className={`text-[10px] font-bold ${commitment.status === 'Fulfilled' ? 'text-emerald-300' : 'text-red-300'}`}>{commitment.status}</span></div><p className="mt-1 text-[10px] text-neutral-500">{commitment.measureLabel}: {commitment.currentValue}/{commitment.targetValue}</p></article>)}</div></div>}
          {recentInitiatives.length > 0 && <div className="mt-3 border-t border-neutral-800 pt-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Initiative outcomes</div><div className="mt-2 grid gap-2 lg:grid-cols-3">{recentInitiatives.map((initiative) => <article key={initiative.id} className="rounded border border-fuchsia-900/50 bg-fuchsia-950/10 p-2.5"><div className="flex items-center justify-between gap-2"><strong className="text-xs text-neutral-200">{initiative.title}</strong><span className="text-[10px] font-bold text-fuchsia-300">{initiative.status}</span></div><p className="mt-1 line-clamp-2 text-[10px] text-neutral-500">{initiative.outcome ?? initiative.motive}</p></article>)}</div></div>}
          {recentMandates.length > 0 && <div className="mt-3 border-t border-neutral-800 pt-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Mandate accountability</div><div className="mt-2 grid gap-2 lg:grid-cols-3">{recentMandates.map((mandate) => <article key={mandate.id} className={`rounded border p-2.5 ${mandate.status === 'Succeeded' ? 'border-emerald-900/60 bg-emerald-950/15' : 'border-red-900/60 bg-red-950/15'}`}><div className="flex items-center justify-between gap-2"><strong className="text-xs text-neutral-200">{mandate.title}</strong><span className={`text-[10px] font-bold ${mandate.status === 'Succeeded' ? 'text-emerald-300' : 'text-red-300'}`}>{mandate.status}</span></div><p className="mt-1 line-clamp-2 text-[10px] text-neutral-500">{mandate.outcome}</p></article>)}</div></div>}
          {recentBreakingPoints.length > 0 && <div className="mt-3 border-t border-neutral-800 pt-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Breaking-point decisions</div><div className="mt-2 grid gap-2 lg:grid-cols-3">{recentBreakingPoints.map((entry) => <article key={entry.id} className={`rounded border p-2.5 ${entry.status === 'Defused' ? 'border-emerald-900/60 bg-emerald-950/15' : entry.status === 'Escalated' ? 'border-red-900/60 bg-red-950/15' : 'border-amber-900/60 bg-amber-950/15'}`}><div className="flex items-center justify-between gap-2"><strong className="text-xs text-neutral-200">{entry.optionLabel ?? 'Breaking point resolved'}</strong><span className="text-[10px] font-bold text-neutral-400">{entry.status}</span></div><p className="mt-1 line-clamp-2 text-[10px] text-neutral-500">{entry.outcome}</p></article>)}</div></div>}
        </section>
      )}
    </div>
  );
}
