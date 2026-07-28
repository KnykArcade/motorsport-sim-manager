import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { useGame } from '../game/GameContext';
import type { NarrativeStory } from '../types/phase18Types';

type StoryTab = 'active' | 'developing' | 'resolved';
const PAGE_SIZE = 18;

export function PaddockStories() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<StoryTab>('active');
  const [category, setCategory] = useState<NarrativeStory['category'] | 'All'>('All');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
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
  const selected = filtered.find((story) => story.id === selectedId) ?? visible[0];
  const selectTab = (next: StoryTab) => { setTab(next); setPage(0); setSelectedId(undefined); };
  const selectCategory = (next: NarrativeStory['category'] | 'All') => { setCategory(next); setPage(0); setSelectedId(undefined); };

  const awaitingCount = stories.filter((story) => story.status === 'Active' && story.responseStatus === 'AwaitingResponse').length;
  const developingCount = stories.filter((story) => story.status === 'Active' && (story.urgency === 'Developing' || story.urgency === 'Background')).length;
  const resolvedCount = stories.filter((story) => story.status !== 'Active').length;
  const activeCount = stories.filter((story) => story.status === 'Active' && (story.urgency === 'Important' || story.urgency === 'Critical')).length;
  const canRespondNow = state.careerPhase?.currentPhase === 'paddock_week';

  return (
    <WorkspaceScreen className="ui-phase2-stories">
      <WorkspaceHeader
        eyebrow="Living paddock"
        title="Paddock Stories"
        subtitle={`${stories.filter((story) => story.status === 'Active').length} active threads · ${awaitingCount} awaiting management input`}
        actions={<button type="button" onClick={() => navigate('/news')} className="ui-inline-action rounded border px-3 py-1.5 text-xs font-semibold">Open News Center</button>}
      />
      <WorkspaceTabs
        items={[
          { id: 'active', label: `Needs Attention (${activeCount})` },
          { id: 'developing', label: `Developing (${developingCount})` },
          { id: 'resolved', label: `Resolved History (${resolvedCount})` },
        ]}
        active={tab}
        onChange={selectTab}
        ariaLabel="Paddock story sections"
      />
      <WorkspaceBody>
        <FmWorkspaceGrid>
          <FmPane>
            <FmPaneHeader title="Storyline tracker" meta={`${filtered.length} matching threads`} />
            <FmPaneBody>
              <div className="ui-story-filter">
                <label htmlFor="story-category">Category</label>
                <select id="story-category" value={category} onChange={(event) => selectCategory(event.target.value as NarrativeStory['category'] | 'All')}>
                  <option value="All">All categories</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              {visible.map((story) => (
                <FmListButton
                  key={story.id}
                  active={selected?.id === story.id}
                  urgent={story.urgency === 'Critical' || story.responseStatus === 'AwaitingResponse'}
                  onClick={() => setSelectedId(story.id)}
                >
                  <span className="ui-news-list-source">{story.category} · {story.stage ?? story.urgency}</span>
                  <strong>{story.headline}</strong>
                  <span>{story.summary}</span>
                  <small>{story.updatedSeasonYear}{story.updatedRound ? ` · R${story.updatedRound}` : ''}</small>
                </FmListButton>
              ))}
              {visible.length === 0 && <div className="ui-inbox-empty">No stories match this view yet.</div>}
              {pageCount > 1 && (
                <div className="ui-story-pagination">
                  <button type="button" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
                  <span>{safePage + 1}/{pageCount}</span>
                  <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</button>
                </div>
              )}
            </FmPaneBody>
          </FmPane>

          <FmPane>
            <FmPaneHeader title={selected?.headline ?? 'Selected storyline'} meta={selected ? `${selected.category} · ${selected.urgency}` : 'No storyline selected'} />
            <FmPaneBody className="ui-story-reader">
              {selected ? (
                <article>
                  <div className="ui-news-reader-flags">
                    <span className={urgencyTone(selected.urgency)}>{selected.urgency}</span>
                    <span>{selected.status}</span>
                    {selected.responseStatus && <span>{selected.responseStatus}</span>}
                  </div>
                  <h2>{selected.headline}</h2>
                  <p>{selected.summary}</p>
                  <div className="ui-story-progress">
                    <span style={{ width: `${selected.progress ?? 20}%` }} />
                  </div>
                  {selected.consequenceSummary && (
                    <section>
                      <h3>Consequences</h3>
                      <p>{selected.consequenceSummary}</p>
                    </section>
                  )}
                  {selected.lastResponseSummary && (
                    <section>
                      <h3>Your previous response</h3>
                      <p>{selected.lastResponseSummary}</p>
                    </section>
                  )}
                  {selected.aiReaction && (
                    <section>
                      <h3>Paddock reaction</h3>
                      <p>{selected.aiReaction}{selected.lastAIReactionRound != null ? ` Applied R${selected.lastAIReactionRound}.` : ''}</p>
                    </section>
                  )}
                  <div className="ui-story-actions">
                    {selected.status === 'Active' && selected.responseStatus === 'AwaitingResponse' && canRespondNow && (
                      <button type="button" onClick={() => navigate('/paddock?tab=decisions')}>Respond in Paddock Week</button>
                    )}
                    {selected.status === 'Active' && selected.actionRoute && (
                      <button type="button" onClick={() => navigate(selected.actionRoute!)}>Open related screen</button>
                    )}
                  </div>
                </article>
              ) : <div className="ui-inbox-empty">Select a storyline to inspect it.</div>}
            </FmPaneBody>
          </FmPane>

          <FmPane>
            <FmPaneHeader title="Story context" meta="Pressure and status" />
            <FmPaneBody className="ui-news-context-pane">
              {selected ? (
                <>
                  <section>
                    <h3>Current state</h3>
                    <FmKeyValue label="Urgency" value={selected.urgency} />
                    <FmKeyValue label="Stage" value={selected.stage ?? '—'} />
                    <FmKeyValue label="Progress" value={`${selected.progress ?? 20}%`} />
                    <FmKeyValue label="Last update" value={`${selected.updatedSeasonYear}${selected.updatedRound ? ` R${selected.updatedRound}` : ''}`} />
                  </section>
                  <section>
                    <h3>Management response</h3>
                    <p>
                      {selected.responseStatus === 'AwaitingResponse'
                        ? canRespondNow
                          ? 'A response is available now in Paddock Week.'
                          : 'The response will be available during the next Paddock Week.'
                        : selected.lastResponseSummary ?? 'No active response is required.'}
                    </p>
                  </section>
                </>
              ) : <div className="ui-inbox-empty">No story context available.</div>}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function urgencyRank(value: NarrativeStory['urgency']): number {
  return value === 'Critical' ? 3 : value === 'Important' ? 2 : value === 'Developing' ? 1 : 0;
}

function urgencyTone(value: NarrativeStory['urgency']): string {
  return value === 'Critical' ? 'text-red-300' : value === 'Important' ? 'text-amber-300' : 'text-neutral-300';
}
