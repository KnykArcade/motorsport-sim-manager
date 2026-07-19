import { ANNUAL_TPP_ALLOCATION, INITIAL_TPP_BALANCE } from '../../sim/rdEngine';

// Compact popover explaining the TPP currency: how it is earned and what it
// buys. Rendered in panel action slots next to the cash/TPP readouts.
export function TppExplainer() {
  return (
    <details className="relative text-xs text-neutral-500">
      <summary className="cursor-pointer select-none hover:text-neutral-300">
        Cash = operations · TPP = long-term research currency <span className="underline decoration-dotted">what is TPP?</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left leading-5 shadow-xl">
        <div className="font-semibold text-neutral-200">Team Principal Points (TPP)</div>
        <div className="mt-1 text-neutral-400">
          Your leadership capital for steering long-term research. You cannot buy it with cash.
        </div>
        <div className="mt-2 font-semibold text-neutral-300">How you earn it</div>
        <ul className="ml-4 list-disc text-neutral-400">
          <li>{INITIAL_TPP_BALANCE} TPP when you take charge of a team</li>
          <li>{ANNUAL_TPP_ALLOCATION} TPP leadership allocation at the start of each season</li>
        </ul>
        <div className="mt-2 font-semibold text-neutral-300">What it buys</div>
        <ul className="ml-4 list-disc text-neutral-400">
          <li>Starting R&amp;D research nodes (alongside their cash cost) — higher tiers cost more TPP</li>
        </ul>
        <div className="mt-2 text-neutral-500">
          Every earn and spend is listed in the TPP ledger under Development → History.
        </div>
      </div>
    </details>
  );
}
