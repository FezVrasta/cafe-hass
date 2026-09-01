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

    // B is still routed to by trigger_1, so it must keep its own entry...
    expect(yaml).toContain('current_node == \\"B\\"');
    // ...while A still fans out to both branches. Being emitted in both places
    // is correct: the two executions belong to different runs.
    expect(yaml).toContain('parallel_branch:B');
    expect(yaml).toContain('parallel_branch:C');
    // Nothing is lost, so there is nothing to warn about
    expect(warnings).toEqual([]);

    const result = await new YamlParser().parse(yaml);
    expect(result.success).toBe(true);

    const pairs = (result.graph?.edges ?? []).map((e) => `${e.source}->${e.target}`).sort();
    expect(pairs).toEqual(['A->B', 'A->C', 'trigger_0->A', 'trigger_1->B']);
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
    expect(warnings.some((w) => w.includes('re-join'))).toBe(false);
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
    expect(warnings.some((w) => w.includes('re-join at [Z]'))).toBe(true);
  });
});

/**
 * A fan-out claims its subgraph, so planning order decides who wins. These
 * guard the diagnostics and determinism of that planning.
 */
describe('fan-out planning is deterministic and honestly reported', () => {
  const transpile = (flow: FlowGraph) =>
    new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });

  /** A → B, A → C, B → D, B → E — a two-level fan-out. */
  const twoLevelNodes: FlowGraph['nodes'] = [
    ...TRIGGERS,
    { id: 'A', type: 'action', position: { x: 300, y: 100 }, data: { service: 'scene.create' } },
    { id: 'B', type: 'action', position: { x: 600, y: 0 }, data: { service: 'light.turn_on' } },
    { id: 'C', type: 'action', position: { x: 600, y: 300 }, data: { service: 'light.turn_off' } },
    { id: 'D', type: 'action', position: { x: 900, y: -100 }, data: { service: 'switch.turn_on' } },
    { id: 'E', type: 'action', position: { x: 900, y: 100 }, data: { service: 'switch.turn_off' } },
  ];
  const twoLevelEdges: FlowGraph['edges'] = [
    { id: 'e0', source: 'trigger_0', target: 'A' },
    { id: 'e1', source: 'trigger_1', target: 'A' },
    { id: 'e2', source: 'A', target: 'B' },
    { id: 'e3', source: 'A', target: 'C' },
    { id: 'e4', source: 'B', target: 'D' },
    { id: 'e5', source: 'B', target: 'E' },
  ];

  it('produces identical output regardless of node array order', async () => {
    const inOrder: FlowGraph = {
      id: 'cccccccc-dddd-4eee-8fff-000000000001',
      version: 1,
      name: 'Two level',
      nodes: twoLevelNodes,
      edges: twoLevelEdges,
    };
    // Nested node B declared before its ancestor A
    const reordered: FlowGraph = {
      ...inOrder,
      nodes: [
        ...TRIGGERS,
        ...['B', 'A', 'C', 'D', 'E'].map(
          (id) => twoLevelNodes.find((n) => n.id === id) as FlowGraph['nodes'][number]
        ),
      ],
    };

    const a = transpile(inOrder);
    const b = transpile(reordered);
    if (!a.yaml || !b.yaml) throw new Error('expected generated yaml');

    // Node order is a UI detail and must not change the generated automation
    expect(b.yaml).toBe(a.yaml);

    // and no edge may be lost in either ordering
    for (const yaml of [a.yaml, b.yaml]) {
      const parsed = await new YamlParser().parse(yaml);
      const pairs = (parsed.graph?.edges ?? [])
        .filter((e) => !e.source.startsWith('trigger'))
        .map((e) => `${e.source}->${e.target}`)
        .sort();
      expect(pairs).toEqual(['A->B', 'A->C', 'B->D', 'B->E']);
    }
  });

  it('does not warn about a nested fan-out that works correctly', () => {
    const flow: FlowGraph = {
      id: 'cccccccc-dddd-4eee-8fff-000000000002',
      version: 1,
      name: 'Nested no warning',
      nodes: twoLevelNodes,
      edges: twoLevelEdges,
    };

    const { warnings } = transpile(flow);
    // B's branches are not shared and both do run — claiming otherwise is a lie
    expect(warnings.filter((w) => w.includes('only the first branch will run'))).toEqual([]);
  });

  it('still warns when a nested fan-out re-joins', () => {
    // A → B,C ; B → D,E ; D → J ; E → J : J is inlined into both D and E
    const flow: FlowGraph = {
      id: 'cccccccc-dddd-4eee-8fff-000000000003',
      version: 1,
      name: 'Nested join',
      nodes: [
        ...twoLevelNodes,
        {
          id: 'J',
          type: 'action',
          position: { x: 1200, y: 0 },
          data: { service: 'notify.notify' },
        },
      ],
      edges: [
        ...twoLevelEdges,
        { id: 'e6', source: 'D', target: 'J' },
        { id: 'e7', source: 'E', target: 'J' },
      ],
    };

    const { warnings } = transpile(flow);
    expect(warnings.some((w) => w.includes('re-join at [J]'))).toBe(true);
  });

  it('de-dupes duplicate edges inside a nested branch', async () => {
    const flow: FlowGraph = {
      id: 'cccccccc-dddd-4eee-8fff-000000000004',
      version: 1,
      name: 'Nested duplicate edges',
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
          position: { x: 900, y: 0 },
          data: { service: 'switch.turn_on' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'A' },
        { id: 'e2', source: 'A', target: 'B' },
        { id: 'e3', source: 'A', target: 'C' },
        { id: 'e4', source: 'B', target: 'D' },
        { id: 'e5', source: 'B', target: 'D' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // D must be emitted once, not once per duplicate edge
    expect(yaml.match(/parallel_branch:D/g) ?? []).toHaveLength(0);
    expect(yaml.match(/cafe_node:D/g) ?? []).toHaveLength(1);

    const result = await new YamlParser().parse(yaml);
    expect(result.success).toBe(true);
  });

  it('round-trips a single trigger that fans out', async () => {
    // One trigger with several targets yields a bare __parallel_trigger_0 entry
    // rather than a routing template.
    const flow: FlowGraph = {
      id: 'cccccccc-dddd-4eee-8fff-000000000005',
      version: 1,
      name: 'Single trigger fan-out',
      nodes: [
        TRIGGERS[0],
        { id: 'X', type: 'action', position: { x: 300, y: 0 }, data: { service: 'light.turn_on' } },
        {
          id: 'Y',
          type: 'action',
          position: { x: 300, y: 200 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'X' },
        { id: 'e1', source: 'trigger_0', target: 'Y' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    // Previously the trigger edge pointed at the deleted synthetic entry
    expect(result.errors ?? []).toEqual([]);
    expect(result.success).toBe(true);

    const targets = (result.graph?.edges ?? [])
      .filter((e) => e.source === 'trigger_0')
      .map((e) => e.target)
      .sort();
    expect(targets).toEqual(['X', 'Y']);
  });
});

/**
 * Follow-ups from the review of #240: trigger fan-out (#241) and condition
 * handles leading to several nodes (#242).
 */
describe('Issue #241 - trigger fan-out must not strand a shared target', () => {
  const transpile = (flow: FlowGraph) =>
    new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });

  it('keeps a target addressable when a second trigger also routes to it', async () => {
    // trigger_0 → X and Y (fan-out); trigger_1 → X as well
    const flow: FlowGraph = {
      id: 'dddddddd-eeee-4fff-8000-000000000001',
      version: 1,
      name: 'Shared trigger target',
      nodes: [
        ...TRIGGERS,
        { id: 'X', type: 'action', position: { x: 300, y: 0 }, data: { service: 'light.turn_on' } },
        {
          id: 'Y',
          type: 'action',
          position: { x: 300, y: 200 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'X' },
        { id: 'e1', source: 'trigger_0', target: 'Y' },
        { id: 'e2', source: 'trigger_1', target: 'X' },
      ],
    };

    const { yaml, warnings } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // trigger_0 still fans out to both branches...
    expect(yaml).toContain('parallel_branch:X');
    expect(yaml).toContain('parallel_branch:Y');
    // ...and X keeps a dispatcher entry so trigger_1 can still reach it.
    // Without this, trigger_1 hit the "Unknown state" default and did nothing.
    expect(yaml).toContain('current_node == \\"X\\"');
    expect(warnings).toEqual([]);

    const result = await new YamlParser().parse(yaml);
    expect(result.errors ?? []).toEqual([]);
    const pairs = (result.graph?.edges ?? []).map((e) => `${e.source}->${e.target}`).sort();
    expect(pairs).toEqual(['trigger_0->X', 'trigger_0->Y', 'trigger_1->X']);
  });

  it('keeps a target addressable when an unrelated node transitions into it', async () => {
    const flow: FlowGraph = {
      id: 'dddddddd-eeee-4fff-8000-000000000002',
      version: 1,
      name: 'Trigger fan-out with inbound node',
      nodes: [
        ...TRIGGERS,
        { id: 'X', type: 'action', position: { x: 600, y: 0 }, data: { service: 'light.turn_on' } },
        {
          id: 'Y',
          type: 'action',
          position: { x: 600, y: 200 },
          data: { service: 'light.turn_off' },
        },
        { id: 'W', type: 'action', position: { x: 300, y: 400 }, data: { service: 'scene.apply' } },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'X' },
        { id: 'e1', source: 'trigger_0', target: 'Y' },
        { id: 'e2', source: 'trigger_1', target: 'W' },
        { id: 'e3', source: 'W', target: 'X' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // W transitions to X, so X must remain dispatchable rather than dead-ending
    expect(yaml).toContain('current_node == \\"X\\"');

    const result = await new YamlParser().parse(yaml);
    expect(result.errors ?? []).toEqual([]);
  });
});

describe('Issue #242 - a condition handle leading to several nodes', () => {
  const transpile = (flow: FlowGraph) =>
    new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });

  const flow: FlowGraph = {
    id: 'eeeeeeee-ffff-4000-8111-000000000001',
    version: 1,
    name: 'Condition handle fan-out',
    nodes: [
      ...TRIGGERS,
      {
        id: 'cond',
        type: 'condition',
        position: { x: 300, y: 100 },
        data: { condition: 'state', entity_id: 'binary_sensor.c', state: 'on' },
      },
      {
        id: 'P',
        type: 'action',
        position: { x: 600, y: -100 },
        data: { service: 'light.turn_on' },
      },
      { id: 'Q', type: 'action', position: { x: 600, y: 0 }, data: { service: 'switch.turn_on' } },
      {
        id: 'R',
        type: 'action',
        position: { x: 600, y: 200 },
        data: { service: 'light.turn_off' },
      },
    ],
    edges: [
      { id: 'e0', source: 'trigger_0', target: 'cond' },
      { id: 'e1', source: 'trigger_1', target: 'cond' },
      { id: 'e2', source: 'cond', target: 'P', sourceHandle: 'true' },
      { id: 'e3', source: 'cond', target: 'Q', sourceHandle: 'true' },
      { id: 'e4', source: 'cond', target: 'R', sourceHandle: 'false' },
    ],
  };

  it('runs every target on the handle instead of only the first', () => {
    const { yaml, warnings } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // Previously the second edge on the 'true' handle was dropped by a .find()
    expect(yaml).toContain('light.turn_on');
    expect(yaml).toContain('switch.turn_on');
    expect(yaml).toContain('light.turn_off');
    expect(warnings).toEqual([]);
  });

  it('round-trips both handle targets with their handle intact', async () => {
    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    expect(result.errors ?? []).toEqual([]);

    const fromCondition = (result.graph?.edges ?? [])
      .filter((e) => e.source === 'cond')
      .map((e) => `${e.sourceHandle}:${e.target}`)
      .sort();
    expect(fromCondition).toEqual(['false:R', 'true:P', 'true:Q']);
  });

  it('leaves no synthetic parallel node behind in the graph', async () => {
    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    const synthetic = (result.graph?.nodes ?? []).filter((n) => n.id.startsWith('__parallel_'));
    expect(synthetic).toEqual([]);
  });
});

/**
 * Inlining a branch removes its dispatcher entries, so an entry may only be
 * dropped when EVERY path into it is inlined too. These cover the cases where
 * a surviving entry would otherwise transition to a deleted one.
 */
describe('fan-out ownership must hold for whole paths, not single nodes', () => {
  const transpile = (flow: FlowGraph) =>
    new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });

  /** Every `current_node: X` a block sets must have a matching dispatcher entry. */
  const expectNoDanglingStates = (yaml: string) => {
    const referenced = [...yaml.matchAll(/current_node:\s*([A-Za-z_][\w]*)\s*$/gm)]
      .map((m) => m[1])
      .filter((id) => id !== 'END');
    for (const id of new Set(referenced)) {
      expect(yaml, `state "${id}" is set but has no dispatcher entry`).toContain(
        `current_node == \\"${id}\\"`
      );
    }
  };

  it('does not orphan a descendant when the branch root keeps its entry', () => {
    // node_O fans out to node_A and node_Z, but node_P also reaches node_A.
    // node_A keeps its entry, so node_B behind it must keep one too.
    const flow: FlowGraph = {
      id: '00000000-1111-4222-8333-000000000001',
      version: 1,
      name: 'Descendant of a shared branch root',
      nodes: [
        ...TRIGGERS,
        {
          id: 'cond_gate',
          type: 'condition',
          position: { x: 200, y: 100 },
          data: { condition: 'state', entity_id: 'binary_sensor.g', state: 'on' },
        },
        { id: 'node_O', type: 'action', position: { x: 400, y: 0 }, data: { service: 'switch.o' } },
        {
          id: 'node_P',
          type: 'action',
          position: { x: 400, y: 300 },
          data: { service: 'switch.p' },
        },
        { id: 'node_A', type: 'action', position: { x: 700, y: 0 }, data: { service: 'scene.a' } },
        { id: 'node_B', type: 'action', position: { x: 900, y: 0 }, data: { service: 'notify.b' } },
        {
          id: 'node_Z',
          type: 'action',
          position: { x: 700, y: 200 },
          data: { service: 'light.z' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'cond_gate' },
        { id: 'e1', source: 'trigger_1', target: 'cond_gate' },
        { id: 'e2', source: 'cond_gate', target: 'node_O', sourceHandle: 'true' },
        { id: 'e3', source: 'cond_gate', target: 'node_P', sourceHandle: 'false' },
        { id: 'e4', source: 'node_O', target: 'node_A' },
        { id: 'e5', source: 'node_O', target: 'node_Z' },
        { id: 'e6', source: 'node_P', target: 'node_A' },
        { id: 'e7', source: 'node_A', target: 'node_B' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // node_P -> node_A -> node_B must all remain dispatchable
    expect(yaml).toContain('current_node == \\"node_A\\"');
    expect(yaml).toContain('current_node == \\"node_B\\"');
    expect(yaml).toContain('notify.b');
    expectNoDanglingStates(yaml);
  });

  it('does not orphan a descendant of a trigger fan-out target', () => {
    // trigger_0 fans out to A and Z; trigger_1 reaches A through P.
    const flow: FlowGraph = {
      id: '00000000-1111-4222-8333-000000000002',
      version: 1,
      name: 'Trigger fan-out with shared descendant',
      nodes: [
        ...TRIGGERS,
        { id: 'A', type: 'action', position: { x: 400, y: 0 }, data: { service: 'scene.a' } },
        { id: 'B', type: 'action', position: { x: 700, y: 0 }, data: { service: 'notify.b' } },
        { id: 'Z', type: 'action', position: { x: 400, y: 200 }, data: { service: 'light.z' } },
        { id: 'P', type: 'action', position: { x: 200, y: 400 }, data: { service: 'switch.p' } },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_0', target: 'Z' },
        { id: 'e2', source: 'trigger_1', target: 'P' },
        { id: 'e3', source: 'P', target: 'A' },
        { id: 'e4', source: 'A', target: 'B' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    expect(yaml).toContain('current_node == \\"A\\"');
    expect(yaml).toContain('current_node == \\"B\\"');
    expectNoDanglingStates(yaml);
  });

  it("keeps a target reachable from the condition's other handle dispatchable", () => {
    // X -true-> B, X -true-> C, X -false-> B.
    // The false edge is an outside path into B even though it starts at X.
    const flow: FlowGraph = {
      id: '00000000-1111-4222-8333-000000000003',
      version: 1,
      name: 'Handle fan-out sharing a target with the other handle',
      nodes: [
        ...TRIGGERS,
        {
          id: 'X',
          type: 'condition',
          position: { x: 300, y: 100 },
          data: { condition: 'state', entity_id: 'binary_sensor.x', state: 'on' },
        },
        { id: 'B', type: 'action', position: { x: 600, y: 0 }, data: { service: 'light.bbb' } },
        { id: 'C', type: 'action', position: { x: 600, y: 200 }, data: { service: 'light.ccc' } },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'X' },
        { id: 'e1', source: 'trigger_1', target: 'X' },
        { id: 'e2', source: 'X', target: 'B', sourceHandle: 'true' },
        { id: 'e3', source: 'X', target: 'C', sourceHandle: 'true' },
        { id: 'e4', source: 'X', target: 'B', sourceHandle: 'false' },
      ],
    };

    const { yaml } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // The false branch sets current_node: B, so B needs an entry
    expect(yaml).toContain('current_node == \\"B\\"');
    expect(yaml).toContain('light.ccc');
    expectNoDanglingStates(yaml);
  });

  it('treats duplicate trigger edges as one branch instead of a false re-join', () => {
    const flow: FlowGraph = {
      id: '00000000-1111-4222-8333-000000000004',
      version: 1,
      name: 'Duplicate trigger edges',
      nodes: [
        TRIGGERS[0],
        { id: 'A', type: 'action', position: { x: 300, y: 0 }, data: { service: 'light.aaa' } },
        { id: 'B', type: 'action', position: { x: 300, y: 200 }, data: { service: 'light.bbb' } },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_0', target: 'A' },
        { id: 'e2', source: 'trigger_0', target: 'B' },
      ],
    };

    const { yaml, warnings } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // Both targets must still run; the duplicate edge is not a re-join
    expect(yaml).toContain('light.aaa');
    expect(yaml).toContain('light.bbb');
    expect(warnings.some((w) => w.includes('re-join'))).toBe(false);
    expectNoDanglingStates(yaml);
  });

  it('keeps a condition with a multi-target handle out of an inlined branch', () => {
    // A fans out to X and Y, but X is a condition whose true handle has two
    // targets — that cannot be represented inline without losing an edge.
    const flow: FlowGraph = {
      id: '00000000-1111-4222-8333-000000000005',
      version: 1,
      name: 'Condition fan-out inside a branch',
      nodes: [
        ...TRIGGERS,
        { id: 'A', type: 'action', position: { x: 200, y: 100 }, data: { service: 'scene.a' } },
        {
          id: 'X',
          type: 'condition',
          position: { x: 500, y: 0 },
          data: { condition: 'state', entity_id: 'binary_sensor.x', state: 'on' },
        },
        { id: 'B', type: 'action', position: { x: 800, y: -100 }, data: { service: 'light.bbb' } },
        { id: 'C', type: 'action', position: { x: 800, y: 100 }, data: { service: 'light.ccc' } },
        { id: 'Y', type: 'action', position: { x: 500, y: 300 }, data: { service: 'light.yyy' } },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'A' },
        { id: 'e2', source: 'A', target: 'X' },
        { id: 'e3', source: 'A', target: 'Y' },
        { id: 'e4', source: 'X', target: 'B', sourceHandle: 'true' },
        { id: 'e5', source: 'X', target: 'C', sourceHandle: 'true' },
      ],
    };

    const { yaml, warnings } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    // Neither branch of the condition may silently vanish
    expect(yaml).toContain('light.bbb');
    expect(yaml).toContain('light.ccc');
    // and the user is told why A could not be parallelized
    expect(warnings.some((w) => w.includes('X'))).toBe(true);
    expectNoDanglingStates(yaml);
  });

  it('describes a nested re-join as duplication rather than a dropped branch', () => {
    // A -> X,Y ; X -> J1,J2 ; both J -> K. The nested fan-out is inlined anyway,
    // so K really does run once per branch.
    const flow: FlowGraph = {
      id: '00000000-1111-4222-8333-000000000006',
      version: 1,
      name: 'Nested re-join',
      nodes: [
        ...TRIGGERS,
        { id: 'A', type: 'action', position: { x: 200, y: 100 }, data: { service: 'scene.a' } },
        { id: 'X', type: 'action', position: { x: 500, y: 0 }, data: { service: 'switch.x' } },
        { id: 'Y', type: 'action', position: { x: 500, y: 300 }, data: { service: 'switch.y' } },
        { id: 'J1', type: 'action', position: { x: 800, y: -100 }, data: { service: 'light.j1' } },
        { id: 'J2', type: 'action', position: { x: 800, y: 100 }, data: { service: 'light.j2' } },
        { id: 'K', type: 'action', position: { x: 1100, y: 0 }, data: { service: 'notify.kkk' } },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'A' },
        { id: 'e1', source: 'trigger_1', target: 'A' },
        { id: 'e2', source: 'A', target: 'X' },
        { id: 'e3', source: 'A', target: 'Y' },
        { id: 'e4', source: 'X', target: 'J1' },
        { id: 'e5', source: 'X', target: 'J2' },
        { id: 'e6', source: 'J1', target: 'K' },
        { id: 'e7', source: 'J2', target: 'K' },
      ],
    };

    const { yaml, warnings } = transpile(flow);
    if (!yaml) throw new Error('expected generated yaml');

    const nested = warnings.find((w) => w.includes('X'));
    expect(nested).toBeDefined();
    // The old message claimed "only the first branch will run", which was the
    // opposite of what happens: the join node is emitted once per branch.
    expect(nested).toContain('once per branch');
    expect(nested).not.toContain('only the first branch will run');
  });
});
