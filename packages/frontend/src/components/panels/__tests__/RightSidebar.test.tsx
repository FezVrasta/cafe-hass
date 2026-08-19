import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/panels/PropertyPanel', () => ({
  PropertyPanel: () => <div>PropertyPanel</div>,
}));

vi.mock('@/components/panels/YamlPreview', () => ({
  YamlPreview: () => <div>YamlPreview</div>,
}));

vi.mock('@/components/simulator/AutomationTraceViewer', () => ({
  AutomationTraceViewer: () => <div>AutomationTraceViewer</div>,
}));

vi.mock('@/components/simulator/SpeedControl', () => ({
  SpeedControl: () => <div>SpeedControl</div>,
}));

vi.mock('@/components/simulator/TraceSimulator', () => ({
  TraceSimulator: () => <div>TraceSimulator</div>,
}));

vi.mock('@/hooks/useFlowGraphImportExport', () => ({
  useFlowGraphImportExport: () => ({
    importFromJsonFile: vi.fn(),
    exportToJsonFile: vi.fn(),
  }),
}));

const useFlowStoreMock = vi.fn();

vi.mock('@/store/flow-store', () => ({
  useFlowStore: () => useFlowStoreMock(),
}));

import { RightSidebar } from '../RightSidebar';

function createStoreState(overrides?: Partial<ReturnType<typeof createStoreStateBase>>) {
  return {
    ...createStoreStateBase(),
    ...overrides,
  };
}

function createStoreStateBase() {
  return {
    selectedNodeId: null as string | null,
    clearCanvasSelection: vi.fn(),
    rightPanelExpanded: false,
    setRightPanelExpanded: vi.fn(),
    toggleRightPanelExpanded: vi.fn(),
    simulationSpeed: 1000,
    setSimulationSpeed: vi.fn(),
  };
}

describe('RightSidebar', () => {
  beforeEach(() => {
    useFlowStoreMock.mockReturnValue(createStoreState());
  });

  it('renders a centered slim handle in compact layout', () => {
    const html = renderToStaticMarkup(<RightSidebar isCompactLayout={true} />);

    expect(html).toContain('top-1/2');
    expect(html).toContain('-translate-y-1/2');
    expect(html).toContain('h-14');
    expect(html).toContain('w-8');
    expect(html).toContain('rounded-l-lg');
    expect(html).toContain('w-full');
  });

  it('keeps the desktop trigger near the top with desktop sizing', () => {
    const html = renderToStaticMarkup(<RightSidebar isCompactLayout={false} />);

    expect(html).toContain('top-3');
    expect(html).toContain('h-10');
    expect(html).toContain('w-10');
    expect(html).toContain('rounded-l-md');
    expect(html).toContain('w-[320px]');
    expect(html).toContain('max-w-[85vw]');
  });
});