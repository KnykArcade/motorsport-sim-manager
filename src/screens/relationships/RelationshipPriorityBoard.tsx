import { useState } from 'react';
import { Panel } from '../../components/Panel';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import {
  relationshipHierarchyDashboard,
  relationshipActionWindowDetail,
  relationshipActionWindowLabel,
  relationshipStatusLabel,
  relationshipTargetLabel,
  stableInternalRelationships,
  visibleRelationshipPriorities,
} from './relationshipPriorityViewModel';
import { CollectiveStakeholderBoard } from './CollectiveStakeholderBoard';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import { PotentialEmployerBoard } from './PotentialEmployerBoard';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import { ExternalTalentBoard } from './ExternalTalentBoard';
import type { ExternalTalentContext } from './relationshipTalentViewModel';
import { RelationshipRiskNote } from './RelationshipRiskNote';
import { characterRiskIfIgnored, relationshipRiskPriorityContext } from './relationshipRiskViewModel';
import { characterManagementMove } from './relationshipActionViewModel';
import { RelationshipActionPreview } from './RelationshipActionPreview';
import type { GameState } from '../../game/careerState';
import { CharacterDossierButton } from '../../components/characterCards/CharacterDossier';
import { DriverDossierButton } from '../../components/driverCards/DriverDossier';
import type { CollectiveStakeholderAction } from '../../types/phase18Types';
import { characterGameplayEffect } from './relationshipCharacterEffectViewModel';

const STATUS_STYLES: Record<RelationshipAttentionProfile['status'], string> = {
  MustActNow: 'border-red-500/45 bg-red-500/5 text-red-200',
  WatchClosely: 'border-amber-500/40 bg-amber-500/5 text-amber-200',
  Stable: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
};

const HIERARCHY_STATUS_STYLES: Record<RelationshipAttentionProfile['status'], string> = {
  MustActNow: 'border-red-500/40 bg-red-950/20 text-red-200',
  WatchClosely: 'border-amber-500/35 bg-amber-950/15 text-amber-200',
  Stable: 'border-neutral-800 bg-neutral-900/35 text-neutral-300',
};

type Props = {
  state: GameState;
  profiles: RelationshipAttentionProfile[];
  onReview: (profile: RelationshipAttentionProfile) => void;
  collectiveProfiles: CollectiveStakeholderProfile[];
  onReviewCollective: (profile: CollectiveStakeholderProfile) => void;
  onTakeCollectiveAction: (action: CollectiveStakeholderAction) => void;
  employerStanding?: PotentialEmployerStanding;
  onReviewEmployers: () => void;
  externalTalent: ExternalTalentContext;
  onReviewDriverMarket: () => void;
  onReviewStaffMarket: () => void;
};

export function RelationshipPriorityBoard({ state, profiles, onReview, collectiveProfiles, onReviewCollective, onTakeCollectiveAction, employerStanding, onReviewEmployers, externalTalent, onReviewDriverMarket, onReviewStaffMarket }: Props) {
  const [showStableStaff, setShowStableStaff] = useState(false);
  const visible = visibleRelationshipPriorities(profiles);
  const stableInternal = stableInternalRelationships(profiles);
  const stableCore = stableInternal.filter((profile) => profile.target.type === 'Owner' || profile.target.type === 'Driver');
  const stableStaff = stableInternal.filter((profile) => profile.target.type === 'Staff');
  const hierarchyDashboard = relationshipHierarchyDashboard(profiles, collectiveProfiles, employerStanding, externalTalent);

  return (
    <div className="space-y-4">
      <Panel title="Current Priority Board">
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <SignalExplanation
            title="Authority"
            detail="Formal hierarchy. The owner remains #1 even when another relationship needs attention first."
          />
          <SignalExplanation
            title="Influence"
            detail="Practical leverage on a 1–100 scale. A genuine superstar can rival ownership power."
          />
          <SignalExplanation
            title="Attention"
            detail="What needs action now. Deadlines, disputes, promises, and instability can temporarily reorder the queue."
          />
        </div>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/15 p-3">
            <div className="text-sm font-semibold text-emerald-200">No relationship needs action</div>
            <p className="mt-1 text-xs text-neutral-400">Stable owner and driver positions remain summarized below. You do not need to manufacture a weekly interaction.</p>
          </div>
        ) : (
          <>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-300">Active attention · {visible.length}</div>
            <div className="grid gap-2 lg:grid-cols-2">
              {visible.map((profile) => (
                <RelationshipPriorityCard
                  key={`${profile.target.type}:${profile.target.id}`}
                  state={state}
                  profile={profile}
                  onReview={onReview}
                />
              ))}
            </div>
          </>
        )}

        {stableCore.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">Stable core · no action required</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stableCore.map((profile) => <StableRelationshipAnchor key={`${profile.target.type}:${profile.target.id}`} profile={profile} onReview={onReview} />)}
            </div>
          </div>
        )}

        {stableStaff.length > 0 && (
          <div className="mt-3 border-t border-neutral-800 pt-3">
            <button
              type="button"
              onClick={() => setShowStableStaff((current) => !current)}
              className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 hover:underline"
              aria-expanded={showStableStaff}
            >
              {showStableStaff ? 'Hide' : 'Show'} stable staff relationships ({stableStaff.length})
            </button>
            {showStableStaff && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stableStaff.map((profile) => <StableRelationshipAnchor key={`${profile.target.type}:${profile.target.id}`} profile={profile} onReview={onReview} />)}
              </div>
            )}
          </div>
        )}
        <p className="mt-3 text-[10px] text-neutral-500">
          Stable rival principals stay in the Rival Matrix so the board remains focused. Any active rival tension will appear here automatically.
        </p>
      </Panel>

      <CollectiveStakeholderBoard state={state} profiles={collectiveProfiles} onReview={onReviewCollective} onTakeAction={onTakeCollectiveAction} />

      <PotentialEmployerBoard standing={employerStanding} onReview={onReviewEmployers} />

      <ExternalTalentBoard context={externalTalent} onReviewDrivers={onReviewDriverMarket} onReviewStaff={onReviewStaffMarket} />

      <Panel title="Relationship Management Hierarchy">
        <div className="grid gap-2 lg:grid-cols-2">
          {hierarchyDashboard.map((row) => (
            <div key={row.rank} className={`flex gap-3 rounded-lg border p-3 ${HIERARCHY_STATUS_STYLES[row.status]}`}>
              <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-neutral-950/70 text-sm font-black text-[var(--era-accent-strong)]">
                #{row.rank}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="text-xs font-bold text-neutral-100">{row.title}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-current">
                    {relationshipStatusLabel(row.status)}
                    {row.totalCount > 0 ? ` · ${row.activeCount}/${row.totalCount} active` : ' · no live source'}
                  </div>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{row.motivation}</p>
                <div className="mt-2 rounded border border-neutral-700/60 bg-neutral-950/35 px-2 py-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Current signal</div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-400">{row.signal}</p>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">{row.jumpCondition}</p>
                <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-600">{row.coverage}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function StableRelationshipAnchor({ profile, onReview }: { profile: RelationshipAttentionProfile; onReview: (profile: RelationshipAttentionProfile) => void }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/35 p-2.5">
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-neutral-200">{profile.target.name}</div>
        <div className="mt-0.5 text-[9px] uppercase tracking-wide text-neutral-600">
          {relationshipTargetLabel(profile.target.type)} · Authority #{profile.authorityRank} · Influence {profile.influence}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onReview(profile)}
        className="shrink-0 text-[10px] font-semibold text-neutral-500 hover:text-neutral-200 hover:underline"
      >
        Review
      </button>
    </article>
  );
}

function SignalExplanation({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--era-accent-strong)]">{title}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{detail}</p>
    </div>
  );
}

function RelationshipPriorityCard({ state, profile, onReview }: { state: GameState; profile: RelationshipAttentionProfile; onReview: (profile: RelationshipAttentionProfile) => void }) {
  const move = characterManagementMove(profile);
  const gameplayEffect = characterGameplayEffect(state, profile);

  return (
    <article className={`rounded-lg border p-3 ${STATUS_STYLES[profile.status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-neutral-100">{profile.target.name}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
            {relationshipTargetLabel(profile.target.type)} · Authority #{profile.authorityRank}
          </div>
        </div>
        <span className="shrink-0 rounded border border-current/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
          {relationshipStatusLabel(profile.status)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded bg-neutral-950/35 px-2.5 py-2">
        <div className="text-[11px] text-neutral-400">{profile.authorityLabel}</div>
        <div className="shrink-0 text-right">
          <div className="text-base font-black tabular-nums text-neutral-100">{profile.influence}</div>
          <div className="text-[9px] uppercase tracking-wide text-neutral-500">Influence</div>
        </div>
      </div>

      <div className="mt-2 rounded border border-neutral-700/70 bg-neutral-950/35 px-2.5 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Action window</div>
          <div className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-neutral-200">
            {relationshipActionWindowLabel(profile.actionWindow)}
          </div>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">{relationshipActionWindowDetail(profile.actionWindow)}</p>
      </div>

      {gameplayEffect && (
        <div className={`mt-2 rounded border px-2.5 py-2 ${gameplayEffect.tone === 'Positive' ? 'border-emerald-700/45 bg-emerald-950/20' : gameplayEffect.tone === 'Negative' ? 'border-red-700/45 bg-red-950/20' : 'border-neutral-700/70 bg-neutral-950/35'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">Current gameplay effect · {gameplayEffect.label}</div>
            <div className={`shrink-0 text-xs font-bold tabular-nums ${gameplayEffect.tone === 'Positive' ? 'text-emerald-300' : gameplayEffect.tone === 'Negative' ? 'text-red-300' : 'text-neutral-300'}`}>
              {gameplayEffect.value}
            </div>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">{gameplayEffect.detail}</p>
        </div>
      )}

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

      <RelationshipRiskNote priorityContext={relationshipRiskPriorityContext(profile)}>{characterRiskIfIgnored(profile)}</RelationshipRiskNote>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ManagementActionButton state={state} profile={profile} onReview={onReview} />
        <button
          type="button"
          onClick={() => onReview(profile)}
          className="px-1 text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 hover:underline"
        >
          Review full file →
        </button>
      </div>
    </article>
  );
}

function ManagementActionButton({ state, profile, onReview }: { state: GameState; profile: RelationshipAttentionProfile; onReview: (profile: RelationshipAttentionProfile) => void }) {
  const sharedClass = 'border border-amber-500/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20';
  if (profile.target.type === 'Owner' && profile.target.teamId) {
    return <CharacterDossierButton state={state} subject={{ type: 'owner', teamId: profile.target.teamId }} initialTab="actions" className={sharedClass}>Take owner action →</CharacterDossierButton>;
  }
  if (profile.target.type === 'Driver') {
    const driver = state.drivers.find((entry) => entry.id === profile.target.id);
    if (driver) return <DriverDossierButton state={state} subject={{ type: 'driver', driver }} focus="relationship" actionIntent className={sharedClass}>Take driver action →</DriverDossierButton>;
  }
  if (profile.target.type === 'Staff') {
    const staff = state.staff?.find((entry) => entry.id === profile.target.id);
    if (staff) return <CharacterDossierButton state={state} subject={{ type: 'staff', staff }} initialTab="actions" className={sharedClass}>Take staff action →</CharacterDossierButton>;
  }
  if (profile.target.type === 'RivalPrincipal' && profile.target.teamId) {
    return <CharacterDossierButton state={state} subject={{ type: 'aiPrincipal', teamId: profile.target.teamId }} initialTab="actions" className={sharedClass}>Choose paddock action →</CharacterDossierButton>;
  }
  return <button type="button" onClick={() => onReview(profile)} className={`rounded px-2 py-1 text-xs font-semibold ${sharedClass}`}>Open management options →</button>;
}
