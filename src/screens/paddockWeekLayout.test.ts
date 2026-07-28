import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FmPaneBody } from '../components/workspace/FmPane';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('Paddock Week scrolling layout', () => {
  it('constrains the three-pane workspace above the persistent decision bar', () => {
    const screen = source('PaddockWeek.tsx');
    const css = source('../index.css');

    expect(screen).toContain('<WorkspaceBody className="ui-paddock-week-body">');
    expect(screen.indexOf('</WorkspaceBody>')).toBeLessThan(screen.indexOf('<FmDecisionBar'));
    expect(css).toMatch(/\.ui-main-content\[data-route="\/paddock"\] \.ui-paddock-week-body \{[\s\S]*display: flex;[\s\S]*min-height: 0;[\s\S]*flex-direction: column;[\s\S]*overflow: hidden;/);
    expect(css).toMatch(/\.ui-paddock-week-body > \.ui-fm-workspace-grid \{[\s\S]*min-height: 0;[\s\S]*height: 100%;/);
  });

  it('keeps the agenda, decision workspace, and context as independent scroll regions', () => {
    const screen = source('PaddockWeek.tsx');

    expect(screen).toContain('ariaLabel="Weekly agenda" tabIndex={0}');
    expect(screen).toContain('aria-label="Paddock week decisions" tabIndex={0}');
    expect(screen).toContain('ariaLabel="Management context" tabIndex={0}');
  });

  it('renders labeled pane bodies as keyboard-focusable regions', () => {
    const html = renderToStaticMarkup(createElement(
      FmPaneBody,
      { ariaLabel: 'Weekly agenda', tabIndex: 0, children: 'Scrollable content' },
    ));

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Weekly agenda"');
    expect(html).toContain('tabindex="0"');
  });
});
