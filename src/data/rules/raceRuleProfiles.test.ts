import { describe, expect, it } from 'vitest';
import { selectRaceRuleProfile } from './raceRuleProfiles';
import type { Track } from '../../types/gameTypes';

function track(name: string, archetype: string): Track {
  return {
    id: name.toLowerCase().replaceAll(' ', '-'), name, gpName: name, archetype,
    attributes: { corners: 5, braking: 5, straights: 5, tractionAcceleration: 5, elevationBlindCorners: 5, technical: 5, overtakingRacecraft: 5, surfaceGripBumpiness: 5, riskWallProximity: 5, enduranceConsistency: 5 },
    setupProfile: { primarySetupProfile: archetype, downforceLevel: 'Medium', topSpeedEmphasis: 5, mechanicalGripEmphasis: 5, brakeDemand: 5, reliabilityRiskFocus: 5, strategyNotes: '', aeroDemand: 5, powerDemand: 5, mechanicalDemand: 5, riskDemand: 5 },
    ratingNotes: '',
  };
}

describe('race rule profiles', () => {
  it('selects NASCAR stage-era rules only for applicable years', () => {
    expect(selectRaceRuleProfile('NASCAR', 2010).raceControl.stageRacing).toBe(false);
    expect(selectRaceRuleProfile('NASCAR', 2026).raceControl.stageRacing).toBe(true);
  });

  it('does not apply the NASCAR free-pass rule before 2003', () => {
    expect(selectRaceRuleProfile('NASCAR', 2002).pitLane.luckyDog).toBe(false);
    expect(selectRaceRuleProfile('NASCAR', 2003).pitLane.luckyDog).toBe(true);
  });

  it('does not apply modern F1 DRS to the 1990s', () => {
    expect(selectRaceRuleProfile('F1', 1995).overtakingAids.drs).toBe(false);
    expect(selectRaceRuleProfile('F1', 2026).overtakingAids.drs).toBe(true);
  });

  it('applies parc ferme only to F1 eras where setup locks are modelled', () => {
    expect(selectRaceRuleProfile('F1', 1995).setupLock.mode).toBe('Unrestricted');
    expect(selectRaceRuleProfile('F1', 2003).setupLock.mode).toBe('ParcFerme');
    expect(selectRaceRuleProfile('F1', 2026).setupLock.mode).toBe('ParcFerme');
  });

  it('keeps historical CART open while modelling modern IndyCar and NASCAR restrictions', () => {
    expect(selectRaceRuleProfile('IndyCar', 2023, track('Road America', 'Road Circuit')).setupLock.mode).toBe('Unrestricted');
    expect(selectRaceRuleProfile('IndyCar', 2026, track('Road America', 'Road Circuit')).setupLock.mode).toBe('PostQualifyingLimited');
    expect(selectRaceRuleProfile('IndyCar', 2026, track('Iowa Speedway', 'Short Oval')).setupLock.mode).toBe('Impound');
    expect(selectRaceRuleProfile('CART', 1995).setupLock.mode).toBe('Unrestricted');
    expect(selectRaceRuleProfile('NASCAR', 2005).setupLock.mode).toBe('Impound');
    expect(selectRaceRuleProfile('NASCAR', 2026).setupLock.mode).toBe('PostQualifyingLimited');
  });

  it('records an official source and confidence on every setup profile', () => {
    for (const [series, year] of [['F1', 1995], ['F1', 2026], ['NASCAR', 2005], ['NASCAR', 2026], ['IndyCar', 2026], ['CART', 1995], ['Champ Car', 2006]] as const) {
      const source = selectRaceRuleProfile(series, year).setupLock.source;
      expect(source.title.length).toBeGreaterThan(0);
      expect(source.url).toMatch(/^https:\/\//);
      expect(['Official', 'High', 'Medium', 'GameplayFallback']).toContain(source.confidence);
    }
  });

  it('applies documented event overrides without leaking them to unrelated tracks', () => {
    const indy = selectRaceRuleProfile('IndyCar', 2022, track('Indianapolis Motor Speedway', 'Superspeedway'));
    const iowa = selectRaceRuleProfile('IndyCar', 2022, track('Iowa Speedway', 'Short Oval'));
    const road = selectRaceRuleProfile('IndyCar', 2022, track('Road America', 'Road Circuit'));
    const michigan = selectRaceRuleProfile('NASCAR', 2015, track('Michigan International Speedway', 'Speedway'));

    expect(indy.setupLock.mode).toBe('Impound');
    expect(iowa.setupLock.label).toContain('Iowa');
    expect(road.setupLock.mode).toBe('Unrestricted');
    expect(michigan.id).toContain('single-car-impound');
  });

  it('supports event bulletins with or without an INDYCAR road-course work window', () => {
    const circuit = track('Road America', 'Road Circuit');
    const withWork = selectRaceRuleProfile('IndyCar', 2026, circuit, 'IndyCarRoadWorkWindow');
    const withoutWork = selectRaceRuleProfile('IndyCar', 2026, circuit, 'IndyCarRoadNoWork');

    expect(withWork.setupLock.authorizedWorkWindow).toBe('FullSetup');
    expect(withoutWork.setupLock.authorizedWorkWindow).toBe('Limited');
    expect(withoutWork.setupLock.allowedPostQualifyingChanges).toEqual(['frontWing', 'tyreUsage']);
  });

  it('uses series-specific caution cadence without retroactive leakage', () => {
    const historicalF1 = selectRaceRuleProfile('F1', 1995).raceControl;
    const modernNascar = selectRaceRuleProfile('NASCAR', 2026).raceControl;
    expect(historicalF1.cautionFrequencyMultiplier).toBeLessThan(modernNascar.cautionFrequencyMultiplier);
    expect(historicalF1.minimumGreenLapsBetweenCautions).toBeGreaterThan(modernNascar.minimumGreenLapsBetweenCautions);
  });
});
