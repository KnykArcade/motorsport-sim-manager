import { Panel } from '../../components/Panel';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import { relationshipStatusLabel } from './relationshipPriorityViewModel';
import { RelationshipRiskNote } from './RelationshipRiskNote';
import { collectiveRiskIfIgnored, relationshipRiskPriorityContext } from './relationshipRiskViewModel';
import { collectiveManagementMove } from './relationshipActionViewModel';
import { RelationshipActionPreview } from './RelationshipActionPreview';
import type { GameState } from '../../game/careerState';
import type { CollectiveStakeholderAction } from '../../types/phase18Types';
import { formatMoney } from '../../components/ui';
import {
  COLLECTIVE_STAKEHOLDER_ACTIONS,
  collectiveStakeholderActionFit,
  collectiveStakeholderActionUnavailableReason,
} from '../../sim/collectiveStakeholderActionEngine';

const STATUS_STYLES: Record<CollectiveStakeholderProfile['status'], string> = {
  MustActNow: 'border-red-500/45 bg-red-500/5 text-red-200',
  WatchClosely: 'border-amber-500/40 bg-amber-500/5 text-amber-200',
  Stable: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
};

function stakeholderHealthRead(health: number): string {
  if (health >= 75) return 'Strong';
  if (health >= 55) return 'Stable';
  if (health >= 35) return 'Fragile';
  return 'Critical';
}

type Props = {
  state: GameState;
  profiles: CollectiveStakeholderProfile[];
  onReview: (profile: CollectiveStakeholderProfile) => void;
  onTakeAction: (action: CollectiveStakeholderAction) => void;
};

export function CollectiveStakeholderBoard({ state, profiles, onReview, onTakeAction }: Props) {
  return (
    <Panel title="Collective Stakeholders · Authority #4–5">
      <p className="mb-3 text-xs text-neutral-400">
        Committees, partners, and supporters are managed as collective relationships. They affect delivery and resources without adding individual-character micromanagement.
      </p>
      {profiles.length === 0 ? (
        <p className="text-sm text-neutral-500">No collective stakeholder data is available on this save.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {profiles.map((profile) => (
            <CollectiveStakeholderCard key={profile.id} state={state} profile={profile} onReview={onReview} onTakeAction={onTakeAction} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function CollectiveStakeholderCard({ state, profile, onReview, onTakeAction }: { state: GameState; profile: CollectiveStakeholderProfile; onReview: (profile: CollectiveStakeholderProfile) => void; onTakeAction: (action: CollectiveStakeholderAction) => void }) {
  const move = collectiveManagementMove(profile);
  const actions = COLLECTIVE_STAKEHOLDER_ACTIONS.filter((action) => action.stakeholderId === profile.id);

  return (
    <article className={`rounded-lg border p-3 ${STATUS_STYLES[profile.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-neutral-100">{profile.title}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
            Authority #{profile.authorityRank} · Collective relationship
          </div>
        </div>
        <span className="shrink-0 rounded border border-current/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
          {relationshipStatusLabel(profile.status)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded bg-neutral-950/35 px-2.5 py-2">
        <div className="text-[11px] text-neutral-400">{profile.authorityLabel}</div>
        <div className="shrink-0 text-right">
          <div className="text-base font-black text-neutral-100">{stakeholderHealthRead(profile.health)}</div>
          <div className="text-[9px] uppercase tracking-wide text-neutral-500">Health</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {profile.metrics.map((metric) => (
          <div key={metric.label} className="rounded bg-neutral-950/30 px-2 py-1.5 text-center">
            <div className="text-xs font-bold tabular-nums text-neutral-200">{metric.value}</div>
            <div className="text-[8px] uppercase tracking-wide text-neutral-600">{metric.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-current/15 bg-neutral-950/25 px-2.5 py-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Current gameplay effect · {profile.gameplayEffect.label}</div>
          <p className="mt-0.5 text-[9px] leading-relaxed text-neutral-500">{profile.gameplayEffect.detail}</p>
        </div>
        <span className="text-xs font-black tabular-nums text-neutral-100">{profile.gameplayEffect.value}</span>
      </div>

      <ul className="mt-2 space-y-1 text-[11px] text-neutral-300">
        {profile.reasons.slice(0, 2).map((reason) => <li key={reason}>• {reason}</li>)}
      </ul>

      <div className="mt-3 rounded border border-neutral-700/70 bg-neutral-950/45 p-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">Management move</div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <span className="rounded border border-[var(--era-accent)]/35 bg-[var(--era-accent-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">{move.styleLabel}</span>
            <span className="rounded border border-neutral-700/60 bg-neutral-950/35 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-500">{move.priorityLabel}</span>
          </div>
        </div>
        <div className="mt-1 text-xs font-semibold text-neutral-100">{move.title}</div>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--era-accent-strong)]">{move.styleDetail}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{move.rationale}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{move.expectedEffect}</p>
        <RelationshipActionPreview preview={move.preview} />
      </div>

      <RelationshipRiskNote priorityContext={relationshipRiskPriorityContext(profile)}>{collectiveRiskIfIgnored(profile)}</RelationshipRiskNote>

      <div className="mt-3 border-t border-current/15 pt-3">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-wide text-neutral-500">Committee action · one per round</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {actions.map((action) => {
            const unavailableReason = collectiveStakeholderActionUnavailableReason(state, action);
            const fit = collectiveStakeholderActionFit(state, action);
            return (
              <button
                key={action.id}
                type="button"
                disabled={!!unavailableReason}
                title={unavailableReason}
                onClick={() => onTakeAction(action.id)}
                className="rounded border border-neutral-700 bg-neutral-950/45 p-2.5 text-left enabled:hover:border-[var(--era-accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-neutral-100">{action.label}</span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[9px] font-semibold text-[var(--era-accent-strong)]">{action.cost ? formatMoney(action.cost) : 'No cost'}</span>
                    <span className={`mt-0.5 block text-[8px] font-black uppercase tracking-wide ${
                      fit.label === 'Favored' ? 'text-emerald-300' : fit.label === 'Risky' ? 'text-red-300' : 'text-neutral-400'
                    }`}>{fit.label}</span>
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">{action.description}</p>
                <p className="mt-1 text-[9px] leading-relaxed text-neutral-500">{unavailableReason ?? `${fit.effectPreview} ${fit.reason}`}</p>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onReview(profile)}
        className="mt-3 text-[11px] font-semibold text-[var(--era-accent-strong)] hover:underline"
      >
        {profile.actionLabel} →
      </button>
    </article>
  );
}
