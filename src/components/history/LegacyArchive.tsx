import { useState } from 'react';
import { Panel } from '../Panel';
import type { CareerLegacyState } from '../../types/phase18Types';

type LegacyTab = 'milestones' | 'hall' | 'alternate';
const PAGE_SIZE = 6;

export function LegacyArchive({ legacy }: { legacy: CareerLegacyState }) {
  const [tab, setTab] = useState<LegacyTab>('milestones');
  const [page, setPage] = useState(0);
  const milestones = [...legacy.milestones].sort((a, b) => b.seasonYear - a.seasonYear || (b.round ?? 0) - (a.round ?? 0));
  const hall = [...legacy.hallOfFame].sort((a, b) => b.inductionSeasonYear - a.inductionSeasonYear);
  const alternate = [...legacy.alternateHistory].sort((a, b) => b.seasonYear - a.seasonYear || b.significance - a.significance);
  const rows = tab === 'milestones' ? milestones : tab === 'hall' ? hall : alternate;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const chooseTab = (next: LegacyTab) => { setTab(next); setPage(0); };

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-4">
      <Kpi label="Legacy score" value={legacy.score} />
      <Kpi label="Milestones" value={legacy.milestones.length} />
      <Kpi label="Hall of Fame" value={legacy.hallOfFame.length} />
      <Kpi label="History changes" value={legacy.alternateHistory.length} />
    </div>
    <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1">
      <SubTab active={tab === 'milestones'} onClick={() => chooseTab('milestones')}>Milestones</SubTab>
      <SubTab active={tab === 'hall'} onClick={() => chooseTab('hall')}>Hall of Fame</SubTab>
      <SubTab active={tab === 'alternate'} onClick={() => chooseTab('alternate')}>Alternate History</SubTab>
    </div>
    <Panel title={tab === 'milestones' ? 'Career Milestones' : tab === 'hall' ? 'Hall of Fame' : 'Alternate-History Timeline'}>
      {visible.length === 0 ? <Empty tab={tab} /> : <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {tab === 'milestones' && milestones.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((entry) => <div key={entry.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-3"><div className="flex justify-between gap-3 text-[10px] uppercase text-neutral-500"><span>{splitLabel(entry.category)}</span><span>{entry.seasonYear}{entry.round ? ` R${entry.round}` : ''}</span></div><div className="mt-1 font-semibold text-neutral-100">{entry.title}</div><p className="mt-1 text-xs text-neutral-400">{entry.description}</p><div className="mt-2 text-xs font-semibold text-amber-300">+{entry.legacyPoints} legacy</div></div>)}
        {tab === 'hall' && hall.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((entry) => <div key={entry.id} className="rounded border border-amber-700/30 bg-amber-950/10 p-3"><div className="flex justify-between gap-3 text-[10px] uppercase text-amber-400/70"><span>{splitLabel(entry.subjectType)}</span><span>Class of {entry.inductionSeasonYear}</span></div><div className="mt-1 font-semibold text-amber-200">{entry.title}</div><p className="mt-1 text-xs text-neutral-400">{entry.summary}</p></div>)}
        {tab === 'alternate' && alternate.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((entry) => <div key={entry.id} className="rounded border border-violet-700/30 bg-violet-950/10 p-3"><div className="flex justify-between gap-3 text-[10px] uppercase text-violet-300/70"><span>{entry.category}</span><span>{entry.seasonYear}</span></div><p className="mt-2 text-sm font-medium text-neutral-200">{entry.careerOutcome}</p>{entry.historicalOutcome && <p className="mt-1 text-[10px] text-neutral-500">Baseline: {entry.historicalOutcome}</p>}<div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-800"><div className="h-full bg-violet-500" style={{ width: `${entry.significance}%` }} /></div><div className="mt-1 text-[10px] text-neutral-500">Significance {entry.significance}/100</div></div>)}
      </div>}
      {pageCount > 1 && <div className="mt-4 flex items-center justify-center gap-2"><PageButton disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</PageButton><span className="text-xs text-neutral-500">Page {safePage + 1} of {pageCount}</span><PageButton disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</PageButton></div>}
    </Panel>
  </div>;
}

function splitLabel(value: string): string { return value.replace(/([A-Z])/g, ' $1').trim(); }
function Kpi({ label, value }: { label: string; value: number }) { return <div className="rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2"><div className="text-[10px] uppercase text-neutral-500">{label}</div><div className="mt-1 text-xl font-bold tabular-nums text-neutral-100">{value}</div></div>; }
function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded px-3 py-2 text-xs font-semibold ${active ? 'bg-violet-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}`}>{children}</button>; }
function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" disabled={disabled} onClick={onClick} className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 enabled:hover:bg-neutral-700 disabled:opacity-40">{children}</button>; }
function Empty({ tab }: { tab: LegacyTab }) { return <p className="text-sm text-neutral-500">{tab === 'milestones' ? 'Complete races to begin building your career legacy.' : tab === 'hall' ? 'Elite drivers, teams, and principals will be inducted as their careers grow.' : 'Championship outcomes and major expectation-defying seasons will appear here.'}</p>; }
