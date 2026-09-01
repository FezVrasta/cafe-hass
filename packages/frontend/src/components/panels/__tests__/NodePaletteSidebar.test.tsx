import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { COMPACT_NODE_PALETTE_COLLAPSED_WIDTH } from '../layout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { NodePaletteSidebar } from '../NodePaletteSidebar';

describe('NodePaletteSidebar', () => {
  it('renders the expanded palette with quick-help content', () => {
    const html = renderToStaticMarkup(
      <NodePaletteSidebar expanded onToggle={() => {}} className="w-72" />
    );

    expect(html).toContain('buttons.collapseMenu');
    expect(html).toContain('labels.quickHelp');
  });

  it('renders the collapsed palette footer in icon-only mode', () => {
    const html = renderToStaticMarkup(
      <NodePaletteSidebar expanded={false} onToggle={() => {}} className="w-20" />
    );

    expect(html).toContain('buttons.expandMenu');
    expect(html).toContain('v');
  });

  it('uses the shared compact collapsed rail width in compact layout', () => {
    const html = renderToStaticMarkup(
      <NodePaletteSidebar expanded={false} onToggle={() => {}} layout="compact" />
    );

    expect(html).toContain(`width:${COMPACT_NODE_PALETTE_COLLAPSED_WIDTH}`);
    expect(html).toContain('absolute');
    expect(html).toContain('top-0');
    expect(html).toContain('bottom-0');
    expect(html).toContain('left-0');
  });
});
