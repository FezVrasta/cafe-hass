/**
 * Cross-node validation for the exported HA step `id:` (node.data.id — a
 * field entirely separate from the node's own graph id). This can't live in
 * validateNodeData's per-node schema check, which never sees sibling nodes.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useFlowStore } from '../flow-store';

const DUPLICATE_ID_MESSAGE = 'errors:validation.node.duplicateId';

function hasDuplicateIdError(errors: { message: string }[] | undefined): boolean {
  return errors?.some((e) => e.message === DUPLICATE_ID_MESSAGE) ?? false;
}

describe('Node ID duplicate validation', () => {
  beforeEach(() => {
    useFlowStore.getState().reset();
  });

  it('flags two nodes sharing the same data.id after validateAllNodes', () => {
    const { addNode, validateAllNodes } = useFlowStore.getState();
    addNode({
      id: 'n1',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { trigger: 'state', id: 'dup' },
    });
    addNode({
      id: 'n2',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { trigger: 'state', id: 'dup' },
    });

    validateAllNodes();

    const state = useFlowStore.getState();
    expect(hasDuplicateIdError(state.nodeErrors.get('n1'))).toBe(true);
    expect(hasDuplicateIdError(state.nodeErrors.get('n2'))).toBe(true);
  });

  it('clears the duplicate error on both nodes once one is renamed to a unique id', () => {
    const { addNode, updateNodeData, validateAllNodes } = useFlowStore.getState();
    addNode({
      id: 'n1',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { trigger: 'state', id: 'dup' },
    });
    addNode({
      id: 'n2',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { trigger: 'state', id: 'dup' },
    });
    validateAllNodes();
    expect(hasDuplicateIdError(useFlowStore.getState().nodeErrors.get('n1'))).toBe(true);

    // updateNodeData itself re-runs validateAllNodes whenever `id` changes —
    // no explicit validateAllNodes() call needed here.
    updateNodeData('n2', { id: 'unique' });

    const state = useFlowStore.getState();
    expect(hasDuplicateIdError(state.nodeErrors.get('n1'))).toBe(false);
    expect(hasDuplicateIdError(state.nodeErrors.get('n2'))).toBe(false);
  });

  it('does not flag a lone custom id or nodes with no id at all', () => {
    const { addNode, validateAllNodes } = useFlowStore.getState();
    addNode({
      id: 'n1',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { trigger: 'state', id: 'solo' },
    });
    addNode({ id: 'n2', type: 'trigger', position: { x: 0, y: 0 }, data: { trigger: 'state' } });
    addNode({ id: 'n3', type: 'trigger', position: { x: 0, y: 0 }, data: { trigger: 'state' } });

    validateAllNodes();

    const state = useFlowStore.getState();
    expect(hasDuplicateIdError(state.nodeErrors.get('n1'))).toBe(false);
    expect(hasDuplicateIdError(state.nodeErrors.get('n2'))).toBe(false);
    expect(hasDuplicateIdError(state.nodeErrors.get('n3'))).toBe(false);
  });
});
