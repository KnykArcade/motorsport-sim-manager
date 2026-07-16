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

export const ENGINE_SUPPLIER_PAGE_SIZE = 3;

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

export function engineSupplierPageCount(totalSuppliers: number): number {
  return Math.max(1, Math.ceil(totalSuppliers / ENGINE_SUPPLIER_PAGE_SIZE));
}

export function engineSupplierPage(
  suppliers: EngineSupplierOfferGroup[],
  requestedPage: number,
): EngineSupplierOfferGroup[] {
  const pageCount = engineSupplierPageCount(suppliers.length);
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  const start = page * ENGINE_SUPPLIER_PAGE_SIZE;
  return suppliers.slice(start, start + ENGINE_SUPPLIER_PAGE_SIZE);
}

export function engineCashMovementNow(switchFee: number, pendingFeeRefund: number): number {
  return Math.round((pendingFeeRefund - switchFee) * 100) / 100;
}
