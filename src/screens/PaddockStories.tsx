import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { useGame } from '../game/GameContext';
import type { NarrativeStory } from '../types/phase18Types';

type StoryTab = 'active' | 'developing' | 'resolved';
const PAGE_SIZE = 6;

export function PaddockStories() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<StoryTab>('active');
  const [category, setCategory] = useState<NarrativeStory['category'] | 'All'>('All');
  const [page, setPage] = useState(0);
  if (!state) return null;

  const stories = state.phase18?.narratives ?? [];
  const categories = [...new Set(stories.map((story) => story.category))].sort();
  const tabbed = stories.filter((story) => tab === 'resolved'
    ? story.status !== 'Active'
    : story.status === 'Active' && (tab === 'active'
      ? story.urgency === 'Important' || story.urgency === 'Critical'
      : story.urgency === 'Background' || story.urgency === 'Developing'));
  const filtered = tabbed
    .filter((story) => category === 'All' || story.category === category)
    .sort((a, b) => urgencyRank(b.urgency) - urgencyRank(a.urgency)
      || b.updatedSeasonYear - a.updatedSeasonYear
      || (b.updatedRound ?? 0) - (a.updatedRound ?? 0));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selectTab = (next: StoryTab) => { setTab(next); setPage(0); };
  const selectCategory = (next: NarrativeStory['category'] | 'All') => { setCategory(next); setPage(0); };

  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold text-neutral-100">Paddock Stories</h1>
      <p className="text-sm text-neutral-400">Persistent storylines that connect the decisions, pressure, people, and politics shaping your career.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <Kpi label="Awaiting response" value={stories.filter((story) => story.status === 'Active' && story.responseStatus === 'AwaitingResponse').length} />
      <Kpi label="Critical" value={stories.filter((story) => story.status === 'Active' && story.urgency === 'Critical').length} />
      <Kpi label="Developing" value={stories.filter((story) => story.status === 'Active' && (story.urgency === 'Developing' || story.urgency === 'Background')).length} />
      <Kpi label="Resolved" value={stories.filter((story) => story.status !== 'Active').length} />
    </div>
    <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1">
      <Tab active={tab === 'active'} onClick={() => selectTab('active')}>Active</Tab>
      <Tab active={tab === 'developing'} onClick={() => selectTab('developing')}>Developing</Tab>
      <Tab active={tab === 'resolved'} onClick={() => selectTab('resolved')}>Resolved History</Tab>
    </div>
    <div className="flex flex-wrap gap-1">
      <Filter active={category === 'All'} onClick={() => selectCategory('All')}>All</Filter>
      {categories.map((item) => <Filter key={item} active={category === item} onClick={() => selectCategory(item)}>{item}</Filter>)}
    </div>
    <Panel title={tab === 'active' ? 'Active Storylines' : tab === 'developing' ? 'Developing Threads' : 'Resolved Story History'}>
      {visible.length === 0
        ? <p className="text-sm text-neutral-500">No stories match this view yet.</p>
        : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((story) => <StoryCard key={story.id} story={story} canRespondNow={state.careerPhase?.currentPhase === 'paddock_week'} onNavigate={navigate} />)}</div>}
      {pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-2">
        <Page disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Page>
        <span className="text-xs text-neutral-500">Page {safePage + 1} of {pageCount}</span>
        <Page disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</Page>
      </div>}
    </Panel>
  </div>;
}

function StoryCard({ story, canRespondNow, onNavigate }: { story: NarrativeStory; canRespondNow: boolean; onNavigate: (route: string) => void }) {
  const awaiting = story.status === 'Active' && story.responseStatus === 'AwaitingResponse';
  return <article className={`rounded-lg border p-3 ${story.urgency === 'Critical' ? 'border-red-700/40 bg-red-950/10' : story.urgency === 'Important' ? 'border-amber-700/30 bg-amber-950/10' : 'border-neutral-800 bg-neutral-900/40'}`}>
    <div className="flex items-center justify-between gap-3 text-[10px] uppercase">
      <span className={urgencyTone(story.urgency)}>{story.category} · {story.stage ?? story.urgency}</span>
      <span className="text-neutral-500">{story.updatedSeasonYear}{story.updatedRound ? ` R${story.updatedRound}` : ''}</span>
    </div>
    <h2 className="mt-1 font-bold text-neutral-100">{story.headline}</h2>
    <p className="mt-1 text-xs text-neutral-400">{story.summary}</p>
    <div className="mt-3 h-1.5 overflow-hidden rounded bg-neutral-800">
      <div className={`h-full ${story.urgency === 'Critical' ? 'bg-red-500' : story.urgency === 'Important' ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${story.progress ?? 20}%` }} />
    </div>
    {story.consequenceSummary && <p className="mt-2 text-[10px] text-neutral-300"><span className="font-semibold text-neutral-500">Impact:</span> {story.consequenceSummary}</p>}
    {story.aiReaction && <p className="mt-1 text-[10px] text-violet-300"><span className="font-semibold text-violet-500">Paddock response:</span> {story.aiReaction}{story.lastAIReactionRound != null ? ` Applied R${story.lastAIReactionRound}.` : ''}</p>}
    {story.lastResponseSummary && <p className="mt-1 text-[10px] text-emerald-300"><span className="font-semibold text-emerald-500">Your response:</span> {story.lastResponseSummary}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {awaiting && canRespondNow && <button type="button" onClick={() => onNavigate('/paddock')} className="rounded bg-amber-500 px-2 py-1 text-[10px] font-semibold text-neutral-950 hover:bg-amber-400">Respond in Paddock Week</button>}
      {awaiting && !canRespondNow && <span className="rounded bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-300">Response available next Paddock Week</span>}
      {story.actionRoute && story.status === 'Active' && <button type="button" onClick={() => onNavigate(story.actionRoute!)} className="rounded bg-neutral-800 px-2 py-1 text-[10px] font-semibold text-neutral-200 hover:bg-neutral-700">Open related screen</button>}
    </div>
  </article>;
}

function urgencyRank(value: NarrativeStory['urgency']): number { return value === 'Critical' ? 3 : value === 'Important' ? 2 : value === 'Developing' ? 1 : 0; }
function urgencyTone(value: NarrativeStory['urgency']): string { return value === 'Critical' ? 'text-red-300' : value === 'Important' ? 'text-amber-300' : 'text-sky-300'; }
function Kpi({ label, value }: { label: string; value: number }) { return <div className="rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2"><div className="text-[10px] uppercase text-neutral-500">{label}</div><div className="mt-1 text-xl font-bold tabular-nums text-neutral-100">{value}</div></div>; }
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded px-3 py-2 text-xs font-semibold ${active ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}>{children}</button>; }
function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded px-2 py-1 text-[10px] ${active ? 'bg-violet-500/20 text-violet-200' : 'bg-neutral-900 text-neutral-500 hover:text-neutral-200'}`}>{children}</button>; }
function Page({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" disabled={disabled} onClick={onClick} className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 enabled:hover:bg-neutral-700 disabled:opacity-40">{children}</button>; }
