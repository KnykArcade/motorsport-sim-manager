import { useState } from 'react';
import type { CareerLegacyState } from '../../types/phase18Types';

type LegacyTab = 'milestones' | 'hall' | 'alternate';

export function LegacyArchive({ legacy }: { legacy: CareerLegacyState }) {
  const [tab, setTab] = useState<LegacyTab>('milestones');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const milestones = [...legacy.milestones].sort((a, b) => b.seasonYear - a.seasonYear || (b.round ?? 0) - (a.round ?? 0));
  const hall = [...legacy.hallOfFame].sort((a, b) => b.inductionSeasonYear - a.inductionSeasonYear);
  const alternate = [...legacy.alternateHistory].sort((a, b) => b.seasonYear - a.seasonYear || b.significance - a.significance);
  const rows = tab === 'milestones' ? milestones : tab === 'hall' ? hall : alternate;
  const selected = rows.find((entry) => entry.id === selectedId) ?? rows[0];

  function chooseTab(next: LegacyTab) {
    setTab(next);
    setSelectedId(null);
  }

  return (
    <div className="ui-fm-workspace-grid is-three ui-legacy-grid">
      <section className="ui-fm-pane ui-legacy-category-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Legacy archive</div><div className="ui-fm-pane-meta">Career score {legacy.score}</div></div></div>
        <div className="ui-legacy-tab-list">
          <button type="button" className={tab === 'milestones' ? 'is-active' : ''} onClick={() => chooseTab('milestones')}><span>{milestones.length}</span><strong>Career milestones</strong><small>Results, titles, and breakthroughs</small></button>
          <button type="button" className={tab === 'hall' ? 'is-active' : ''} onClick={() => chooseTab('hall')}><span>{hall.length}</span><strong>Hall of Fame</strong><small>Inducted people and teams</small></button>
          <button type="button" className={tab === 'alternate' ? 'is-active' : ''} onClick={() => chooseTab('alternate')}><span>{alternate.length}</span><strong>Alternate history</strong><small>Where the universe changed</small></button>
        </div>
        <div className="ui-legacy-score">
          <span>Career legacy score</span><strong>{legacy.score}</strong>
          <small>{milestones.length} milestones · {hall.length} inductions · {alternate.length} history changes</small>
        </div>
      </section>

      <section className="ui-fm-pane ui-legacy-timeline-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">{tab === 'milestones' ? 'Milestone timeline' : tab === 'hall' ? 'Hall of Fame classes' : 'Alternate-history timeline'}</div><div className="ui-fm-pane-meta">Select an entry for its full record</div></div></div>
        <div className="ui-fm-pane-body">
          {rows.length === 0 ? <Empty tab={tab} /> : rows.map((entry) => {
            const year = 'seasonYear' in entry ? entry.seasonYear : entry.inductionSeasonYear;
            const title = 'title' in entry ? entry.title : entry.careerOutcome;
            const category = 'category' in entry ? splitLabel(entry.category) : splitLabel(entry.subjectType);
            return (
              <button key={entry.id} type="button" className={`ui-fm-list-button ${selected?.id === entry.id ? 'is-active' : ''}`} onClick={() => setSelectedId(entry.id)}>
                <span>{year} · {category}</span><strong>{title}</strong>
                <small>{'legacyPoints' in entry ? `+${entry.legacyPoints} legacy` : 'significance' in entry ? `Significance ${entry.significance}/100` : `Class of ${entry.inductionSeasonYear}`}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="ui-fm-pane ui-legacy-detail-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Archive entry</div><div className="ui-fm-pane-meta">{selected ? ('seasonYear' in selected ? selected.seasonYear : selected.inductionSeasonYear) : 'No entry selected'}</div></div></div>
        <div className="ui-fm-pane-body">
          {!selected ? <Empty tab={tab} /> : tab === 'milestones' && 'description' in selected ? (
            <div className="ui-legacy-dossier">
              <span>{splitLabel(selected.category)} · {selected.seasonYear}{selected.round ? ` round ${selected.round}` : ''}</span>
              <strong>{selected.title}</strong>
              <p>{selected.description}</p>
              <div className="ui-fm-key-value"><span>Legacy awarded</span><strong>+{selected.legacyPoints}</strong></div>
              <div className="ui-fm-key-value"><span>Team record</span><strong>{selected.teamId ?? 'Career-wide'}</strong></div>
            </div>
          ) : tab === 'hall' && 'summary' in selected ? (
            <div className="ui-legacy-dossier">
              <span>{splitLabel(selected.subjectType)} · Class of {selected.inductionSeasonYear}</span>
              <strong>{selected.title}</strong>
              <p>{selected.summary}</p>
              <div className="ui-fm-key-value"><span>Subject type</span><strong>{splitLabel(selected.subjectType)}</strong></div>
              <div className="ui-fm-key-value"><span>Archive identity</span><strong>{selected.subjectId}</strong></div>
            </div>
          ) : 'careerOutcome' in selected ? (
            <div className="ui-legacy-dossier">
              <span>{selected.category} · {selected.seasonYear}</span>
              <strong>{selected.careerOutcome}</strong>
              {selected.historicalOutcome && <p>Historical baseline: {selected.historicalOutcome}</p>}
              <div className="ui-fm-key-value"><span>Significance</span><strong>{selected.significance}/100</strong></div>
              <div className="ui-legacy-significance"><i style={{ width: `${selected.significance}%` }} /></div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function splitLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').trim();
}

function Empty({ tab }: { tab: LegacyTab }) {
  return <p className="ui-technical-empty">{tab === 'milestones' ? 'Complete races to begin building your career legacy.' : tab === 'hall' ? 'Elite drivers, teams, and principals will be inducted as their careers grow.' : 'Championship outcomes and major expectation-defying seasons will appear here.'}</p>;
}
