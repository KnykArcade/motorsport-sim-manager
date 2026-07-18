import type { EngineOffer } from '../sim/engineSupplierEngine';

export type EngineWorkspaceTab = 'package' | 'manufacturer' | 'market';

export const ENGINE_WORKSPACE_TABS: ReadonlyArray<{
  id: EngineWorkspaceTab;
  label: string;
}> = [
  { id: 'package', label: 'Current Package' },
  { id: 'manufacturer', label: 'Manufacturer' },
  { id: 'market', label: 'Supplier Market' },
];

export type EngineSupplierOfferGroup = {
  supplierName: string;
  offers: EngineOffer[];
};

export function groupEngineOffers(offers: EngineOffer[]): EngineSupplierOfferGroup[] {
  const grouped = new Map<string, EngineOffer[]>();
  for (const offer of offers) {
    grouped.set(offer.supplier.name, [...(grouped.get(offer.supplier.name) ?? []), offer]);
  }
  return [...grouped.entries()].map(([supplierName, supplierOffers]) => ({
    supplierName,
    offers: supplierOffers,
  }));
}

export function engineCashMovementNow(switchFee: number, pendingFeeRefund: number): number {
  return Math.round((pendingFeeRefund - switchFee) * 100) / 100;
}
