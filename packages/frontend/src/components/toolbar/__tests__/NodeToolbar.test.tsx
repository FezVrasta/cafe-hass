import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: <T,>(selector: T) => selector,
}));

vi.mock('@/hooks/useUndoRedo', () => ({
  useUndoRedo: () => ({ undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }),
}));

vi.mock('@/store/flow-store', () => ({
  useFlowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      nodes: [],
      edges: [],
      clipboard: null,
      pasteCount: 0,
      addNode: vi.fn(),
      removeNode: vi.fn(),
      updateNodeData: vi.fn(),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      setClipboard: vi.fn(),
      setPasteCount: vi.fn(),
    }),
}));

vi.mock('../../actions', () => {
  const action = (name: string) => () => ({
    name,
    group: 'history',
    icon: () => <span />,
    tooltip: name,
    execute: vi.fn(),
  });

  return {
    getAlignBottomAction: action('align-bottom'),
    getAlignLeftAction: action('align-left'),
    getAlignRightAction: action('align-right'),
    getAlignTopAction: action('align-top'),
    getCopyAction: action('copy'),
    getCutAction: action('cut'),
    getDeleteAction: action('delete'),
    getDisconnectAction: action('disconnect'),
    getDuplicateAction: action('duplicate'),
    getPasteAction: action('paste'),
    getRedoAction: action('redo'),
    getSelectAllAction: action('select-all'),
    getToggleEnabledAction: action('toggle-enabled'),
    getUndoAction: action('undo'),
  };
});

import { NodeToolbar } from '../NodeToolbar';

describe('NodeToolbar', () => {
  it('recenters the toolbar at the desktop breakpoint', () => {
    const html = renderToStaticMarkup(<NodeToolbar />);

    expect(html).toContain('ml-6');
    expect(html).toContain('sm:ml-4');
    expect(html).toContain('lg:ml-0');
  });
});
