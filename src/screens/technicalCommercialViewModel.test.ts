import { describe, expect, it } from 'vitest';
import {
  facilityUpgradeDisabledReason,
  financeCoverageLabel,
  regulationVotingStatus,
  selectedNamedRecord,
  selectedTechnicalRecord,
  technicalActionDisabledReason,
  technicalSectionFromQuery,
} from './technicalCommercialViewModel';

describe('technical and commercial workspace view model', () => {
  it('preserves valid technical query navigation and falls back to command', () => {
    expect(technicalSectionFromQuery('development')).toBe('development');
    expect(technicalSectionFromQuery('engine')).toBe('engine');
    expect(technicalSectionFromQuery('unknown')).toBe('command');
    expect(technicalSectionFromQuery(null)).toBe('command');
  });

  it('keeps selected records visible before preferred and first fallbacks', () => {
    const records = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
    expect(selectedTechnicalRecord(records, 'two', 'three')).toBe(records[1]);
    expect(selectedTechnicalRecord(records, 'missing', 'three')).toBe(records[2]);
    expect(selectedTechnicalRecord(records, 'missing', 'missing')).toBe(records[0]);
    expect(selectedTechnicalRecord([], 'one')).toBeUndefined();
  });

  it('selects supplier-style named records with a stable fallback', () => {
    const records = [{ name: 'Atlas' }, { name: 'Velocity' }];
    expect(selectedNamedRecord(records, 'Velocity')).toBe(records[1]);
    expect(selectedNamedRecord(records, 'Missing')).toBe(records[0]);
    expect(selectedNamedRecord([], 'Atlas')).toBeUndefined();
  });

  it('reports the first real technical action blocker', () => {
    expect(technicalActionDisabledReason({ modeAllowed: false, capacityFull: true })).toContain('game mode');
    expect(technicalActionDisabledReason({ capacityFull: true })).toContain('capacity');
    expect(technicalActionDisabledReason({ cashAvailable: 5, cashCost: 10 })).toContain('cash');
    expect(technicalActionDisabledReason({ cashAvailable: 10, cashCost: 5, tppAvailable: 1, tppCost: 2 })).toContain('TPP');
    expect(technicalActionDisabledReason({ cashAvailable: 10, cashCost: 5, tppAvailable: 2, tppCost: 2 })).toBeUndefined();
  });

  it('reports facility eligibility without changing upgrade rules', () => {
    expect(facilityUpgradeDisabledReason({ maxed: true, pending: false, affordable: true })).toContain('maximum');
    expect(facilityUpgradeDisabledReason({ maxed: false, pending: true, affordable: true })).toContain('construction');
    expect(facilityUpgradeDisabledReason({ maxed: false, pending: false, affordable: false })).toContain('afford');
    expect(facilityUpgradeDisabledReason({ maxed: false, pending: false, affordable: true })).toBeUndefined();
  });

  it('summarizes finance coverage and regulation voting state', () => {
    expect(financeCoverageLabel(null)).toBe('No recurring commitments');
    expect(financeCoverageLabel(0.8)).toBe('Commitments exceed cash');
    expect(financeCoverageLabel(1.2)).toBe('Limited cash headroom');
    expect(financeCoverageLabel(2)).toBe('Commitments covered');
    expect(regulationVotingStatus(true, 2, 8)).toContain('round 8');
    expect(regulationVotingStatus(false, 2, 8)).toContain('2 proposals');
    expect(regulationVotingStatus(false, 0, 8)).toContain('recorded vote');
  });
});
