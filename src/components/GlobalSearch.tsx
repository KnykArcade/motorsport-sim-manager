import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../game/careerState';
import {
  globalSearchIndex,
  searchGlobalIndex,
  type GlobalSearchResult,
} from './layoutGlobalSearch';

export function GlobalSearch({
  state,
  hiddenRoutes,
  onNavigate,
}: {
  state: GameState;
  hiddenRoutes: ReadonlySet<string>;
  onNavigate: (to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => globalSearchIndex(state, hiddenRoutes), [state, hiddenRoutes]);
  const results = useMemo(() => searchGlobalIndex(index, query), [index, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === '/')) {
        event.preventDefault();
        setOpen(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navigateTo = (to: string) => {
    setOpen(false);
    setQuery('');
    onNavigate(to);
  };

  return (
    <div className="ui-global-search">
      <button
        type="button"
        className="ui-global-search-trigger"
        aria-label="Search drivers, staff, teams, races, circuits, and championships"
        onClick={() => {
          setOpen(true);
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <span>Search</span>
        <small>Ctrl K</small>
      </button>

      {open && (
        <div className="ui-global-search-layer" role="dialog" aria-modal="true" aria-label="Global search">
          <button type="button" className="ui-global-search-scrim" aria-label="Close global search" onClick={() => setOpen(false)} />
          <section className="ui-global-search-panel">
            <header>
              <div>
                <span>Global object search</span>
                <strong>Find anything in the motorsport world</strong>
              </div>
              <button type="button" onClick={() => setOpen(false)}>Close</button>
            </header>
            <label className="ui-global-search-input">
              <span>Search</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Driver, staff member, team, race, circuit, championship…"
                autoComplete="off"
              />
            </label>
            <div className="ui-global-search-results">
              {query.trim().length < 2 ? (
                <div className="ui-global-search-empty">
                  Type at least two characters. Results open the exact object and include contextual actions.
                </div>
              ) : results.length === 0 ? (
                <div className="ui-global-search-empty">No matching object was found in this career.</div>
              ) : (
                results.map((result) => (
                  <SearchResultRow key={result.id} result={result} onNavigate={navigateTo} />
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SearchResultRow({
  result,
  onNavigate,
}: {
  result: GlobalSearchResult;
  onNavigate: (to: string) => void;
}) {
  return (
    <article className="ui-global-search-result">
      <button type="button" className="ui-global-search-primary" onClick={() => onNavigate(result.to)}>
        <span>{result.category}</span>
        <strong>{result.title}</strong>
        <small>{result.subtitle}</small>
      </button>
      <details>
        <summary>Actions</summary>
        <div>
          {result.actions.map((action) => (
            <button key={`${result.id}:${action.label}`} type="button" onClick={() => onNavigate(action.to)}>
              {action.label}
            </button>
          ))}
        </div>
      </details>
    </article>
  );
}
