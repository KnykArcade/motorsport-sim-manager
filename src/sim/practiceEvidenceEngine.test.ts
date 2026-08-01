import { describe, expect, it } from 'vitest';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { emptyKnowledge } from './practiceProgramEngine';
import {
  applyEvidenceRelevance,
  conditionEvidenceRelevance,
  evidenceConfidence,
  resolvePracticeRevision,
  setupChangeMagnitude,
  setupEvidenceRelevance,
  setupVerificationStatus,
} from './practiceEvidenceEngine';

describe('practice evidence relevance', () => {
  it('preserves small setup-change evidence and makes major changes stale', () => {
    const small = { ...BALANCED_SETUP, frontWing: BALANCED_SETUP.frontWing + 0.5 };
    const major = Object.fromEntries(
      Object.entries(BALANCED_SETUP).map(([key, value]) => [key, Math.min(10, value + 4)]),
    ) as typeof BALANCED_SETUP;

    const smallChange = setupChangeMagnitude(BALANCED_SETUP, small);
    const majorChange = setupChangeMagnitude(BALANCED_SETUP, major);
    expect(smallChange).toBeLessThan(majorChange);
    expect(setupEvidenceRelevance(smallChange)).toBeGreaterThan(setupEvidenceRelevance(majorChange));
    expect(setupEvidenceRelevance(majorChange)).toBeLessThan(0.7);
  });

  it('reduces comparison confidence when conditions switch between dry and wet', () => {
    const dry = { label: 'Dry', wet: false, gripLevel: 1 };
    const wet = { label: 'Light Rain', wet: true, gripLevel: 0.72 };
    expect(conditionEvidenceRelevance(dry, dry)).toBe(1);
    expect(conditionEvidenceRelevance(dry, wet)).toBeLessThan(0.5);
  });

  it('decays only the affected driver and weights each knowledge axis differently', () => {
    const knowledge = emptyKnowledge('race-1');
    knowledge.setupKnowledge.a = 0.8;
    knowledge.tireKnowledge.a = 0.8;
    knowledge.reliabilityKnowledge.a = 0.8;
    knowledge.setupKnowledge.b = 0.6;

    const next = applyEvidenceRelevance(knowledge, 'a', 0.5, 0.8);
    expect(next.setupKnowledge.a).toBeLessThan(next.tireKnowledge.a);
    expect(next.tireKnowledge.a).toBeLessThan(next.reliabilityKnowledge.a);
    expect(next.setupKnowledge.b).toBe(0.6);
  });
});

describe('practice setup revisions', () => {
  it('reuses an unchanged tested revision and creates an immutable revision after a change', () => {
    const first = resolvePracticeRevision({
      driverId: 'driver-a',
      sessionId: 'p1-run-1',
      setup: BALANCED_SETUP,
      revisions: undefined,
    });
    const same = resolvePracticeRevision({
      driverId: 'driver-a',
      sessionId: 'p1-run-2',
      setup: { ...BALANCED_SETUP },
      revisions: [first.revision],
    });
    const changed = resolvePracticeRevision({
      driverId: 'driver-a',
      sessionId: 'p1-run-3',
      setup: { ...BALANCED_SETUP, frontWing: 9, rearWing: 9 },
      revisions: [first.revision],
    });

    expect(same.created).toBe(false);
    expect(same.revision.id).toBe(first.revision.id);
    expect(changed.created).toBe(true);
    expect(changed.revision.sequence).toBe(2);
    expect(changed.revision.setup).not.toBe(first.revision.setup);
    expect(setupVerificationStatus(changed.revision.setup, [first.revision, changed.revision])).toBe('Verified');
    expect(setupVerificationStatus(BALANCED_SETUP, [first.revision, changed.revision])).toBe('Untested');
  });

  it('maps evidence quality to clear confidence bands', () => {
    expect(evidenceConfidence(0.2)).toBe('Low');
    expect(evidenceConfidence(0.55)).toBe('Medium');
    expect(evidenceConfidence(0.9)).toBe('High');
  });
});
