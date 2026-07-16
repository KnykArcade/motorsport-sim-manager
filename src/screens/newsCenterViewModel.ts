import type { NewsItem, NewsPriority } from '../types/gameTypes';

export type NewsStorylineStatus = 'Escalating' | 'Developing' | 'Ongoing';

export type NewsStoryline = {
  id: string;
  subjectId: string;
  subjectType: 'driver' | 'team';
  title: string;
  summary: string;
  status: NewsStorylineStatus;
  latestRound?: number;
  chapters: NewsItem[];
};

const PRIORITY_WEIGHT: Record<NewsPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

function newsTime(item: NewsItem): number {
  const parsed = Date.parse(item.timestamp);
  return Number.isFinite(parsed) ? parsed : item.round ?? 0;
}

function newestFirst(a: NewsItem, b: NewsItem): number {
  const timeDifference = newsTime(b) - newsTime(a);
  if (timeDifference !== 0) return timeDifference;
  const roundDifference = (b.round ?? -1) - (a.round ?? -1);
  if (roundDifference !== 0) return roundDifference;
  return b.id.localeCompare(a.id);
}

function storylineStatus(chapters: NewsItem[]): NewsStorylineStatus {
  const recent = chapters.slice(0, 2);
  if (recent.some((item) => (item.priority ?? 'normal') === 'critical')) return 'Escalating';
  if (recent.reduce((sum, item) => sum + PRIORITY_WEIGHT[item.priority ?? 'normal'], 0) >= 6) return 'Developing';
  return 'Ongoing';
}

function storylineSummary(subject: string, chapters: NewsItem[]): string {
  const categories = new Set(chapters.map((item) => item.category).filter(Boolean));
  if (categories.has('driver_market') && (categories.has('race_result') || categories.has('qualifying'))) {
    return `${subject}'s on-track form and market position are developing together across the season.`;
  }
  if (categories.has('financial') && (categories.has('development') || categories.has('ai_team'))) {
    return `${subject} is balancing competitive ambition against mounting financial and organizational pressure.`;
  }
  if (categories.has('race_result') && categories.has('qualifying')) {
    return `${subject}'s weekend performances are forming a sustained competitive trend.`;
  }
  if (categories.has('career_event') || categories.has('paddock')) {
    return `${subject} remains at the center of an evolving paddock story with consequences beyond one weekend.`;
  }
  return `${subject} has generated multiple connected developments worth following as one continuing story.`;
}

export function buildNewsStorylines(
  items: NewsItem[],
  teamNames: Record<string, string>,
  driverNames: Record<string, string>,
): NewsStoryline[] {
  const groups = new Map<string, { subjectId: string; subjectType: 'driver' | 'team'; chapters: NewsItem[] }>();
  const seenIds = new Set<string>();

  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    const subjectType = item.driverId ? 'driver' : item.teamId ? 'team' : undefined;
    const subjectId = item.driverId ?? item.teamId;
    if (!subjectType || !subjectId) continue;
    const key = `${subjectType}:${subjectId}`;
    const group = groups.get(key) ?? { subjectId, subjectType, chapters: [] };
    group.chapters.push(item);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.chapters.length >= 2)
    .map(([id, group]) => {
      const chapters = [...group.chapters].sort(newestFirst);
      const subject = group.subjectType === 'driver'
        ? driverNames[group.subjectId] ?? 'Unidentified driver'
        : teamNames[group.subjectId] ?? 'Unidentified team';
      return {
        id,
        subjectId: group.subjectId,
        subjectType: group.subjectType,
        title: `${subject}: ${chapters.length}-chapter storyline`,
        summary: storylineSummary(subject, chapters),
        status: storylineStatus(chapters),
        latestRound: chapters.find((item) => item.round != null)?.round,
        chapters,
      };
    })
    .sort((a, b) => {
      const priority = PRIORITY_WEIGHT[b.chapters[0].priority ?? 'normal'] - PRIORITY_WEIGHT[a.chapters[0].priority ?? 'normal'];
      if (priority !== 0) return priority;
      return newsTime(b.chapters[0]) - newsTime(a.chapters[0]);
    });
}

export function storylineChapterCounts(storylines: NewsStoryline[]): Map<string, { chapter: number; total: number }> {
  const counts = new Map<string, { chapter: number; total: number }>();
  for (const storyline of storylines) {
    const chronological = [...storyline.chapters].reverse();
    chronological.forEach((item, index) => counts.set(item.id, { chapter: index + 1, total: chronological.length }));
  }
  return counts;
}
