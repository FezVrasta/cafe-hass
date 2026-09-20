/**
 * addWaitTimeoutBranch inserts a template Condition node after a Wait node so
 * the user can branch on whether the wait completed in time or timed out
 * (https://github.com/FezVrasta/cafe-hass/issues/226). Covers: the timeout
 * precondition, the template chosen per wait type, forcing
 * continue_on_timeout, and re-parenting any pre-existing outgoing edge onto
 * the new condition's 'true' handle.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useFlowStore } from '../flow-store';

describe('addWaitTimeoutBranch', () => {
  beforeEach(() => {
    useFlowStore.getState().reset();
  });

  it('does nothing when the wait node has no timeout set', () => {
    const { addNode, addWaitTimeoutBranch } = useFlowStore.getState();
    addNode({
      id: 'wait1',
      type: 'wait',
      position: { x: 0, y: 0 },
      data: { wait_for_trigger: [{ trigger: 'state' }] },
    });

    addWaitTimeoutBranch('wait1');

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.edges).toHaveLength(0);
  });

  it('does nothing for a non-wait node', () => {
    const { addNode, addWaitTimeoutBranch } = useFlowStore.getState();
    addNode({
      id: 'a1',
      type: 'action',
      position: { x: 0, y: 0 },
      data: { service: 'light.turn_on' },
    });

    addWaitTimeoutBranch('a1');

    expect(useFlowStore.getState().nodes).toHaveLength(1);
  });

  it('adds a template condition checking wait.trigger for a wait_for_trigger node, and forces continue_on_timeout', () => {
    const { addNode, addWaitTimeoutBranch } = useFlowStore.getState();
    addNode({
      id: 'wait1',
      type: 'wait',
      position: { x: 100, y: 100 },
      data: {
        wait_for_trigger: [{ trigger: 'state' }],
        timeout: '00:05:00',
        continue_on_timeout: false,
      },
    });

    addWaitTimeoutBranch('wait1');

    const state = useFlowStore.getState();
    const waitNode = state.nodes.find((n) => n.id === 'wait1');
    expect(waitNode?.data.continue_on_timeout).toBe(true);

    const conditionNode = state.nodes.find((n) => n.type === 'condition');
    expect(conditionNode).toBeDefined();
    expect(conditionNode?.data.condition).toBe('template');
    expect(conditionNode?.data.value_template).toBe('{{ wait.trigger is not none }}');

    const linkEdge = state.edges.find(
      (e) => e.source === 'wait1' && e.target === conditionNode?.id
    );
    expect(linkEdge).toBeDefined();
    expect(linkEdge?.sourceHandle).toBeUndefined();
  });

  it('uses wait.completed for a wait_template node', () => {
    const { addNode, addWaitTimeoutBranch } = useFlowStore.getState();
    addNode({
      id: 'wait1',
      type: 'wait',
      position: { x: 0, y: 0 },
      data: { wait_template: "{{ is_state('sensor.x', 'on') }}", timeout: '00:05:00' },
    });

    addWaitTimeoutBranch('wait1');

    const conditionNode = useFlowStore.getState().nodes.find((n) => n.type === 'condition');
    expect(conditionNode?.data.value_template).toBe('{{ wait.completed }}');
  });

  it("re-parents an existing outgoing edge onto the new condition's 'true' handle", () => {
    const { addNode, addWaitTimeoutBranch, onConnect } = useFlowStore.getState();
    addNode({
      id: 'wait1',
      type: 'wait',
      position: { x: 0, y: 0 },
      data: { wait_for_trigger: [{ trigger: 'state' }], timeout: '00:05:00' },
    });
    addNode({
      id: 'next1',
      type: 'action',
      position: { x: 200, y: 0 },
      data: { service: 'light.turn_on' },
    });
    onConnect({ source: 'wait1', target: 'next1', sourceHandle: null, targetHandle: null });
    expect(useFlowStore.getState().edges).toHaveLength(1);

    addWaitTimeoutBranch('wait1');

    const state = useFlowStore.getState();
    const conditionNode = state.nodes.find((n) => n.type === 'condition');
    expect(conditionNode).toBeDefined();

    // The pre-existing edge now leaves the condition node's 'true' handle
    // instead of the wait node directly.
    const reparented = state.edges.find((e) => e.target === 'next1');
    expect(reparented?.source).toBe(conditionNode?.id);
    expect(reparented?.sourceHandle).toBe('true');

    // Wait node now only connects to the new condition node.
    const fromWait = state.edges.filter((e) => e.source === 'wait1');
    expect(fromWait).toHaveLength(1);
    expect(fromWait[0].target).toBe(conditionNode?.id);
  });
});
