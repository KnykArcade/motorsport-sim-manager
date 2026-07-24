import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { NATIONALITIES } from '../data/principal/principalOptions';
import { buildTeamPrincipal, defaultPrincipalDraft, type PrincipalDraft } from '../sim/principalCreator';
import type { PrincipalAttributes, TeamPrincipal } from '../types/principalTypes';

const STARTING_LEVELS = [
  { id: 'rookie', label: 'Rookie', badge: 'NAT B', points: 30, reputation: -4, level: 1 },
  { id: 'veteran', label: 'Veteran', badge: 'INT B', points: 40, reputation: 4, level: 4 },
  { id: 'superstar', label: 'Superstar', badge: 'INT A', points: 52, reputation: 12, level: 7 },
] as const;

const ATTRIBUTE_INFO: Record<keyof PrincipalAttributes, { label: string; effect: string }> = {
  mediaImage: { label: 'Media Image', effect: 'Improves public reaction and media handling around the team.' },
  boardConfidence: { label: 'Board Confidence', effect: 'Strengthens owner support and protects job security.' },
  financialDiscipline: { label: 'Financial Discipline', effect: 'Improves budget control and commercial decision quality.' },
  driverManagement: { label: 'Driver Management', effect: 'Supports driver morale, development, and lineup decisions.' },
  development: { label: 'Development', effect: 'Improves car-development outcomes and technical direction.' },
  strategy: { label: 'Strategy', effect: 'Improves setup feedback and in-race decision quality.' },
};

type StartingLevelId = (typeof STARTING_LEVELS)[number]['id'];
type AttributeKey = keyof PrincipalAttributes;

export function PrincipalCreator({
  teamName,
  teamColor,
  onBack,
  onConfirm,
  confirmLabel,
}: {
  teamName: string;
  teamColor?: string;
  onBack: () => void;
  onConfirm: (principal: TeamPrincipal) => void;
  confirmLabel: string;
}) {
  const [draft, setDraft] = useState<PrincipalDraft>(defaultPrincipalDraft);
  const [startingLevel, setStartingLevel] = useState<StartingLevelId>('rookie');
  const [attributes, setAttributes] = useState<PrincipalAttributes>({
    mediaImage: 0,
    boardConfidence: 0,
    financialDiscipline: 0,
    driverManagement: 0,
    development: 0,
    strategy: 0,
  });
  const levelSpec = STARTING_LEVELS.find((level) => level.id === startingLevel) ?? STARTING_LEVELS[0];
  const spentPoints = Object.values(attributes).reduce((sum, value) => sum + value, 0);
  const pointsRemaining = levelSpec.points - spentPoints;
  const basePrincipal = useMemo(() => buildTeamPrincipal(draft), [draft]);
  const adjustedPrincipal = useMemo<TeamPrincipal>(() => ({
    ...basePrincipal,
    startingLevel,
    traitPointBudget: levelSpec.points,
    skillPoints: pointsRemaining,
    skillAttributes: attributes,
    mediaImage: attributes.mediaImage,
    driverManagement: attributes.driverManagement,
    developmentFocus: attributes.development,
    raceStrategy: attributes.strategy,
    commercialSkill: attributes.financialDiscipline,
    politicalSkill: attributes.boardConfidence,
    reputation: Math.max(0, Math.min(100, basePrincipal.reputation + levelSpec.reputation)),
  }), [attributes, basePrincipal, levelSpec.points, levelSpec.reputation, pointsRemaining, startingLevel]);

  const set = <K extends keyof PrincipalDraft>(key: K, value: PrincipalDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const setAttribute = (key: AttributeKey, value: number) => {
    setAttributes((current) => {
      const next = { ...current, [key]: Math.max(0, Math.min(100, value)) };
      return Object.values(next).reduce((sum, entry) => sum + entry, 0) <= levelSpec.points ? next : current;
    });
  };
  const applyStartingLevel = (id: StartingLevelId) => {
    setStartingLevel(id);
    setAttributes((current) => fitAttributeBudget(current, STARTING_LEVELS.find((level) => level.id === id)?.points ?? 30));
  };
  const initials = draft.name.trim().split(/\s+/).map((word) => word[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '??';
  const canConfirm = !!draft.name.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Principal Points</div>
          <h2 className="mt-1 text-xl font-bold text-neutral-100">Build your Team Principal</h2>
          <p className="text-sm text-neutral-400">
            Choose your identity, then invest as many or as few points as you want. Unspent points carry into your career.
          </p>
        </div>
        <Button variant="primary" disabled={!canConfirm} onClick={() => onConfirm(adjustedPrincipal)}>
          {canConfirm ? confirmLabel : 'Name your principal'}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.3fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-neutral-700 bg-gradient-to-b from-neutral-900 to-neutral-950">
            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-950" style={{ backgroundColor: teamColor ?? '#f59e0b' }}>
              FIA Paddock ID
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-xl font-black text-neutral-200">{initials}</div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-neutral-100">{draft.name.trim() || 'Unnamed Principal'}</div>
                <div className="text-xs text-amber-400">{teamName}</div>
                <div className="mt-1 text-[11px] text-neutral-500">{draft.nationality} · Age {draft.age}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-neutral-800 bg-neutral-800 text-center">
              <Pip label="Level" value={levelSpec.label} />
              <Pip label="Available" value={pointsRemaining} />
            </div>
          </div>
          <Section title="Identity">
            <div className="space-y-3">
              <Field label="Name">
                <input type="text" value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Alex Carter" className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-amber-500" />
              </Field>
              <Field label="Nationality">
                <Select value={draft.nationality ?? ''} onChange={(value) => set('nationality', value)}>
                  {NATIONALITIES.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
                </Select>
              </Field>
              <Field label={`Age — ${draft.age}`}>
                <input type="range" min={28} max={70} value={draft.age ?? 42} onChange={(event) => set('age', Number(event.target.value))} className="w-full accent-amber-500" />
              </Field>
            </div>
          </Section>
        </div>

        <Section title="Skill-point allocation">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span>{levelSpec.label} · {levelSpec.points} Principal Points</span>
            <strong>{pointsRemaining} unspent · carried into career</strong>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {STARTING_LEVELS.map((level) => (
              <button key={level.id} type="button" onClick={() => applyStartingLevel(level.id)} className={`rounded-lg border px-2 py-2 text-left text-xs transition ${startingLevel === level.id ? 'border-amber-500 bg-amber-500/10 text-neutral-100' : 'border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:border-neutral-600'}`}>
                <div className="font-bold">{level.label}</div>
                <div className="mt-0.5 text-[10px] text-neutral-500">{level.points} points · {level.badge}</div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.keys(ATTRIBUTE_INFO) as AttributeKey[]).map((key) => (
              <TraitAdjust key={key} label={ATTRIBUTE_INFO[key].label} value={attributes[key]} description={ATTRIBUTE_INFO[key].effect} onChange={(value) => setAttribute(key, value)} />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-xs text-neutral-400">
            These attributes become your career profile ratings. Principal Points earned from progression can later improve departments on the Staff screen.
          </div>
        </Section>
      </div>

      <Section title="Confirm profile">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-neutral-300">
            {draft.name.trim() || 'Your principal'} will lead {teamName} with <strong className="text-neutral-100">{pointsRemaining} Principal Points</strong> available after creation. Spending zero points is allowed.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack}>← Back</Button>
            <Button variant="primary" disabled={!canConfirm} onClick={() => onConfirm(adjustedPrincipal)}>
              {canConfirm ? confirmLabel : 'Name your principal'}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function fitAttributeBudget(current: PrincipalAttributes, target: number): PrincipalAttributes {
  const total = Object.values(current).reduce((sum, value) => sum + value, 0);
  if (total === 0) return current;
  const entries = Object.entries(current) as [AttributeKey, number][];
  const scaled = Object.fromEntries(entries.map(([key, value]) => [key, Math.floor((value / total) * target)])) as PrincipalAttributes;
  let remaining = target - Object.values(scaled).reduce((sum, value) => sum + value, 0);
  for (const key of Object.keys(scaled) as AttributeKey[]) {
    if (remaining <= 0) break;
    scaled[key] += 1;
    remaining -= 1;
  }
  return scaled;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h3>{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>{children}</label>;
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-amber-500">{children}</select>;
}

function TraitAdjust({ label, value, description, onChange }: { label: string; value: number; description: string; onChange: (value: number) => void }) {
  return <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-neutral-100">{label}</span><span className="tabular-nums text-sm font-bold text-amber-300">{value}</span></div><input aria-label={label} type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-amber-500" /><p className="mt-1 text-[11px] text-neutral-500">{description}</p></div>;
}

function Pip({ label, value }: { label: string; value: string | number }) {
  return <div className="bg-neutral-950/60 px-2 py-2"><div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div><div className="font-bold text-neutral-200">{value}</div></div>;
}
