// Team staff (Phase D). Specialists you hire to improve off-track operations.
// Costs are in $M (converted to dollars by the finance engine).

export type StaffRole =
  | 'Technical Director'
  | 'Race Engineer'
  | 'Pit Crew Chief'
  | 'Strategist';

export type StaffMember = {
  id: string;
  name: string;
  role: StaffRole;
  nationality: string;
  rating: number; // legacy 1-10 or generated 0-100; normalized by staffEngine
  salary: number; // $M / year
  signingFee: number; // $M one-off
  // Optional for save compatibility. Hired specialists receive a two-year
  // deal; older saves are migrated to the same default.
  contractYearsRemaining?: number;
  bio: string;
};

export const STAFF_ROLES: StaffRole[] = [
  'Technical Director',
  'Race Engineer',
  'Pit Crew Chief',
  'Strategist',
];

export const ROLE_EFFECT: Record<StaffRole, string> = {
  'Technical Director': 'Raises car development success rate.',
  'Race Engineer': 'Improves practice setup confidence.',
  'Pit Crew Chief': 'Sharpens pit-stop execution.',
  Strategist: 'Better in-race strategy calls.',
};
