import { isReservedVariableName, validateNodeData } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

/**
 * The state machine stores its program counter in `current_node`, which is how
 * the parser tells a transition apart from a user "Set Variables" node.
 */
describe('Issue #243 - reserved transpiler variable names', () => {
  it('flags only the name the parser actually disambiguates on', () => {
    expect(isReservedVariableName('current_node')).toBe(true);
    expect(isReservedVariableName('  current_node  ')).toBe(true);
    expect(isReservedVariableName('my_variable')).toBe(false);
    expect(isReservedVariableName('current_node_2')).toBe(false);
    // flow_context is written by the strategy but only ever alongside
    // current_node, so it stays unambiguous and must not be reserved —
    // reserving it would flag existing flows that use the name legitimately.
    expect(isReservedVariableName('flow_context')).toBe(false);
  });

  it('rejects a set_variables node that shadows a reserved name', () => {
    const errors = validateNodeData('set_variables', {
      variables: { current_node: 'oops', other: 1 },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('reserved'))).toBe(true);
  });

  it('still accepts ordinary variables', () => {
    const errors = validateNodeData('set_variables', {
      variables: { brightness: 30, mode: 'night' },
    });
    expect(errors).toEqual([]);
  });

  it('reads a variables item back as set_variables when it carries extra keys', async () => {
    // A transition holds only current_node/flow_context. Anything else is a
    // user node, even if one of its variables happens to be named current_node.
    const yaml = `
alias: Reserved name collision
triggers:
  - trigger: state
    entity_id: [binary_sensor.a]
  - trigger: state
    entity_id: [binary_sensor.b]
actions:
  - variables:
      current_node: set_vars_1
      flow_context: {}
  - alias: State Machine Loop
    repeat:
      until: "{{ current_node == \\"END\\" }}"
      sequence:
        - choose:
            - conditions:
                - condition: template
                  value_template: "{{ current_node == \\"set_vars_1\\" }}"
              sequence:
                - variables:
                    current_node: shadowed
                    other: 1
                - variables:
                    current_node: END
mode: single
`;

    const result = await new YamlParser().parse(yaml);
    expect(result.success).toBe(true);

    const node = result.graph?.nodes.find((n) => n.id === 'set_vars_1');
    if (node?.type !== 'set_variables') {
      throw new Error(`expected a set_variables node, got ${node?.type ?? 'nothing'}`);
    }
    expect(node.data.variables).toEqual({ current_node: 'shadowed', other: 1 });
  });

  it('still treats a bare current_node item as a transition', async () => {
    const flow = {
      id: 'ffffffff-0000-4111-8222-000000000001',
      version: 1 as const,
      name: 'Plain transition',
      nodes: [
        {
          id: 'trigger_0',
          type: 'trigger' as const,
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: ['binary_sensor.a'] },
        },
        {
          id: 'trigger_1',
          type: 'trigger' as const,
          position: { x: 0, y: 200 },
          data: { trigger: 'state', entity_id: ['binary_sensor.b'] },
        },
        {
          id: 'act_1',
          type: 'action' as const,
          position: { x: 300, y: 0 },
          data: { service: 'light.turn_on' },
        },
        {
          id: 'act_2',
          type: 'action' as const,
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e0', source: 'trigger_0', target: 'act_1' },
        { id: 'e1', source: 'trigger_1', target: 'act_1' },
        { id: 'e2', source: 'act_1', target: 'act_2' },
      ],
    };

    const { yaml } = new FlowTranspiler().transpile(flow, { forceStrategy: 'state-machine' });
    if (!yaml) throw new Error('expected generated yaml');

    const result = await new YamlParser().parse(yaml);
    // act_1 must stay an action node whose transition points at act_2
    const node = result.graph?.nodes.find((n) => n.id === 'act_1');
    expect(node?.type).toBe('action');
    const outgoing = (result.graph?.edges ?? []).filter((e) => e.source === 'act_1');
    expect(outgoing.map((e) => e.target)).toEqual(['act_2']);
  });
});
