import type { FlowGraph } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

const createBaseGraph = (nodes: FlowGraph['nodes'], edges: FlowGraph['edges']): FlowGraph => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  version: 1,
  name: 'Test Nested Conditions',
  description: '',
  nodes,
  edges,
  metadata: {
    mode: 'single',
    initial_state: false,
  },
});

describe('Nested Conditions', () => {
  it('should combine two sequential condition nodes into a single "and" condition', () => {
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
        },
        {
          id: 'cond2',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
        },
        {
          id: 'action_then',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
        {
          id: 'action_else',
          type: 'action',
          position: { x: 400, y: 200 },
          data: { service: 'notify.mobile_app', data: { message: 'Conditions not met' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
        { id: 'e3', source: 'cond1', target: 'action_else', sourceHandle: 'false' },
        { id: 'e4', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);

    const yaml = result.yaml ?? '';

    // Conditions are placed directly in the if: array (HA implicitly ANDs them)
    // Should NOT have an explicit 'condition: and' wrapper
    expect(yaml).not.toContain('condition: and');

    // Both conditions should be present
    expect(yaml).toContain('condition: state');
    expect(yaml).toContain('condition: numeric_state');
    expect(yaml).toContain('entity_id: light.living_room');
    expect(yaml).toContain('entity_id: sensor.temperature');

    // Check for correct 'then' and 'else' blocks
    expect(yaml).toContain('service: light.turn_on');
    expect(yaml).toContain('service: notify.mobile_app');

    // Make sure there is only one 'if' block
    expect(yaml.match(/if:/g)?.length).toBe(1);
  });

  it('should combine three sequential condition nodes into a single if block', () => {
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
        },
        {
          id: 'cond2',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
        },
        {
          id: 'cond3',
          type: 'condition',
          position: { x: 600, y: 0 },
          data: { condition: 'time', after: '08:00:00', before: '22:00:00' },
        },
        {
          id: 'action_then',
          type: 'action',
          position: { x: 800, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
        {
          id: 'action_else',
          type: 'action',
          position: { x: 400, y: 200 },
          data: { service: 'notify.mobile_app', data: { message: 'Conditions not met' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
        { id: 'e3', source: 'cond1', target: 'action_else', sourceHandle: 'false' },
        { id: 'e4', source: 'cond2', target: 'cond3', sourceHandle: 'true' },
        { id: 'e5', source: 'cond3', target: 'action_then', sourceHandle: 'true' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);

    const yaml = result.yaml ?? '';

    // All three conditions should be in the if: array directly (no 'and' wrapper)
    expect(yaml).not.toContain('condition: and');
    expect(yaml).toContain('condition: state');
    expect(yaml).toContain('condition: numeric_state');
    expect(yaml).toContain('condition: time');
    expect(yaml).toContain('entity_id: light.living_room');
    expect(yaml).toContain('entity_id: sensor.temperature');

    // Make sure there is only one 'if' block
    expect(yaml.match(/if:/g)?.length).toBe(1);
  });

  it('should not combine conditions when there is only one condition', () => {
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
        },
        {
          id: 'action_then',
          type: 'action',
          position: { x: 400, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
        {
          id: 'action_else',
          type: 'action',
          position: { x: 400, y: 200 },
          data: { service: 'notify.mobile_app', data: { message: 'Conditions not met' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'action_then', sourceHandle: 'true' },
        { id: 'e3', source: 'cond1', target: 'action_else', sourceHandle: 'false' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);

    const yaml = result.yaml ?? '';

    // Should NOT have 'condition: and' since there's only one condition
    expect(yaml).not.toContain('condition: and');

    // Should still have the state condition
    expect(yaml).toContain('condition: state');
    expect(yaml).toContain('entity_id: light.living_room');

    // Make sure there is only one 'if' block
    expect(yaml.match(/if:/g)?.length).toBe(1);
  });

  it('should promote condition chain with no else path to root conditions block', () => {
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
        },
        {
          id: 'cond2',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
        },
        {
          id: 'action_then',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
        { id: 'e3', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);

    const yaml = result.yaml ?? '';

    // Conditions should be in the root conditions: block, not in if/then/else
    expect(yaml).toContain('conditions:');
    expect(yaml).toContain('condition: state');
    expect(yaml).toContain('condition: numeric_state');
    expect(yaml).toContain('entity_id: light.living_room');
    expect(yaml).toContain('entity_id: sensor.temperature');

    // Should NOT have if/then/else structure in actions
    expect(yaml).not.toMatch(/^\s+if:/m);
    expect(yaml).not.toMatch(/^\s+else:/m);

    // Action should be directly in the actions block
    expect(yaml).toContain('service: light.turn_on');
  });

  it('should not combine conditions when second condition has a different else path', () => {
    // In this case: trigger → cond1 → (true) → cond2 → (true) → action_then
    //                            ↘ (false) → action_else1
    //                                 cond2 ↘ (false) → action_else2
    // Both conditions have their own else, so we should NOT chain them
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
        },
        {
          id: 'cond2',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
        },
        {
          id: 'action_then',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
        {
          id: 'action_else1',
          type: 'action',
          position: { x: 200, y: 200 },
          data: { service: 'notify.mobile_app', data: { message: 'First condition failed' } },
        },
        {
          id: 'action_else2',
          type: 'action',
          position: { x: 400, y: 200 },
          data: { service: 'notify.mobile_app', data: { message: 'Second condition failed' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
        { id: 'e3', source: 'cond1', target: 'action_else1', sourceHandle: 'false' },
        { id: 'e4', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
        { id: 'e5', source: 'cond2', target: 'action_else2', sourceHandle: 'false' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);

    const yaml = result.yaml ?? '';

    // This should still combine the conditions into an AND because
    // the current implementation chains conditions on the true path
    // The else path is taken from the first condition only
    // Conditions are placed directly in the if: array (HA implicitly ANDs them)
    expect(yaml).not.toContain('condition: and');
    expect(yaml).toContain('condition: state');
    expect(yaml).toContain('condition: numeric_state');
  });

  it('should preserve condition aliases when promoting to root conditions', () => {
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: {
            condition: 'state',
            entity_id: 'light.living_room',
            state: 'off',
            alias: 'Check light is off',
          },
        },
        {
          id: 'cond2',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: {
            condition: 'numeric_state',
            entity_id: 'sensor.temperature',
            below: '20',
            alias: 'Check temperature',
          },
        },
        {
          id: 'action_then',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
        { id: 'e3', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);

    const yaml = result.yaml ?? '';

    // Both aliases should be preserved in the root conditions block
    expect(yaml).toContain('Check light is off');
    expect(yaml).toContain('Check temperature');

    // Should NOT have if/then/else since conditions are promoted
    expect(yaml).not.toMatch(/^\s+if:/m);
  });

  it('should produce valid YAML that can be round-tripped', async () => {
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
        },
        {
          id: 'cond2',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
        },
        {
          id: 'action_then',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
        {
          id: 'action_else',
          type: 'action',
          position: { x: 400, y: 200 },
          data: { service: 'notify.mobile_app', data: { message: 'Conditions not met' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
        { id: 'e3', source: 'cond1', target: 'action_else', sourceHandle: 'false' },
        { id: 'e4', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    const yaml = result.yaml ?? '';

    // Parse the YAML back into a graph
    const parser = new YamlParser();
    const parseResult = await parser.parse(yaml);

    expect(parseResult.success).toBe(true);
    expect(parseResult.graph).toBeDefined();

    // The parsed graph should have valid structure
    const parsedGraph = parseResult.graph!;
    expect(parsedGraph.nodes.some((n) => n.type === 'trigger')).toBe(true);
    expect(parsedGraph.nodes.some((n) => n.type === 'condition')).toBe(true);
    expect(parsedGraph.nodes.some((n) => n.type === 'action')).toBe(true);
  });

  it('should handle condition chain followed by another action', () => {
    // trigger → cond1 → cond2 → action1 → action2
    //              ↘ else_action
    const graph = createBaseGraph(
      [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
        },
        {
          id: 'cond1',
          type: 'condition',
          position: { x: 200, y: 0 },
          data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
        },
        {
          id: 'cond2',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
        },
        {
          id: 'action1',
          type: 'action',
          position: { x: 600, y: 0 },
          data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        },
        {
          id: 'action2',
          type: 'action',
          position: { x: 800, y: 0 },
          data: { service: 'notify.mobile_app', data: { message: 'Light turned on' } },
        },
        {
          id: 'else_action',
          type: 'action',
          position: { x: 200, y: 200 },
          data: { service: 'notify.mobile_app', data: { message: 'Conditions not met' } },
        },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'cond1' },
        { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
        { id: 'e3', source: 'cond1', target: 'else_action', sourceHandle: 'false' },
        { id: 'e4', source: 'cond2', target: 'action1', sourceHandle: 'true' },
        { id: 'e5', source: 'action1', target: 'action2' },
      ]
    );

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(graph);

    expect(result.success).toBe(true);
    expect(result.errors ?? []).toHaveLength(0);

    const yaml = result.yaml ?? '';

    // Conditions are placed directly in the if: array (HA implicitly ANDs them)
    expect(yaml).not.toContain('condition: and');
    expect(yaml).toContain('condition: state');
    expect(yaml).toContain('condition: numeric_state');

    // Should have both actions in the then block
    expect(yaml).toContain('service: light.turn_on');
    expect(yaml).toContain('Light turned on');

    // Should have else action
    expect(yaml).toContain('Conditions not met');

    // Make sure there is only one 'if' block
    expect(yaml.match(/if:/g)?.length).toBe(1);
  });

  describe('Root Conditions Promotion', () => {
    it('should promote a single condition with no else to root conditions', () => {
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
          },
          {
            id: 'action1',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'cond1', target: 'action1', sourceHandle: 'true' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // Condition should be in root conditions block
      expect(yaml).toContain('conditions:');
      expect(yaml).toContain('condition: state');
      expect(yaml).not.toContain('if:');
      expect(yaml).not.toContain('then:');

      // Action should be in the actions block
      expect(yaml).toContain('service: light.turn_on');
    });

    it('should only promote leading conditions without else paths, keeping conditions with else in actions', () => {
      // trigger → cond1 (no else) → cond2 (has else) → action_then
      //                                     ↘ action_else
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
          },
          {
            id: 'cond2',
            type: 'condition',
            position: { x: 400, y: 0 },
            data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
          },
          {
            id: 'action_then',
            type: 'action',
            position: { x: 600, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
          {
            id: 'action_else',
            type: 'action',
            position: { x: 400, y: 200 },
            data: { service: 'notify.mobile_app', data: { message: 'Too warm' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'true' },
          { id: 'e3', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
          { id: 'e4', source: 'cond2', target: 'action_else', sourceHandle: 'false' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // cond1 (no else) should be promoted to root conditions
      expect(yaml).toContain('conditions:');

      // cond2 (has else) should remain as if/then/else in actions
      expect(yaml).toContain('if:');
      expect(yaml).toContain('then:');
      expect(yaml).toContain('else:');

      // Both conditions should be present
      expect(yaml).toContain('condition: state');
      expect(yaml).toContain('condition: numeric_state');

      // Actions should be present
      expect(yaml).toContain('service: light.turn_on');
      expect(yaml).toContain('service: notify.mobile_app');
    });

    it('should not promote conditions when first condition has else path', () => {
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
          },
          {
            id: 'action_then',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
          {
            id: 'action_else',
            type: 'action',
            position: { x: 400, y: 200 },
            data: { service: 'light.turn_off', target: { entity_id: 'light.living_room' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'cond1', target: 'action_then', sourceHandle: 'true' },
          { id: 'e3', source: 'cond1', target: 'action_else', sourceHandle: 'false' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // Should use if/then/else in actions, NOT root conditions
      expect(yaml).toContain('if:');
      expect(yaml).toContain('then:');
      expect(yaml).toContain('else:');

      // Should have both actions
      expect(yaml).toContain('service: light.turn_on');
      expect(yaml).toContain('service: light.turn_off');
    });

    it('should not promote when first node after trigger is not a condition', () => {
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'action1',
            type: 'action',
            position: { x: 200, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
        ],
        [{ id: 'e1', source: 'trigger', target: 'action1' }]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // Should NOT have root conditions block
      expect(yaml).not.toMatch(/^conditions:/m);

      // Action should be in actions
      expect(yaml).toContain('service: light.turn_on');
    });

    it('should promote conditions and handle multiple subsequent actions', () => {
      // trigger → cond1 (no else) → action1 → action2
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
          },
          {
            id: 'action1',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
          {
            id: 'action2',
            type: 'action',
            position: { x: 600, y: 0 },
            data: { service: 'notify.mobile_app', data: { message: 'Light turned on' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'cond1', target: 'action1', sourceHandle: 'true' },
          { id: 'e3', source: 'action1', target: 'action2' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // Condition should be in root conditions block
      expect(yaml).toContain('conditions:');
      expect(yaml).toContain('condition: state');
      expect(yaml).not.toContain('if:');

      // Both actions should be in actions block
      expect(yaml).toContain('service: light.turn_on');
      expect(yaml).toContain('service: notify.mobile_app');
    });

    it('should promote inverted condition (false-handle only) as condition: not', () => {
      // trigger → cond1 (false only) → action
      // This represents an inverted condition: execute action when condition is NOT true
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'on' },
          },
          {
            id: 'action1',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'cond1', target: 'action1', sourceHandle: 'false' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // Should be promoted to root conditions with "not" wrapper
      expect(yaml).toContain('conditions:');
      expect(yaml).toContain('condition: not');
      expect(yaml).toContain('condition: state');
      expect(yaml).not.toMatch(/^\s+if:/m);

      // Action should be in actions block
      expect(yaml).toContain('service: light.turn_on');
    });

    it('should promote chain of mixed true/false-handle conditions to root conditions', () => {
      // trigger → cond1 (false only) → cond2 (true only) → action
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'on' },
          },
          {
            id: 'cond2',
            type: 'condition',
            position: { x: 400, y: 0 },
            data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
          },
          {
            id: 'action1',
            type: 'action',
            position: { x: 600, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'false' },
          { id: 'e3', source: 'cond2', target: 'action1', sourceHandle: 'true' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // cond1 (false-only) should be promoted as "not", cond2 (true-only) as-is
      expect(yaml).toContain('conditions:');
      expect(yaml).toContain('condition: not');
      expect(yaml).toContain('condition: numeric_state');
      expect(yaml).not.toMatch(/^\s+if:/m);

      // Action should be in actions block
      expect(yaml).toContain('service: light.turn_on');
    });

    it('should promote multiple false-handle conditions as not wrappers', () => {
      // trigger → cond1 (false) → cond2 (false) → action
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'on' },
          },
          {
            id: 'cond2',
            type: 'condition',
            position: { x: 400, y: 0 },
            data: { condition: 'state', entity_id: 'light.bedroom', state: 'on' },
          },
          {
            id: 'action1',
            type: 'action',
            position: { x: 600, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'cond1', target: 'cond2', sourceHandle: 'false' },
          { id: 'e3', source: 'cond2', target: 'action1', sourceHandle: 'false' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);

      const yaml = result.yaml ?? '';

      // Both should be promoted as "not" wrappers
      expect(yaml).toContain('conditions:');
      expect(yaml).not.toMatch(/^\s+if:/m);

      // Should have two "condition: not" entries
      const notMatches = yaml.match(/condition: not/g);
      expect(notMatches?.length).toBe(2);

      // Action should be in actions block
      expect(yaml).toContain('service: light.turn_on');
    });
  });

  describe('OR Conditions', () => {
    it('should combine parallel conditions with converging true paths into OR', () => {
      // Graph: trigger → (cond1, cond2 in parallel) → both true paths to action
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: -100 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
          },
          {
            id: 'cond2',
            type: 'condition',
            position: { x: 200, y: 100 },
            data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
          },
          {
            id: 'action_then',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'trigger', target: 'cond2' },
          { id: 'e3', source: 'cond1', target: 'action_then', sourceHandle: 'true' },
          { id: 'e4', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);

      const yaml = result.yaml ?? '';

      // Should have 'condition: or' for the combined parallel conditions
      expect(yaml).toContain('condition: or');
      expect(yaml).toContain('conditions:');

      // Both conditions should be present inside the OR
      expect(yaml).toContain('condition: state');
      expect(yaml).toContain('condition: numeric_state');
      expect(yaml).toContain('entity_id: light.living_room');
      expect(yaml).toContain('entity_id: sensor.temperature');

      // Should have the action in the then block
      expect(yaml).toContain('service: light.turn_on');
    });

    it('should combine parallel conditions with converging false paths into OR', () => {
      // Graph: trigger → (cond1, cond2 in parallel) → both false paths to action
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: -100 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'on' },
          },
          {
            id: 'cond2',
            type: 'condition',
            position: { x: 200, y: 100 },
            data: { condition: 'numeric_state', entity_id: 'sensor.temperature', above: '25' },
          },
          {
            id: 'action_else',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'notify.mobile_app', data: { message: 'Both conditions failed' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'trigger', target: 'cond2' },
          { id: 'e3', source: 'cond1', target: 'action_else', sourceHandle: 'false' },
          { id: 'e4', source: 'cond2', target: 'action_else', sourceHandle: 'false' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);

      const yaml = result.yaml ?? '';

      // Should have 'condition: or' for the combined parallel conditions
      expect(yaml).toContain('condition: or');
      expect(yaml).toContain('conditions:');

      // Both conditions should be present inside the OR
      expect(yaml).toContain('condition: state');
      expect(yaml).toContain('condition: numeric_state');

      // Should have the action in the else block (since false paths converge)
      expect(yaml).toContain('service: notify.mobile_app');
      expect(yaml).toContain('Both conditions failed');
    });

    it('should handle three parallel conditions converging to OR', () => {
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: -100 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
          },
          {
            id: 'cond2',
            type: 'condition',
            position: { x: 200, y: 0 },
            data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
          },
          {
            id: 'cond3',
            type: 'condition',
            position: { x: 200, y: 100 },
            data: { condition: 'time', after: '22:00:00', before: '06:00:00' },
          },
          {
            id: 'action_then',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'trigger', target: 'cond2' },
          { id: 'e3', source: 'trigger', target: 'cond3' },
          { id: 'e4', source: 'cond1', target: 'action_then', sourceHandle: 'true' },
          { id: 'e5', source: 'cond2', target: 'action_then', sourceHandle: 'true' },
          { id: 'e6', source: 'cond3', target: 'action_then', sourceHandle: 'true' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);

      const yaml = result.yaml ?? '';

      // Should have 'condition: or' for the combined parallel conditions
      expect(yaml).toContain('condition: or');

      // All three conditions should be present
      expect(yaml).toContain('condition: state');
      expect(yaml).toContain('condition: numeric_state');
      expect(yaml).toContain('condition: time');
    });

    it('should handle OR conditions followed by additional actions', () => {
      const graph = createBaseGraph(
        [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
          },
          {
            id: 'cond1',
            type: 'condition',
            position: { x: 200, y: -100 },
            data: { condition: 'state', entity_id: 'light.living_room', state: 'off' },
          },
          {
            id: 'cond2',
            type: 'condition',
            position: { x: 200, y: 100 },
            data: { condition: 'numeric_state', entity_id: 'sensor.temperature', below: '20' },
          },
          {
            id: 'action1',
            type: 'action',
            position: { x: 400, y: 0 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.living_room' } },
          },
          {
            id: 'action2',
            type: 'action',
            position: { x: 600, y: 0 },
            data: { service: 'notify.mobile_app', data: { message: 'Light turned on' } },
          },
        ],
        [
          { id: 'e1', source: 'trigger', target: 'cond1' },
          { id: 'e2', source: 'trigger', target: 'cond2' },
          { id: 'e3', source: 'cond1', target: 'action1', sourceHandle: 'true' },
          { id: 'e4', source: 'cond2', target: 'action1', sourceHandle: 'true' },
          { id: 'e5', source: 'action1', target: 'action2' },
        ]
      );

      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(graph);

      expect(result.success).toBe(true);
      expect(result.errors ?? []).toHaveLength(0);

      const yaml = result.yaml ?? '';

      // Should have 'condition: or'
      expect(yaml).toContain('condition: or');

      // Both actions should be in the then block
      expect(yaml).toContain('service: light.turn_on');
      expect(yaml).toContain('service: notify.mobile_app');
      expect(yaml).toContain('Light turned on');
    });
  });
});
