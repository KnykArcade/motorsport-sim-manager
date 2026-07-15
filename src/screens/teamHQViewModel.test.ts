import { describe, expect, it } from 'vitest';
import { TEAM_HQ_TABS } from './teamHQViewModel';

describe('team HQ view model', () => {
  it('keeps every command-center section in a stable order', () => {
    expect(TEAM_HQ_TABS.map((tab) => tab.id)).toEqual([
      'race',
      'car',
      'organization',
      'personnel',
      'news',
      'standings',
    ]);
  });

  it('uses concise labels that fit the command bar', () => {
    expect(TEAM_HQ_TABS.map((tab) => tab.label)).toEqual([
      'Race Desk',
      'Car & Rules',
      'Organization',
      'Personnel',
      'Team News',
      'Standings',
    ]);
  });
});
