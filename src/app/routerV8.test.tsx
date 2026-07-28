import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes, useParams, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

function RoutedScreen() {
  const { raceId } = useParams();
  const [searchParams] = useSearchParams();

  return (
    <div>
      Race {raceId} · {searchParams.get('tab')}
    </div>
  );
}

describe('React Router v8 integration', () => {
  it('matches parameterized routes and exposes URL search state', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/live-race/race-42?tab=timing']}>
        <Routes>
          <Route path="/live-race/:raceId" element={<RoutedScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain('Race race-42');
    expect(html).toContain('timing');
  });
});
