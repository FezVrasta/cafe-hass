/**
 * Verifies the `temporal` (zundo) wiring around the flow store: structural
 * changes become undo/redo steps, UI-only changes don't, and history is
 * cleared when a different automation is loaded or the store is reset.
 */

import type { Node } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUUID } from '@/lib/utils';
import { type FlowNodeData, useFlowStore } from '../flow-store';

const testNode: Node<FlowNodeData> = {
  id: 'trigger-1',
  type: 'trigger',
  position: { x: 0, y: 0 },
  data: { trigger: 'state' },
};

function flushDebounce() {
  vi.advanceTimersByTime(300);
}

describe('Undo/Redo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useFlowStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('makes a structural change undoable and redoable', () => {
    useFlowStore.getState().addNode(testNode);
    flushDebounce();

    expect(useFlowStore.getState().nodes).toHaveLength(1);
    expect(useFlowStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    useFlowStore.temporal.getState().undo();
    expect(useFlowStore.getState().nodes).toHaveLength(0);

    useFlowStore.temporal.getState().redo();
    expect(useFlowStore.getState().nodes).toHaveLength(1);
    expect(useFlowStore.getState().nodes[0].id).toBe('trigger-1');
  });

  it('does not create a history entry for UI-only changes like selection', () => {
    useFlowStore.getState().addNode(testNode);
    flushDebounce();
    const pastCountAfterAdd = useFlowStore.temporal.getState().pastStates.length;

    useFlowStore.getState().selectNode('trigger-1');
    flushDebounce();

    expect(useFlowStore.temporal.getState().pastStates.length).toBe(pastCountAfterAdd);
  });

  it('coalesces rapid successive changes into a single history entry', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();
    addNode(testNode);
    // Simulate a burst — e.g. multiple drag-frame position updates — with no
    // gap long enough for the debounce to fire in between.
    updateNodeData('trigger-1', { alias: 'a' });
    updateNodeData('trigger-1', { alias: 'ab' });
    updateNodeData('trigger-1', { alias: 'abc' });
    flushDebounce();

    expect(useFlowStore.temporal.getState().pastStates.length).toBe(1);

    useFlowStore.temporal.getState().undo();
    // One undo step should remove the whole burst, landing back at "no node".
    expect(useFlowStore.getState().nodes).toHaveLength(0);
  });

  it('clears history on reset()', () => {
    useFlowStore.getState().addNode(testNode);
    flushDebounce();
    expect(useFlowStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    useFlowStore.getState().reset();

    expect(useFlowStore.temporal.getState().pastStates.length).toBe(0);
    expect(useFlowStore.temporal.getState().futureStates.length).toBe(0);
  });

  it('clears history on fromFlowGraph()', () => {
    useFlowStore.getState().addNode(testNode);
    flushDebounce();
    expect(useFlowStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    useFlowStore.getState().fromFlowGraph({
      id: generateUUID(),
      name: 'A different automation',
      nodes: [],
      edges: [],
      version: 1,
    });

    expect(useFlowStore.temporal.getState().pastStates.length).toBe(0);
    expect(useFlowStore.temporal.getState().futureStates.length).toBe(0);
  });
});
