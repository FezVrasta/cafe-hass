import type { FlowGraph } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

/**
 * A condition whose template is too complex to inline into `{% if %}` is written
 * as a real `if:` / `then:` / `else:` block inside its dispatcher entry rather
 * than as a `variables: {current_node: ...}` transition. The parser had no branch
 * for that shape, so the condition came back as an action node and everything
 * downstream of it lost its edges (#245).
 */
describe('Issue #245 - native-condition blocks round-trip in the state machine', () => {
  /** Two triggers force the state-machine strategy. */
  const flow: FlowGraph = {
    id: '99999999-8888-4777-8666-555555555555',
    version: 1,
    name: 'Native condition round trip',
    nodes: [
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
      {
        id: 'cond_native',
        type: 'condition',
        position: { x: 300, y: 100 },
        data: {
          condition: 'template',
          alias: 'Complex template',
          // `{% set %}` is what sends this down the native-condition route
          value_template: "{% set threshold = 20 %}{{ states('sensor.temp') | int > threshold }}",
        },
      },
      {
        id: 'act_true',
        type: 'action',
        position: { x: 600, y: 0 },
        data: { service: 'light.turn_on', target: { entity_id: 'light.yes' } },
      },
      {
        id: 'act_false',
        type: 'action',
        position: { x: 600, y: 200 },
        data: { service: 'light.turn_off', target: { entity_id: 'light.no' } },
      },
    ],
    edges: [
      { id: 'e0', source: 'trigger_0', target: 'cond_native' },
      { id: 'e1', source: 'trigger_1', target: 'cond_native' },
      { id: 'e2', source: 'cond_native', target: 'act_true', sourceHandle: 'true' },
      { id: 'e3', source: 'cond_native', target: 'act_false', sourceHandle: 'false' },
    ],
  };

  it('writes the condition as a native if block', () => {
    const { yaml, output } = new FlowTranspiler().transpile(flow, {
      forceStrategy: 'state-machine',
    });

    expect(output?.strategy).toBe('state-machine');
    expect(yaml).toContain('if:');
    expect(yaml).toContain('value_template');
  });

  it('reads that block back as a condition node with both branches', async () => {
    const { yaml } = new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    expect(result.success).toBe(true);

    const graph = result.graph;
    if (!graph) throw new Error('expected a parsed flow');

    const condition = graph.nodes.find((n) => n.id === 'cond_native');
    expect(condition, 'expected the condition node').toBeDefined();
    expect(condition?.type).toBe('condition');

    const handles = graph.edges
      .filter((e) => e.source === 'cond_native')
      .map((e) => `${e.sourceHandle}:${e.target}`)
      .sort();

    expect(handles).toEqual(['false:act_false', 'true:act_true']);
  });

  it('keeps the template and the alias', async () => {
    const { yaml } = new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    const condition = result.graph?.nodes.find((n) => n.id === 'cond_native');
    const data = condition?.data as Record<string, unknown> | undefined;

    expect(data?.condition).toBe('template');
    expect(String(data?.value_template)).toContain('set threshold = 20');
    expect(data?.alias).toBe('Complex template');
  });
  it('round-trips a handle that fans out to several nodes', async () => {
    const fanOut: FlowGraph = {
      ...flow,
      id: '99999999-8888-4777-8666-555555550000',
      nodes: [
        ...flow.nodes,
        {
          id: 'act_true_2',
          type: 'action',
          position: { x: 600, y: 100 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.also' } },
        },
      ],
      edges: [
        ...flow.edges,
        { id: 'e4', source: 'cond_native', target: 'act_true_2', sourceHandle: 'true' },
      ],
    };

    const { yaml } = new FlowTranspiler().transpile(fanOut, { forceStrategy: 'state-machine' });
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    const graph = result.graph;
    if (!graph) throw new Error('expected a parsed flow');

    const trueTargets = graph.edges
      .filter((e) => e.source === 'cond_native' && e.sourceHandle === 'true')
      .map((e) => e.target)
      .sort();

    expect(trueTargets).toEqual(['act_true', 'act_true_2']);
  });
});
