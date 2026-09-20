import type { Node } from '@xyflow/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { type FlowNodeData, useFlowStore } from '../flow-store';

/**
 * Issue #238 — "Cannot save: N node(s) have validation errors" with nothing
 * highlighted. `nodeErrors` is keyed by node ID, so a deleted node's errors
 * would otherwise linger with no visible node to account for them.
 */
describe('Issue #238 - validation errors must not outlive their node', () => {
  const invalidNode: Node<FlowNodeData> = {
    id: 'set_vars_bad',
    type: 'set_variables',
    position: { x: 3000, y: 0 },
    // A Set Variables node with no variables fails validation
    data: { variables: {} },
  };

  const validNode: Node<FlowNodeData> = {
    id: 'act_ok',
    type: 'action',
    position: { x: 0, y: 0 },
    data: { service: 'light.turn_on' },
  };

  beforeEach(() => {
    useFlowStore.getState().reset();
  });

  it('clears the error when the offending node is removed', () => {
    const { addNode, validateAllNodes, removeNode } = useFlowStore.getState();
    addNode(validNode);
    addNode(invalidNode);
    validateAllNodes();

    expect(useFlowStore.getState().nodeErrors.has('set_vars_bad')).toBe(true);

    removeNode('set_vars_bad');

    const state = useFlowStore.getState();
    expect(state.nodeErrors.has('set_vars_bad')).toBe(false);
    expect(state.hasValidationErrors()).toBe(false);
  });

  it('clears the error when the node is deleted through onNodesChange', () => {
    const { addNode, validateAllNodes, onNodesChange } = useFlowStore.getState();
    addNode(validNode);
    addNode(invalidNode);
    validateAllNodes();
    expect(useFlowStore.getState().nodeErrors.size).toBe(1);

    // What pressing Delete on the canvas does
    onNodesChange([{ type: 'remove', id: 'set_vars_bad' }]);

    expect(useFlowStore.getState().nodeErrors.size).toBe(0);
  });

  it('leaves errors for nodes that still exist alone', () => {
    const { addNode, validateAllNodes, removeNode } = useFlowStore.getState();
    addNode(validNode);
    addNode(invalidNode);
    validateAllNodes();

    removeNode('act_ok');

    expect(useFlowStore.getState().nodeErrors.has('set_vars_bad')).toBe(true);
  });

  it('keeps the same Map instance when there is nothing to prune', () => {
    const { addNode, validateAllNodes, onNodesChange } = useFlowStore.getState();
    addNode(validNode);
    addNode(invalidNode);
    validateAllNodes();

    const before = useFlowStore.getState().nodeErrors;
    // A position change must not churn the errors map
    onNodesChange([{ type: 'position', id: 'act_ok', position: { x: 10, y: 10 } }]);

    expect(useFlowStore.getState().nodeErrors).toBe(before);
  });
});
