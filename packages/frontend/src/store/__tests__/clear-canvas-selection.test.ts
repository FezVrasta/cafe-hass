import type { Edge, Node } from '@xyflow/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { type FlowNodeData, useFlowStore } from '../flow-store';

const selectedNode: Node<FlowNodeData> = {
  id: 'trigger-1',
  type: 'trigger',
  position: { x: 0, y: 0 },
  data: { trigger: 'state' },
  selected: true,
};

const unselectedNode: Node<FlowNodeData> = {
  id: 'action-1',
  type: 'action',
  position: { x: 200, y: 0 },
  data: { action: 'light.turn_on' },
  selected: false,
};

const selectedEdge: Edge = {
  id: 'edge-1',
  source: 'trigger-1',
  target: 'action-1',
  selected: true,
};

describe('clearCanvasSelection', () => {
  beforeEach(() => {
    useFlowStore.getState().reset();
  });

  it('clears selected node id and selected flags for nodes and edges', () => {
    const store = useFlowStore.getState();

    store.setNodes([selectedNode, unselectedNode]);
    store.setEdges([selectedEdge]);
    store.selectNode('trigger-1');

    expect(useFlowStore.getState().selectedNodeId).toBe('trigger-1');
    expect(useFlowStore.getState().nodes.some((node) => node.selected)).toBe(true);
    expect(useFlowStore.getState().edges.some((edge) => edge.selected)).toBe(true);

    store.clearCanvasSelection();

    const after = useFlowStore.getState();
    expect(after.selectedNodeId).toBeNull();
    expect(after.nodes.every((node) => node.selected === false)).toBe(true);
    expect(after.edges.every((edge) => edge.selected === false)).toBe(true);
  });
});