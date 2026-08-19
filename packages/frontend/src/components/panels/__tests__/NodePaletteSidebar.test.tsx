import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'status.connectedTo') {
        return `Connected to ${options?.hostname ?? 'host'}`;
      }
      if (key === 'titles.appName') {
        return 'Café';
      }
      if (key === 'labels.quickHelp') {
        return 'Quick help';
      }
      if (key === 'labels.addNode') {
        return 'Add node';
      }
      if (key === 'help.clickNodesToAdd') {
        return 'Click nodes to add';
      }
      if (key === 'help.dragToConnect') {
        return 'Drag to connect';
      }
      if (key === 'help.deleteToRemove') {
        return 'Delete to remove';
      }
      if (key === 'help.backspaceDeleteKey') {
        return 'Backspace deletes';
      }
      if (key === 'buttons.collapseMenu') {
        return 'Collapse menu';
      }
      if (key === 'buttons.expandMenu') {
        return 'Expand menu';
      }
      return key;
    },
  }),
}));

import { NodePaletteSidebar } from '../NodePaletteSidebar';

describe('NodePaletteSidebar', () => {
  it('renders the expanded palette with quick-help content', () => {
    const html = renderToStaticMarkup(
      <NodePaletteSidebar expanded onToggle={() => {}} className="w-72" />
    );

    expect(html).toContain('Collapse menu');
    expect(html).toContain('Quick help');
  });

  it('renders the collapsed palette footer in icon-only mode', () => {
    const html = renderToStaticMarkup(
      <NodePaletteSidebar expanded={false} onToggle={() => {}} className="w-20" />
    );

    expect(html).toContain('Expand menu');
    expect(html).toContain('v');
  });
});
