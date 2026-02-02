import { describe, expect, it, vi } from 'vitest';
import { findBackEdges } from '../analyzer/topology';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

// Mock the generateIds functions for deterministic IDs
let mockNodeCounter = 0;
vi.mock('../utils/generateIds', () => ({
  generateNodeId: (type: string, index: number) => `${type}_test_${index}_${mockNodeCounter++}`,
  generateEdgeId: (source: string, target: string) => `e-${source}-${target}`,
  generateGraphId: () => `a18b0fbb-d966-432c-aba7-4f7361da8d29`,
  resetNodeCounter: () => {
    mockNodeCounter = 0;
  },
}));

describe('Repeat block roundtrip', () => {
  const parser = new YamlParser();
  const transpiler = new FlowTranspiler();

  describe('repeat.while', () => {
    const yaml = `
alias: While Loop
description: Test while
triggers:
  - trigger: state
    entity_id: binary_sensor.motion
    to: "on"
actions:
  - repeat:
      while:
        - condition: state
          entity_id: binary_sensor.motion
          state: "on"
      sequence:
        - action: light.turn_on
          target:
            entity_id: light.living_room
        - delay:
            seconds: 5
mode: single
`;

    it('should parse repeat.while into exploded nodes', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();

      const graph = result.graph!;

      // Should have: 1 trigger + 1 condition + 1 action + 1 delay = 4 nodes
      expect(graph.nodes.length).toBe(4);

      // Should have a condition node for the while condition
      const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
      expect(conditionNodes.length).toBe(1);
      expect(conditionNodes[0].data.condition).toBe('state');

      // Should have a structurally-detected back-edge pointing to the condition node
      const backEdgeIds = findBackEdges(graph);
      expect(backEdgeIds.size).toBe(1);
      const backEdge = graph.edges.find((e) => backEdgeIds.has(e.id))!;
      expect(backEdge.target).toBe(conditionNodes[0].id);
    });

    it('should transpile repeat.while back to valid YAML with repeat block', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);

      const outputYaml = transpiler.toYaml(result.graph!);
      expect(outputYaml).toContain('repeat');
      expect(outputYaml).toContain('while');
      expect(outputYaml).toContain('sequence');
      expect(outputYaml).toContain('light.turn_on');
      // Should NOT contain 'service: undefined'
      expect(outputYaml).not.toContain('service: undefined');
    });
  });

  describe('repeat.until', () => {
    const yaml = `
alias: Until Loop
description: Test until
triggers:
  - trigger: state
    entity_id: binary_sensor.door
    to: "on"
actions:
  - repeat:
      until:
        - condition: state
          entity_id: binary_sensor.door
          state: "off"
      sequence:
        - action: notify.mobile_app
          data:
            message: Door is still open!
        - delay:
            minutes: 1
mode: single
`;

    it('should parse repeat.until into exploded nodes', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();

      const graph = result.graph!;

      // Should have: 1 trigger + 1 action + 1 delay + 1 condition = 4 nodes
      expect(graph.nodes.length).toBe(4);

      // Should have a condition node for the until condition
      const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
      expect(conditionNodes.length).toBe(1);
      expect(conditionNodes[0].data.condition).toBe('state');

      // Should have a structurally-detected back-edge
      const backEdgeIds = findBackEdges(graph);
      expect(backEdgeIds.size).toBe(1);
    });

    it('should transpile repeat.until back to valid YAML with repeat block', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);

      const outputYaml = transpiler.toYaml(result.graph!);
      expect(outputYaml).toContain('repeat');
      expect(outputYaml).toContain('until');
      expect(outputYaml).toContain('sequence');
      expect(outputYaml).toContain('notify.mobile_app');
      expect(outputYaml).not.toContain('service: undefined');
    });
  });

  describe('repeat.count', () => {
    const yaml = `
alias: Count Loop
description: Test count
triggers:
  - trigger: state
    entity_id: input_boolean.test
    to: "on"
actions:
  - repeat:
      count: 3
      sequence:
        - action: light.toggle
          target:
            entity_id: light.living_room
        - delay:
            seconds: 1
mode: single
`;

    it('should parse repeat.count into exploded nodes', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();

      const graph = result.graph!;

      // Should have: 1 trigger + 1 init set_vars + 1 action + 1 delay + 1 incr set_vars + 1 condition = 6 nodes
      expect(graph.nodes.length).toBe(6);

      // Should have set_variables nodes for init and increment
      const setVarNodes = graph.nodes.filter((n) => n.type === 'set_variables');
      expect(setVarNodes.length).toBe(2);

      // Should have a condition node for the counter check
      const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
      expect(conditionNodes.length).toBe(1);
      expect(conditionNodes[0].data.condition).toBe('template');

      // Should have a structurally-detected back-edge
      const backEdgeIds = findBackEdges(graph);
      expect(backEdgeIds.size).toBe(1);
      // The back-edge source should be the condition node (count pattern: condition →(true)→ body)
      const backEdge = graph.edges.find((e) => backEdgeIds.has(e.id))!;
      expect(backEdge.source).toBe(conditionNodes[0].id);
    });

    it('should transpile repeat.count back to valid YAML with repeat block', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);

      const outputYaml = transpiler.toYaml(result.graph!);
      expect(outputYaml).toContain('repeat');
      expect(outputYaml).toContain('count: 3');
      expect(outputYaml).toContain('sequence');
      expect(outputYaml).toContain('light.toggle');
      expect(outputYaml).not.toContain('service: undefined');
      // Should NOT contain the internal counter variable
      expect(outputYaml).not.toContain('_repeat_counter_');
    });
  });

  describe('repeat nested inside if/then', () => {
    const yaml = `
alias: Repeat Inside If
description: Nested repeat
triggers:
  - trigger: time
    at: "08:00:00"
actions:
  - if:
      - condition: state
        entity_id: binary_sensor.workday
        state: "on"
    then:
      - repeat:
          while:
            - condition: state
              entity_id: input_boolean.reminder_needed
              state: "on"
          sequence:
            - action: notify.mobile_app
              data:
                message: Time to get ready!
            - delay:
                minutes: 5
    else:
      - action: notify.mobile_app
        data:
          message: Enjoy your day off!
mode: single
`;

    it('should parse nested repeat inside if/then', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();

      const graph = result.graph!;

      // Should have condition nodes for both the if-condition and the while-condition
      const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
      expect(conditionNodes.length).toBe(2);

      // Should have a structurally-detected back-edge for the while loop
      const backEdgeIds = findBackEdges(graph);
      expect(backEdgeIds.size).toBe(1);
    });

    it('should roundtrip nested repeat', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);

      const outputYaml = transpiler.toYaml(result.graph!);
      expect(outputYaml).toContain('repeat');
      expect(outputYaml).toContain('while');
      expect(outputYaml).not.toContain('service: undefined');
    });
  });

  describe('repeat with device actions', () => {
    const yaml = `
alias: Repeat With Device Action
description: Repeat containing device action calls
triggers:
  - trigger: state
    entity_id: input_boolean.test
    to: "on"
actions:
  - repeat:
      count: 5
      sequence:
        - action: light.turn_on
          target:
            entity_id: light.kitchen
          data:
            brightness: 255
        - delay:
            seconds: 2
        - action: light.turn_off
          target:
            entity_id: light.kitchen
        - delay:
            seconds: 2
mode: single
`;

    it('should parse and transpile repeat with multiple actions', async () => {
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);

      const outputYaml = transpiler.toYaml(result.graph!);
      expect(outputYaml).toContain('repeat');
      expect(outputYaml).toContain('count: 5');
      expect(outputYaml).toContain('light.turn_on');
      expect(outputYaml).toContain('light.turn_off');
      expect(outputYaml).not.toContain('service: undefined');
    });
  });

  describe('topology analysis with repeat', () => {
    it('should classify repeat-only flows as native strategy', async () => {
      const yaml = `
alias: Simple Repeat
triggers:
  - trigger: state
    entity_id: binary_sensor.test
actions:
  - repeat:
      while:
        - condition: state
          entity_id: binary_sensor.test
          state: "on"
      sequence:
        - action: light.turn_on
          target:
            entity_id: light.test
mode: single
`;
      const result = await parser.parse(yaml);
      expect(result.success).toBe(true);

      const analysis = transpiler.analyzeTopology(result.graph!);
      // Repeat back-edges should not cause cycle detection
      expect(analysis.hasCycles).toBe(false);
      expect(analysis.recommendedStrategy).toBe('native');
    });
  });
});
