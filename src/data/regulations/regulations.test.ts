import { describe, it, expect } from 'vitest';
import { regulationSets, getRegulationSet } from './regulations';
import { seasonBundles, getSeasonBundle } from '../seasonData';
import { createNewGame } from '../../game/initialCareer';

describe('Regulation Sets', () => {
  describe('regulation set definitions', () => {
    it('F1 1990 does not use the universal reg-1995 placeholder', () => {
      const bundle = getSeasonBundle(1990, 'F1');
      expect(bundle).toBeDefined();
      expect(bundle!.season.regulationSetId).not.toBe('reg-1995');
      expect(bundle!.season.regulationSetId).toBe('reg-f1-1990-1993');
    });

    it('F1 2005 uses a distinct regulation set from F1 2010', () => {
      const bundle2005 = getSeasonBundle(2005, 'F1');
      const bundle2010 = getSeasonBundle(2010, 'F1');
      expect(bundle2005!.season.regulationSetId).not.toBe(bundle2010!.season.regulationSetId);
    });

    it('F1 2010 has refueling banned', () => {
      const bundle = getSeasonBundle(2010, 'F1');
      const reg = getRegulationSet(bundle!.season.regulationSetId);
      expect(reg).toBeDefined();
      expect(reg!.refuelingAllowed).toBe(false);
    });

    it('F1 2011 or later has DRS enabled', () => {
      const bundle = getSeasonBundle(2011, 'F1');
      const reg = getRegulationSet(bundle!.season.regulationSetId);
      expect(reg).toBeDefined();
      expect(reg!.drsEnabled).toBe(true);
    });

    it('F1 2006 uses knockout qualifying', () => {
      const bundle = getSeasonBundle(2006, 'F1');
      const reg = getRegulationSet(bundle!.season.regulationSetId);
      expect(reg).toBeDefined();
      expect(reg!.qualifyingFormat).toContain('Knockout');
    });

    it('F1 2003/2004/2005 do not use the same generic traditional qualifying', () => {
      const reg2003 = getRegulationSet(getSeasonBundle(2003, 'F1')!.season.regulationSetId);
      const reg2004 = getRegulationSet(getSeasonBundle(2004, 'F1')!.season.regulationSetId);
      const reg2005 = getRegulationSet(getSeasonBundle(2005, 'F1')!.season.regulationSetId);
      expect(reg2003!.qualifyingFormat).toContain('One-shot');
      expect(reg2004!.qualifyingFormat).toContain('One-shot');
      expect(reg2005!.qualifyingFormat).toContain('Aggregate');
      // None should say "Traditional"
      expect(reg2003!.qualifyingFormat).not.toContain('Traditional');
      expect(reg2005!.qualifyingFormat).not.toContain('Traditional');
    });

    it('IndyCar seasons use IndyCar regulation sets, not F1', () => {
      for (let y = 2008; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        expect(bundle).toBeDefined();
        const reg = getRegulationSet(bundle!.season.regulationSetId);
        expect(reg, `IndyCar ${y} regulation set not found`).toBeDefined();
        expect(reg!.series).toBe('IndyCar');
      }
    });

    it('every playable season bundle has a valid regulation set ID', () => {
      for (const [key, bundle] of Object.entries(seasonBundles)) {
        const regId = bundle.season.regulationSetId;
        expect(regId, `${key} has no regulationSetId`).toBeDefined();
        expect(regulationSets[regId], `${key} references missing regulation set ${regId}`).toBeDefined();
      }
    });

    it('no playable season bundle references a missing regulation set', () => {
      for (const [key, bundle] of Object.entries(seasonBundles)) {
        const regId = bundle.season.regulationSetId;
        expect(regulationSets[regId], `${key} references missing regulation set ${regId}`).toBeTruthy();
      }
    });

    it('Single Season Mode loads the selected season regulation set', () => {
      const state = createNewGame({
        gameMode: 'SingleSeason',
        seasonYear: 2005,
        series: 'F1',
        teamId: 't-ferrari',
        seed: 'test-reg',
      });
      const reg = getRegulationSet(state.regulationSetId);
      expect(reg).toBeDefined();
      expect(reg!.id).toBe('reg-f1-2005');
      expect(reg!.refuelingAllowed).toBe(true);
      expect(reg!.tireChangeRules).toContain('No tire changes');
    });

    it('F1 1994 has refueling allowed (era change from 1990-1993)', () => {
      const reg1994 = getRegulationSet(getSeasonBundle(1994, 'F1')!.season.regulationSetId);
      const reg1993 = getRegulationSet(getSeasonBundle(1993, 'F1')!.season.regulationSetId);
      expect(reg1994!.refuelingAllowed).toBe(true);
      expect(reg1993!.refuelingAllowed).toBe(false);
    });

    it('F1 2021 has sprint support', () => {
      const reg = getRegulationSet(getSeasonBundle(2021, 'F1')!.season.regulationSetId);
      expect(reg!.sprintSupport).toBe(true);
    });

    it('F1 2020 does not have sprint support', () => {
      const reg = getRegulationSet(getSeasonBundle(2020, 'F1')!.season.regulationSetId);
      expect(reg!.sprintSupport).toBe(false);
    });

    it('IndyCar has push-to-pass, no DRS', () => {
      const reg = getRegulationSet(getSeasonBundle(2015, 'IndyCar')!.season.regulationSetId);
      expect(reg!.pushToPass).toBe(true);
      expect(reg!.drsEnabled).toBe(false);
    });

    it('F1 2005 has restricted tire changes', () => {
      const reg = getRegulationSet(getSeasonBundle(2005, 'F1')!.season.regulationSetId);
      expect(reg!.tireChangeRules).toContain('No tire changes');
    });

    it('F1 2026 has its own distinct regulation set', () => {
      const reg2026 = getRegulationSet(getSeasonBundle(2026, 'F1')!.season.regulationSetId);
      const reg2025 = getRegulationSet(getSeasonBundle(2025, 'F1')!.season.regulationSetId);
      expect(reg2026!.id).toBe('reg-f1-2026');
      expect(reg2026!.id).not.toBe(reg2025!.id);
    });
  });
});
