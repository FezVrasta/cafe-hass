// @vitest-environment node
// https://github.com/FezVrasta/cafe-hass/issues/225 — "Positions of blocks
// get mixed up after re-opening the automation". _cafe_metadata.nodes used
// to be written in `flow.nodes` array order (editor creation order), but
// YamlParser re-assigns saved positions to nodes in the order it encounters
// them while walking the generated YAML (parallel branches, top-to-bottom).
// Those two orders only coincide for simple linear flows — once a flow has
// several same-type nodes spread across parallel branches, and the node
// array order doesn't match the branch emission order, positions land on
// the wrong node after a save/reload round trip.
import { type FlowGraph, isActionNode, isConditionNode } from '@cafe/shared';
import { v4 as uuidv4 } from 'uuid';
import { FlowTranspiler } from '../FlowTranspiler';

describe('cafe-hass#225: node positions survive a save/reload round trip', () => {
  it('keeps positions attached to the correct node across parallel branches', async () => {
    // Two parallel branches (condition -> action each), each reachable
    // directly from the trigger. Branch A is added to `flow.nodes` *after*
    // branch B, but wired (via edge order) to be emitted *first* in the
    // generated YAML's parallel block — the exact mismatch that caused the
    // bug.
    const flow: FlowGraph = {
      id: uuidv4(),
      name: 'Parallel Branches Flow',
      description: '',
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: { trigger: 'sun' } },
        {
          id: 'condition-B',
          type: 'condition',
          position: { x: 999, y: 999 },
          data: { condition: 'state', entity_id: 'sensor.b', state: 'on' },
        },
        {
          id: 'action-B',
          type: 'action',
          position: { x: 999, y: 888 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.b' } },
        },
        {
          id: 'condition-A',
          type: 'condition',
          position: { x: 100, y: 100 },
          data: { condition: 'state', entity_id: 'sensor.a', state: 'on' },
        },
        {
          id: 'action-A',
          type: 'action',
          position: { x: 100, y: 200 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.a' } },
        },
      ],
      edges: [
        // Branch A wired first, even though its nodes were appended to
        // `flow.nodes` after branch B's.
        { id: 'e-t-a', source: 'trigger-1', target: 'condition-A' },
        { id: 'e-a-a', source: 'condition-A', target: 'action-A', sourceHandle: 'true' },
        { id: 'e-t-b', source: 'trigger-1', target: 'condition-B' },
        { id: 'e-b-b', source: 'condition-B', target: 'action-B', sourceHandle: 'true' },
      ],
      version: 1,
      metadata: { mode: 'single', initial_state: false },
    };

    const transpiler = new FlowTranspiler();
    const { yaml } = transpiler.transpile(flow, { forceStrategy: 'native' });
    const parseResult = await transpiler.fromYaml(yaml!);

    expect(parseResult.success).toBe(true);
    const nodes = parseResult.graph!.nodes;

    const conditionA = nodes.find((n) => isConditionNode(n) && n.data.entity_id === 'sensor.a');
    const conditionB = nodes.find((n) => isConditionNode(n) && n.data.entity_id === 'sensor.b');
    const actionA = nodes.find((n) => isActionNode(n) && n.data.target?.entity_id === 'light.a');
    const actionB = nodes.find((n) => isActionNode(n) && n.data.target?.entity_id === 'light.b');

    expect(conditionA?.position).toEqual({ x: 100, y: 100 });
    expect(actionA?.position).toEqual({ x: 100, y: 200 });
    expect(conditionB?.position).toEqual({ x: 999, y: 999 });
    expect(actionB?.position).toEqual({ x: 999, y: 888 });
  });
});
