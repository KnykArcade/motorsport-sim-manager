import type { MediaResponseStyle, MediaSession, MediaSessionType } from '../types/mediaTypes';

export const MEDIA_RESPONSE_STYLES: ReadonlyArray<{
  id: MediaResponseStyle;
  label: string;
  guidance: string;
}> = [
  { id: 'Diplomatic', label: 'Diplomatic', guidance: 'Protect relationships and keep the temperature down.' },
  { id: 'Protective', label: 'Protective', guidance: 'Back drivers and staff, accepting more responsibility yourself.' },
  { id: 'Demanding', label: 'Demanding', guidance: 'Set public standards that ownership may like but the garage may resent.' },
  { id: 'Confrontational', label: 'Confrontational', guidance: 'Create headlines and pressure rivals at greater commercial risk.' },
  { id: 'Evasive', label: 'Evasive', guidance: 'Avoid a direct commitment while risking press and board frustration.' },
];

export function mediaSessionTypeLabel(type: MediaSessionType): string {
  switch (type) {
    case 'Preseason': return 'Preseason';
    case 'PreRace': return 'Pre-race';
    case 'PostQualifying': return 'Post-qualifying';
    case 'PostRace': return 'Post-race';
    case 'Crisis': return 'Crisis';
  }
}

export function mediaSessionProgress(session: MediaSession): string {
  if (session.status === 'Declined') return 'Declined';
  if (session.status === 'Completed') return 'Complete';
  return `${session.answers.length}/${session.questions.length} answered`;
}

export function mediaSessionUrgency(session: MediaSession): 'critical' | 'recommended' | 'complete' {
  if (session.status !== 'Pending') return 'complete';
  return session.type === 'Crisis' ? 'critical' : 'recommended';
}
