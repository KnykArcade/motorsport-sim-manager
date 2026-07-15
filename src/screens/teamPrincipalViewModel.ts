import type { JobOffer } from '../types/principalTypes';

export type PrincipalCommandTab = 'standing' | 'identity' | 'culture' | 'departments' | 'career';

export const PRINCIPAL_COMMAND_TABS: Array<{ id: PrincipalCommandTab; label: string; description: string }> = [
  { id: 'standing', label: 'Standing', description: 'Contract, security, and management attributes' },
  { id: 'identity', label: 'Identity', description: 'Leadership style and defining decisions' },
  { id: 'culture', label: 'Culture', description: 'The working environment shaped by your leadership' },
  { id: 'departments', label: 'Departments', description: 'Trust, alignment, and morale around the team' },
  { id: 'career', label: 'Career & Offers', description: 'Career record and rival opportunities' },
];

export const PRINCIPAL_OFFERS_PER_PAGE = 3;

export function principalJobOfferPage(offers: JobOffer[], page: number): JobOffer[] {
  const lastPage = Math.max(0, Math.ceil(offers.length / PRINCIPAL_OFFERS_PER_PAGE) - 1);
  const safePage = Math.max(0, Math.min(lastPage, page));
  return offers.slice(safePage * PRINCIPAL_OFFERS_PER_PAGE, (safePage + 1) * PRINCIPAL_OFFERS_PER_PAGE);
}
