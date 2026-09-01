import type { FlowGraph } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

/**
 * The state-machine strategy is selected whenever a flow has 2+ triggers.
 * These tests cover the round-trip losses reported in:
 *   #228 — fan-out after an action ran only the first branch
 *   #212 — set_variables nodes came back as empty action nodes
 */

/** Two triggers force the state-machine strategy. */
const TRIGGERS: FlowGraph['nodes'] = [
  {
    id: 'trigger_0',
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: { trigger: 'state', entity_id: ['binary_sensor.a'] },
  },
  {
    id: 'trigger_1',
    type: 'trigger',
    position: { x: 0, y: 200 },
    data: { trigger: 'state', entity_id: ['binary_sensor.b'] },
  },
];

describe('Issue #228 - fan-out after an action drops all but the first branch', () => {
  const flow: FlowGraph = {
    id: '11111111-2222-4333-8444-555555555555',
    version: 1,
    name: 'Scene then parallel lights',
    nodes: [
      ...TRIGGERS,
      {
        id: 'act_scene_create',
        type: 'action',
        position: { x: 300, y: 100 },
        data: { service: 'scene.create' },
      },
      {
        id: 'act_l1',
        type: 'action',
        position: { x: 600, y: 0 },
        data: { service: 'light.turn_on', target: { entity_id: 'light.one' } },
      },
      {
        id: 'act_l2',
        type: 'action',
        position: { x: 600, y: 150 },
        data: { service: 'light.turn_on', target: { entity_id: 'light.two' } },
      },
      {
        id: 'act_l3',
        type: 'action',
        position: { x: 600, y: 300 },
        data: { service: 'light.turn_on', target: { entity_id: 'light.three' } },
      },
    ],
    edges: [
      { id: 'e0', source: 'trigger_0', target: 'act_scene_create' },
      { id: 'e1', source: 'trigger_1', target: 'act_scene_create' },
      { id: 'e2', source: 'act_scene_create', target: 'act_l1' },
      { id: 'e3', source: 'act_scene_create', target: 'act_l2' },
      { id: 'e4', source: 'act_scene_create', target: 'act_l3' },
    ],
  };

  it('emits every downstream branch, not just the first', () => {
    const { yaml, output } = new FlowTranspiler().transpile(flow, {
      forceStrategy: 'state-machine',
    });

    expect(output?.strategy).toBe('state-machine');
    // All three lights must survive generation
    expect(yaml).toContain('light.one');
    expect(yaml).toContain('light.two');
    expect(yaml).toContain('light.three');
    // and they must be fanned out, not chained
    expect(yaml).toContain('parallel:');
  });

  it('round-trips all three fan-out edges back into the graph', async () => {
    const { yaml } = new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });
    if (!yaml) throw new Error('expected generated yaml');
    const result = await new YamlParser().parse(yaml);

    expect(result.success).toBe(true);
    const graph = result.graph;
    if (!graph) throw new Error('expected a parsed flow');

    const fanOutTargets = graph.edges
      .filter((e) => e.source === 'act_scene_create')
      .map((e) => e.target)
      .sort();

    expect(fanOutTargets).toEqual(['act_l1', 'act_l2', 'act_l3']);

    // Each branch node comes back as a real action node
    for (const id of ['act_l1', 'act_l2', 'act_l3']) {
      const node = graph.nodes.find((n) => n.id === id);
      expect(node, `expected node ${id}`).toBeDefined();
      expect(node?.type).toBe('action');
    }
  });

  it('does not emit branch nodes twice as standalone state entries', () => {
    const { yaml } = new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });

    // Each inlined branch node appears once, inside the parallel block, and not
    // also as its own dispatcher entry. Note YAML escapes the inner quotes, so
    // the dispatcher form is `current_node == \\"act_l1\\"`.
    for (const id of ['act_l1', 'act_l2', 'act_l3']) {
      expect(yaml).toContain(`parallel_branch:${id}`);
      expect(yaml).not.toContain(`current_node == \\"${id}\\"`);
    }
    // The fan-out source itself still has a dispatcher entry
    expect(yaml).toContain('current_node == \\"act_scene_create\\"');
  });

  it('leaves condition branches alone instead of treating them as fan-out', async () => {
    // A condition's two outgoing edges are branches, not parallel fan-out, so
    // both targets must keep their own dispatcher entries.
    const branching: FlowGraph = {
      id: '44444444-5555-4666-8777-888888888888',
      version: 1,
      name: 'Condition branches',
      nodes: [
        ...TRIGGERS,
        {
          id: 'cond_1',
          type: 'condition',
          position: { x: 300, y: 100 },
          data: { condition: 'state', entity_id: 'binary_sensor.c', state: 'on' },
        },
        {
          id: 'act_true',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on' },
        },
        {
          id: 'act_false',
          type: 'action',
          position: { x: 600, y: 200 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'cond_1' },
        { id: 'e1', source: 'trigger_1', target: 'cond_1' },
        { id: 'e2', source: 'cond_1', target: 'act_true', sourceHandle: 'true' },
        { id: 'e3', source: 'cond_1', target: 'act_false', sourceHandle: 'false' },
      ],
    };

    const { yaml } = new FlowTranspiler().transpile(branching, {
      forceStrategy: 'state-machine',
    });
    if (!yaml) throw new Error('expected generated yaml');

    // Both branch targets keep standalone dispatcher entries and are not
    // swallowed into a parallel block.
    expect(yaml).toContain('current_node == \\"act_true\\"');
    expect(yaml).toContain('current_node == \\"act_false\\"');
    expect(yaml).not.toContain('parallel:');

    const result = await new YamlParser().parse(yaml);
    const trueEdge = result.graph?.edges.find(
      (e) => e.source === 'cond_1' && e.sourceHandle === 'true'
    );
    const falseEdge = result.graph?.edges.find(
      (e) => e.source === 'cond_1' && e.sourceHandle === 'false'
    );
    expect(trueEdge?.target).toBe('act_true');
    expect(falseEdge?.target).toBe('act_false');
  });

  it('warns when parallel branches re-join instead of silently duplicating work', () => {
    const joining: FlowGraph = {
      ...flow,
      nodes: [
        ...flow.nodes,
        {
          id: 'act_join',
          type: 'action',
          position: { x: 900, y: 150 },
          data: { service: 'notify.persistent_notification' },
        },
      ],
      edges: [
        ...flow.edges,
        { id: 'e5', source: 'act_l1', target: 'act_join' },
        { id: 'e6', source: 'act_l2', target: 'act_join' },
      ],
    };

    const { warnings } = new FlowTranspiler().transpile(joining, {
      forceStrategy: 'state-machine',
    });

    expect(warnings.some((w) => w.includes('act_join'))).toBe(true);
  });
});

describe('Issue #212 - set_variables nodes are lost on re-import', () => {
  const flow: FlowGraph = {
    id: '22222222-3333-4444-8555-666666666666',
    version: 1,
    name: 'Set variables then act',
    nodes: [
      ...TRIGGERS,
      {
        id: 'set_vars_1',
        type: 'set_variables',
        position: { x: 300, y: 100 },
        data: {
          alias: 'Extract spoken text',
          variables: { s: '{{ trigger.event.data.text.lower() }}' },
        },
      },
      {
        id: 'act_light',
        type: 'action',
        position: { x: 600, y: 100 },
        data: { service: 'light.turn_on' },
      },
    ],
    edges: [
      { id: 'e0', source: 'trigger_0', target: 'set_vars_1' },
      { id: 'e1', source: 'trigger_1', target: 'set_vars_1' },
      { id: 'e2', source: 'set_vars_1', target: 'act_light' },
    ],
  };

  it('round-trips a set_variables node as set_variables, not an empty action', async () => {
    const { yaml, output } = new FlowTranspiler().transpile(flow, {
      forceStrategy: 'state-machine',
    });
    expect(output?.strategy).toBe('state-machine');
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    expect(result.success).toBe(true);

    const node = result.graph?.nodes.find((n) => n.id === 'set_vars_1');
    // Before the fix this came back as an `action` node with empty data
    if (node?.type !== 'set_variables') {
      throw new Error(`expected a set_variables node, got ${node?.type ?? 'nothing'}`);
    }
    expect(node.data.variables).toEqual({ s: '{{ trigger.event.data.text.lower() }}' });
    expect(node.data.alias).toBe('Extract spoken text');
  });

  it('keeps the transition out of the set_variables node', async () => {
    const { yaml } = new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });
    if (!yaml) throw new Error('expected generated yaml');
    const result = await new YamlParser().parse(yaml);

    const outgoing = result.graph?.edges.filter((e) => e.source === 'set_vars_1') ?? [];
    expect(outgoing.map((e) => e.target)).toEqual(['act_light']);
  });

  it('round-trips a set_variables node inlined inside a parallel branch', async () => {
    const parallelFlow: FlowGraph = {
      id: '33333333-4444-4555-8666-777777777777',
      version: 1,
      name: 'Parallel with set variables',
      nodes: [
        ...TRIGGERS,
        {
          id: 'set_vars_branch',
          type: 'set_variables',
          position: { x: 400, y: 0 },
          data: { variables: { mode: 'night' } },
        },
        {
          id: 'act_other',
          type: 'action',
          position: { x: 400, y: 200 },
          data: { service: 'switch.turn_on' },
        },
      ],
      // trigger_0 fans out to both, forcing them to be inlined in a parallel block
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'set_vars_branch' },
        { id: 'e1', source: 'trigger_0', target: 'act_other' },
        { id: 'e2', source: 'trigger_1', target: 'act_other' },
      ],
    };

    const { yaml } = new FlowTranspiler().transpile(parallelFlow, {
      forceStrategy: 'state-machine',
    });
    if (!yaml) throw new Error('expected generated yaml');
    const result = await new YamlParser().parse(yaml);

    const node = result.graph?.nodes.find((n) => n.id === 'set_vars_branch');
    if (node?.type !== 'set_variables') {
      throw new Error(`expected a set_variables node, got ${node?.type ?? 'nothing'}`);
    }
    expect(node.data.variables).toEqual({ mode: 'night' });
  });
});

/**
 * The fan-out rewrite removes a node's standalone dispatcher entry when it is
 * inlined into a parallel branch. These cases guard the situations where doing
 * so would break a previously working automation.
 */
describe('fan-out safety: never delete a dispatcher entry something still jumps to', () => {
  const transpile = (flow: FlowGraph) =>
    new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });

  it('does not empty the choose block when a branch loops back to the fan-out source', async () => {
    // A → B, A → C, B → A. Naive reachability marks A itself as consumed.
    const flow: FlowGraph = {
      id: '55555555-6666-4777-8888-999999999999',
      version: 1,
      name: 'Back edge into fan-out source',
      nodes: [
        ...TRIGGERS,
        {
          id: 'A',
          type: 'action',
          position: { x: 300, y: 100 },
          data: { service: 'light.turn_on' },
        },
        {
          id: 'B',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'switch.turn_on' },
        },
        {
          id: 'C',
          type: 'action',
          position: { x: 600, y: 200 },
          data: { service: 'switch.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'A' },
        { id: 'e2', source: 'A', target: 'B' },
        { id: 'e3', source: 'A', target: 'C' },
        { id: 'e4', source: 'B', target: 'A' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // Every node keeps a dispatcher entry — the choose block must not be empty
    for (const id of ['A', 'B', 'C']) {
      expect(yaml).toContain(`current_node == \\"${id}\\"`);
    }
    expect(yaml).not.toContain('choose: []');

    // and the YAML must still re-import cleanly
    const result = await new YamlParser().parse(yaml);
    expect(result.errors ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('keeps a branch node reachable from another trigger addressable', async () => {
    // trigger_1 routes straight to B while A also fans out to B.
    const flow: FlowGraph = {
      id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
      version: 1,
      name: 'Shared branch target',
      nodes: [
        ...TRIGGERS,
        { id: 'A', type: 'action', position: { x: 300, y: 0 }, data: { service: 'scene.create' } },
        { id: 'B', type: 'action', position: { x: 600, y: 0 }, data: { service: 'light.turn_on' } },
        {
          id: 'C',
          type: 'action',
          position: { x: 600, y: 200 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'B' },
        { id: 'e2', source: 'A', target: 'B' },
        { id: 'e3', source: 'A', target: 'C' },
      ],
    };

    const { yaml, warnings } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // B is still routed to by trigger_1, so it must keep its own entry
    expect(yaml).toContain('current_node == \\"B\\"');
    // and the user is told why the fan-out could not be parallelized
    expect(warnings.some((w) => w.includes('A'))).toBe(true);

    const result = await new YamlParser().parse(yaml);
    expect(result.success).toBe(true);
  });

  it('keeps a branch node reachable from an unrelated predecessor addressable', async () => {
    const flow: FlowGraph = {
      id: '77777777-8888-4999-8aaa-bbbbbbbbbbbb',
      version: 1,
      name: 'Shared branch target via node',
      nodes: [
        ...TRIGGERS,
        { id: 'A', type: 'action', position: { x: 300, y: 0 }, data: { service: 'scene.create' } },
        { id: 'D', type: 'action', position: { x: 300, y: 300 }, data: { service: 'scene.apply' } },
        { id: 'B', type: 'action', position: { x: 600, y: 0 }, data: { service: 'light.turn_on' } },
        {
          id: 'C',
          type: 'action',
          position: { x: 600, y: 200 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'D' },
        { id: 'e2', source: 'A', target: 'B' },
        { id: 'e3', source: 'A', target: 'C' },
        { id: 'e4', source: 'D', target: 'B' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // D transitions to B, so B must remain dispatchable
    expect(yaml).toContain('current_node == \\"B\\"');

    const result = await new YamlParser().parse(yaml);
    expect(result.errors ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('round-trips a nested fan-out inside a parallel branch', async () => {
    // A → B, A → C ; B → D, B → E  (fan-out nested inside a branch)
    const flow: FlowGraph = {
      id: '88888888-9999-4aaa-8bbb-cccccccccccc',
      version: 1,
      name: 'Nested fan-out',
      nodes: [
        ...TRIGGERS,
        {
          id: 'A',
          type: 'action',
          position: { x: 300, y: 100 },
          data: { service: 'scene.create' },
        },
        { id: 'B', type: 'action', position: { x: 600, y: 0 }, data: { service: 'light.turn_on' } },
        {
          id: 'C',
          type: 'action',
          position: { x: 600, y: 300 },
          data: { service: 'light.turn_off' },
        },
        {
          id: 'D',
          type: 'action',
          position: { x: 900, y: -100 },
          data: { service: 'switch.turn_on' },
        },
        {
          id: 'E',
          type: 'action',
          position: { x: 900, y: 100 },
          data: { service: 'switch.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'A' },
        { id: 'e2', source: 'A', target: 'B' },
        { id: 'e3', source: 'A', target: 'C' },
        { id: 'e4', source: 'B', target: 'D' },
        { id: 'e5', source: 'B', target: 'E' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    // Previously the nested parallel produced a dangling synthetic node id
    expect(result.errors ?? []).toEqual([]);
    expect(result.success).toBe(true);

    for (const id of ['A', 'B', 'C', 'D', 'E']) {
      expect(
        result.graph?.nodes.find((n) => n.id === id),
        `node ${id}`
      ).toBeDefined();
    }

    const nested = (result.graph?.edges ?? [])
      .filter((e) => e.source === 'B')
      .map((e) => e.target)
      .sort();
    expect(nested).toEqual(['D', 'E']);
  });

  it('preserves a user alias on a single-action parallel branch', async () => {
    const flow: FlowGraph = {
      id: '99999999-aaaa-4bbb-8ccc-dddddddddddd',
      version: 1,
      name: 'Aliased branch',
      nodes: [
        ...TRIGGERS,
        {
          id: 'A',
          type: 'action',
          position: { x: 300, y: 100 },
          data: { service: 'scene.create' },
        },
        {
          id: 'B',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on', alias: 'Kitchen lights' },
        },
        {
          id: 'C',
          type: 'action',
          position: { x: 600, y: 200 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'A' },
        { id: 'e2', source: 'A', target: 'B' },
        { id: 'e3', source: 'A', target: 'C' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');
    const result = await new YamlParser().parse(yaml);

    const b = result.graph?.nodes.find((n) => n.id === 'B');
    expect(b?.data.alias).toBe('Kitchen lights');
  });

  it('treats duplicate edges to the same target as a single branch', () => {
    const flow: FlowGraph = {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      version: 1,
      name: 'Duplicate edges',
      nodes: [
        ...TRIGGERS,
        {
          id: 'A',
          type: 'action',
          position: { x: 300, y: 100 },
          data: { service: 'scene.create' },
        },
        { id: 'B', type: 'action', position: { x: 600, y: 0 }, data: { service: 'light.turn_on' } },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'A' },
        { id: 'e2', source: 'A', target: 'B' },
        { id: 'e3', source: 'A', target: 'B' },
      ],
    };

    const { yaml, warnings } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // One duplicated target is not a fan-out — B must run once
    expect(yaml.match(/parallel_branch:B/g) ?? []).toHaveLength(0);
    expect(warnings.some((w) => w.includes('reachable from more than one parallel branch'))).toBe(
      false
    );
  });

  it('warns about duplicate execution when trigger-level branches re-join', () => {
    // trigger_0 → X and Y, both leading to Z: Z is inlined in both branches
    const flow: FlowGraph = {
      id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
      version: 1,
      name: 'Trigger parallel join',
      nodes: [
        ...TRIGGERS,
        { id: 'X', type: 'action', position: { x: 300, y: 0 }, data: { service: 'light.turn_on' } },
        {
          id: 'Y',
          type: 'action',
          position: { x: 300, y: 200 },
          data: { service: 'light.turn_off' },
        },
        {
          id: 'Z',
          type: 'action',
          position: { x: 600, y: 100 },
          data: { service: 'notify.notify' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'X' },
        { id: 'e1', source: 'trigger_0', target: 'Y' },
        { id: 'e2', source: 'trigger_1', target: 'X' },
        { id: 'e3', source: 'X', target: 'Z' },
        { id: 'e4', source: 'Y', target: 'Z' },
      ],
    };

    const { warnings } = transpile(flow);
    expect(warnings.some((w) => w.includes('Z'))).toBe(true);
  });
});
