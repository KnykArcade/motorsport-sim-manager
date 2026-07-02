import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import {
  BACKGROUNDS,
  DEVELOPMENT_PHILOSOPHIES,
  DRIVER_MANAGEMENT_STYLES,
  MANAGEMENT_STYLES,
  MEDIA_PERSONALITIES,
  MODIFIER_LABELS,
  NATIONALITIES,
  RACE_STRATEGY_PHILOSOPHIES,
  RISK_TOLERANCES,
  STRENGTHS,
  optionById,
  type PrincipalOption,
} from '../data/principal/principalOptions';
import {
  buildTeamPrincipal,
  computePrincipalModifiers,
  defaultPrincipalDraft,
  type PrincipalDraft,
} from '../sim/principalCreator';
import type { PrincipalModifierKey, TeamPrincipal } from '../types/principalTypes';

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
  const set = <K extends keyof PrincipalDraft>(key: K, value: PrincipalDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const principal = useMemo(() => buildTeamPrincipal(draft), [draft]);
  const modifiers = useMemo(() => computePrincipalModifiers(principal), [principal]);

  const initials =
    draft.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??';

  const label = (list: PrincipalOption[], id: string) => optionById(list, id)?.label ?? '—';

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
          Paddock Credentials
        </div>
        <h2 className="mt-1 text-xl font-bold text-neutral-100">Register your Team Principal</h2>
        <p className="text-sm text-neutral-400">
          Your dossier for <span className="text-neutral-200">{teamName}</span>. Your background and
          style shape how the team performs.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT — credential card */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-neutral-700 bg-gradient-to-b from-neutral-900 to-neutral-950">
            <div
              className="flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-950"
              style={{ backgroundColor: teamColor ?? '#f59e0b' }}
            >
              <span>FIA Paddock ID</span>
              <span>Principal</span>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-2xl font-black text-neutral-200">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-neutral-100">
                  {draft.name.trim() || 'Unnamed Principal'}
                </div>
                <div className="text-xs text-amber-400">{teamName}</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {draft.nationality ?? '—'} · Age {draft.age ?? '—'}
                </div>
              </div>
            </div>
            <dl className="space-y-1.5 border-t border-neutral-800 px-4 py-3 text-xs">
              <CardRow label="Background" value={label(BACKGROUNDS, draft.background)} />
              <CardRow label="Management" value={label(MANAGEMENT_STYLES, draft.managementStyle)} />
              <CardRow label="Strength" value={label(STRENGTHS, draft.primaryStrength)} />
              <CardRow label="Weakness" value={label(STRENGTHS, draft.weakness)} tone="warn" />
              <CardRow label="Media" value={label(MEDIA_PERSONALITIES, draft.mediaPersonality)} />
            </dl>
            <div className="grid grid-cols-3 gap-px border-t border-neutral-800 bg-neutral-800 text-center">
              <Pip label="Rep" value={principal.reputation} />
              <Pip label="Strat" value={principal.raceStrategy} />
              <Pip label="Risk" value={principal.riskTolerance} />
            </div>
          </div>
        </div>

        {/* CENTER — profile + identity */}
        <div className="space-y-3 lg:col-span-5">
          <Section title="Profile">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Alex Carter"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-amber-500"
                />
              </Field>
              <Field label="Nationality">
                <Select value={draft.nationality ?? ''} onChange={(v) => set('nationality', v)}>
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Age — ${draft.age}`}>
                <input
                  type="range"
                  min={28}
                  max={70}
                  value={draft.age ?? 42}
                  onChange={(e) => set('age', Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </Field>
            </div>
          </Section>

          <Section title="Background">
            <OptionGrid
              options={BACKGROUNDS}
              selected={draft.background}
              onSelect={(id) => set('background', id)}
            />
          </Section>

          <Section title="Management Style">
            <OptionGrid
              options={MANAGEMENT_STYLES}
              selected={draft.managementStyle}
              onSelect={(id) => set('managementStyle', id)}
            />
          </Section>

          <Section title="Strengths & Weakness">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Primary Strength">
                <OptionSelect list={STRENGTHS} value={draft.primaryStrength} onChange={(v) => set('primaryStrength', v)} />
              </Field>
              <Field label="Secondary Strength">
                <OptionSelect list={STRENGTHS} value={draft.secondaryStrength} onChange={(v) => set('secondaryStrength', v)} />
              </Field>
              <Field label="Weakness">
                <OptionSelect list={STRENGTHS} value={draft.weakness} onChange={(v) => set('weakness', v)} />
              </Field>
            </div>
          </Section>
        </div>

        {/* RIGHT — philosophy */}
        <div className="space-y-3 lg:col-span-4">
          <Section title="Philosophy">
            <div className="space-y-3">
              <Field label="Management Philosophy">
                <OptionSelect list={MANAGEMENT_STYLES} value={draft.managementStyle} onChange={(v) => set('managementStyle', v)} />
              </Field>
              <Field label="Race Strategy Style">
                <OptionSelect list={RACE_STRATEGY_PHILOSOPHIES} value={draft.raceStrategyPhilosophy} onChange={(v) => set('raceStrategyPhilosophy', v)} />
              </Field>
              <Field label="Driver Management Style">
                <OptionSelect list={DRIVER_MANAGEMENT_STYLES} value={draft.driverManagementStyle} onChange={(v) => set('driverManagementStyle', v)} />
              </Field>
              <Field label="Development Philosophy">
                <OptionSelect list={DEVELOPMENT_PHILOSOPHIES} value={draft.developmentPhilosophy} onChange={(v) => set('developmentPhilosophy', v)} />
              </Field>
              <Field label="Media Personality">
                <OptionSelect list={MEDIA_PERSONALITIES} value={draft.mediaPersonality} onChange={(v) => set('mediaPersonality', v)} />
              </Field>
              <Field label="Risk Tolerance">
                <OptionSelect list={RISK_TOLERANCES} value={draft.riskTolerance} onChange={(v) => set('riskTolerance', v)} />
              </Field>
            </div>
          </Section>

          <Section title="Trait Profile">
            <div className="grid grid-cols-2 gap-2">
              <Trait label="Driver Mgmt" value={principal.driverManagement} />
              <Trait label="Development" value={principal.developmentFocus} />
              <Trait label="Race Strategy" value={principal.raceStrategy} />
              <Trait label="Commercial" value={principal.commercialSkill} />
              <Trait label="Political" value={principal.politicalSkill} />
              <Trait label="Risk" value={principal.riskTolerance} />
            </div>
          </Section>
        </div>
      </div>

      {/* BOTTOM — summary + modifiers + confirm */}
      <Section title="Final Profile & Gameplay Modifiers">
        <div className="grid gap-4 md:grid-cols-2">
          <p className="text-sm text-neutral-300">
            <span className="font-semibold text-neutral-100">
              {draft.name.trim() || 'Your principal'}
            </span>{' '}
            — a {label(BACKGROUNDS, draft.background).toLowerCase()} running {teamName} as a{' '}
            {label(MANAGEMENT_STYLES, draft.managementStyle).toLowerCase()}. Strongest in{' '}
            {label(STRENGTHS, draft.primaryStrength).toLowerCase()}, weakest in{' '}
            {label(STRENGTHS, draft.weakness).toLowerCase()}.
          </p>
          <div className="flex flex-wrap content-start gap-1.5">
            {Object.keys(modifiers).length === 0 ? (
              <span className="text-xs text-neutral-500">No net modifiers from these choices.</span>
            ) : (
              (Object.keys(modifiers) as PrincipalModifierKey[])
                .sort((a, b) => Math.abs(modifiers[b] ?? 0) - Math.abs(modifiers[a] ?? 0))
                .map((key) => {
                  const v = modifiers[key] ?? 0;
                  const pct = `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
                  return (
                    <span
                      key={key}
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        v >= 0
                          ? 'bg-green-500/15 text-green-300'
                          : 'bg-red-500/15 text-red-300'
                      }`}
                    >
                      {MODIFIER_LABELS[key]} {pct}
                    </span>
                  );
                })
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <Button variant="primary" disabled={!draft.name.trim()} onClick={() => onConfirm(principal)}>
            {draft.name.trim() ? `${confirmLabel} →` : 'Name your principal'}
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-amber-500"
    >
      {children}
    </select>
  );
}

function OptionSelect({
  list,
  value,
  onChange,
}: {
  list: { id: string; label: string; description?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const desc = list.find((o) => o.id === value)?.description;
  return (
    <div>
      <Select value={value} onChange={onChange}>
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      {desc && <p className="mt-1 text-[11px] text-neutral-500">{desc}</p>}
    </div>
  );
}

function OptionGrid({
  options,
  selected,
  onSelect,
}: {
  options: PrincipalOption[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => {
        const active = o.id === selected;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            title={o.description}
            className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
              active
                ? 'border-amber-500 bg-amber-500/10 text-neutral-100'
                : 'border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:border-neutral-600'
            }`}
          >
            <div className="font-semibold">{o.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function CardRow({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`truncate font-medium ${tone === 'warn' ? 'text-amber-300' : 'text-neutral-200'}`}>
        {value}
      </dd>
    </div>
  );
}

function Pip({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-950 py-2">
      <div className="text-sm font-bold text-neutral-100">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

function Trait({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-400">{label}</span>
        <span className="text-xs font-bold text-neutral-100">{value}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-amber-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
