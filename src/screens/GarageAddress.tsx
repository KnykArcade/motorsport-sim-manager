import { useState } from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import type { GameState } from '../game/careerState';
import {
  GARAGE_ADDRESS_OPTIONS,
  previewGarageAddress,
  recommendedGarageAddress,
} from '../sim/garageLeadershipEngine';
import type {
  GarageAddressRecord,
  GarageAddressTone,
  GarageFollowUpType,
} from '../types/weekendLeadershipTypes';

export function GarageAddress({
  state,
  raceId,
  record,
  onDeliver,
  onFollowUp,
  onStartRace,
}: {
  state: GameState;
  raceId: string;
  record?: GarageAddressRecord;
  onDeliver: (tone: GarageAddressTone, delegated?: boolean) => void;
  onFollowUp: (driverId: string, type: GarageFollowUpType) => void;
  onStartRace: () => void;
}) {
  const recommendation = recommendedGarageAddress(state, raceId);
  const [selectedTone, setSelectedTone] = useState<GarageAddressTone>(recommendation.tone);
  const preview = previewGarageAddress(state, raceId, selectedTone);
  const selected = GARAGE_ADDRESS_OPTIONS.find((option) => option.id === selectedTone)!;
  const driverName = (driverId: string) =>
    state.drivers.find((driver) => driver.id === driverId)?.name ?? driverId;

  return (
    <div className="space-y-4">
      <Panel
        title="Garage Address"
        actions={record ? (
          <Button variant="primary" onClick={onStartRace}>Start Live Race →</Button>
        ) : undefined}
      >
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <p className="text-sm text-neutral-300">
              Choose one message for the whole garage. Its race effect is deliberately small,
              applies only to this race, and cannot be repeated.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Driver trust can move by at most one point from the team message. One optional
              individual follow-up is available after delivery.
            </p>
          </div>
          <div className="rounded border border-sky-500/25 bg-sky-500/5 p-3 text-xs">
            <div className="font-semibold uppercase tracking-wide text-sky-300">Assistant recommendation</div>
            <div className="mt-1 font-semibold text-neutral-100">
              {GARAGE_ADDRESS_OPTIONS.find((option) => option.id === recommendation.tone)?.label}
            </div>
            <p className="mt-1 text-neutral-400">{recommendation.reason}</p>
          </div>
        </div>
      </Panel>

      {!record && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {GARAGE_ADDRESS_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedTone(option.id)}
                className={`rounded-lg border p-4 text-left ${selectedTone === option.id ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 bg-neutral-950/35 hover:border-neutral-600'}`}
              >
                <div className="text-sm font-semibold text-neutral-100">{option.label}</div>
                <p className="mt-1 text-xs leading-5 text-neutral-400">{option.message}</p>
                <div className="mt-3 text-[11px] text-emerald-300">Best use: {option.bestUse}</div>
                <div className="mt-1 text-[11px] text-orange-300">Risk: {option.risk}</div>
              </button>
            ))}
          </div>

          <Panel title={`Reaction Preview · ${selected.label}`}>
            <div className="grid gap-3 md:grid-cols-2">
              {preview.map((reaction) => (
                <div key={reaction.driverId} className="rounded border border-neutral-800 bg-neutral-950/35 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-neutral-100">{driverName(reaction.driverId)}</span>
                    <span className={reaction.fit > 0 ? 'text-emerald-300' : reaction.fit < 0 ? 'text-orange-300' : 'text-neutral-300'}>
                      {reaction.reaction}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">{reaction.reason}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <Effect label="Race pace" value={percent(reaction.performanceModifier)} />
                    <Effect label="Mistake risk" value={multiplier(reaction.mistakeRiskMultiplier)} />
                    <Effect label="Trust" value={signed(reaction.trustDelta)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => onDeliver(selectedTone)}>
                Deliver {selected.label}
              </Button>
              <Button onClick={() => onDeliver(recommendation.tone)}>
                Use assistant recommendation
              </Button>
              <Button variant="ghost" onClick={() => onDeliver(recommendation.tone, true)}>
                Delegate to assistant
              </Button>
              <Button variant="ghost" onClick={() => onDeliver('CalmExecute')}>
                Use neutral message
              </Button>
            </div>
          </Panel>
        </>
      )}

      {record && (
        <Panel title={`${record.messageLabel} · Delivered${record.delegated ? ' by assistant' : ''}`}>
          <p className="text-sm text-neutral-300">
            The message is locked for this race. The effects below are the only pre-race
            leadership modifiers that will reach the simulation.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {record.reactions.map((reaction) => (
              <div key={reaction.driverId} className="rounded border border-neutral-800 bg-neutral-950/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-neutral-100">{driverName(reaction.driverId)}</span>
                  <span className={reaction.fit > 0 ? 'text-emerald-300' : reaction.fit < 0 ? 'text-orange-300' : 'text-neutral-300'}>
                    {reaction.reaction}
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">{reaction.reason}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                  <Effect label="Race pace" value={percent(reaction.performanceModifier)} />
                  <Effect label="Mistake risk" value={multiplier(reaction.mistakeRiskMultiplier)} />
                  <Effect label="Trust" value={signed(reaction.trustDelta)} />
                </div>
                {!record.followUp && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={() => onFollowUp(reaction.driverId, 'Reassure')}>Reassure</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={() => onFollowUp(reaction.driverId, 'Challenge')}>Challenge</Button>
                    <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={() => onFollowUp(reaction.driverId, 'ClarifyPlan')}>Clarify plan</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {record.followUp && (
            <div className="mt-4 rounded border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-100">
              <strong>{record.followUp.label} · {driverName(record.followUp.driverId)}</strong>
              <p className="mt-1 text-sky-200/75">{record.followUp.reason} Trust {signed(record.followUp.trustDelta)}.</p>
            </div>
          )}
          {!record.followUp && (
            <p className="mt-3 text-xs text-neutral-500">
              Optional: choose one private follow-up above, or start the race without one.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

function Effect({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-neutral-900/70 px-2 py-1.5">
      <div className="uppercase text-neutral-600">{label}</div>
      <div className="mt-0.5 font-semibold text-neutral-300">{value}</div>
    </div>
  );
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function percent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function multiplier(value: number): string {
  const delta = (value - 1) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}
