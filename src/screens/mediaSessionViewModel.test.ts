import { describe, expect, it } from 'vitest';
import type { MediaSession } from '../types/mediaTypes';
import {
  MEDIA_RESPONSE_STYLES,
  mediaSessionProgress,
  mediaSessionTypeLabel,
  mediaSessionUrgency,
} from './mediaSessionViewModel';

const session = (overrides: Partial<MediaSession> = {}): MediaSession => ({
  id: 'media-1',
  type: 'PreRace',
  seasonYear: 1995,
  round: 1,
  title: 'Pre-race press conference',
  trigger: 'Race weekend',
  status: 'Pending',
  questions: [
    { id: 'q1', topic: 'Performance', prompt: 'Question one', context: 'Evidence one' },
    { id: 'q2', topic: 'DriverSupport', prompt: 'Question two', context: 'Evidence two' },
  ],
  answers: [],
  ...overrides,
});

describe('media session view model', () => {
  it('presents all approved response styles with descriptive guidance', () => {
    expect(MEDIA_RESPONSE_STYLES.map((style) => style.id)).toEqual([
      'Diplomatic',
      'Protective',
      'Demanding',
      'Confrontational',
      'Evasive',
    ]);
    expect(MEDIA_RESPONSE_STYLES.every((style) => !style.guidance.match(/[+-]\d|%/))).toBe(true);
  });

  it('summarizes progress without exposing hidden relationship values', () => {
    expect(mediaSessionProgress(session())).toBe('0/2 answered');
    expect(mediaSessionProgress(session({ status: 'Completed' }))).toBe('Complete');
    expect(mediaSessionProgress(session({ status: 'Declined' }))).toBe('Declined');
  });

  it('marks crisis work as critical while routine media remains recommended and optional', () => {
    expect(mediaSessionUrgency(session())).toBe('recommended');
    expect(mediaSessionUrgency(session({ type: 'Crisis' }))).toBe('critical');
    expect(mediaSessionTypeLabel('PostQualifying')).toBe('Post-qualifying');
  });
});
