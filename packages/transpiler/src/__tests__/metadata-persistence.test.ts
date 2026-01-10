import type { FlowGraph, TriggerNode, ConditionNode } from '@cafe/shared';
import { isTriggerNode, isConditionNode } from '@cafe/shared';
import { v4 as uuidv4 } from 'uuid';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

describe('Metadata Persistence', () => {
  it('should support entity_id as array in trigger and condition nodes', () => {
    const flow: FlowGraph = {
      id: uuidv4(),
      name: 'Array EntityId',
      description: '',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: {
            platform: 'state',
            entity_id: ['sensor.one', 'sensor.two'],
          },
        },
        {
          id: 'condition-1',
          type: 'condition',
          position: { x: 0, y: 0 },
          data: {
            condition_type: 'state',
            entity_id: ['binary_sensor.a', 'binary_sensor.b'],
            state: 'on',
          },
        },
        {
          id: 'action-1',
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            service: 'light.turn_on',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'condition-1' },
        { id: 'e2', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
      ],
      metadata: { mode: 'single', initial_state: true },
      version: 1,
    };
    const transpiler = new FlowTranspiler();
    const parser = new YamlParser();
    const yaml = transpiler.transpile(flow).yaml!;
    const parsed = parser.parse(yaml);
    console.log(yaml, parsed.errors);
    expect(parsed.success).toBe(true);
    const trigger = parsed.graph?.nodes.find(
      (n): n is TriggerNode => isTriggerNode(n) && n.id === 'trigger-1'
    );
    expect(trigger).toBeDefined();
    expect(Array.isArray(trigger?.data.entity_id)).toBe(true);
    expect(trigger?.data.entity_id).toEqual(['sensor.one', 'sensor.two']);
    const condition = parsed.graph?.nodes.find(
      (n): n is ConditionNode => isConditionNode(n) && n.id === 'condition-1'
    );
    expect(condition).toBeDefined();
    expect(Array.isArray(condition?.data.entity_id)).toBe(true);
    expect(condition?.data.entity_id).toEqual(['binary_sensor.a', 'binary_sensor.b']);
  });
  const transpiler = new FlowTranspiler();
  const parser = new YamlParser();

  describe('Native Strategy - Round Trip', () => {
    it('should preserve node positions when exporting and re-importing simple flow', () => {
      // Arrange: Create a simple flow with specific positions
      const originalFlow: FlowGraph = {
        id: uuidv4(),
        name: 'Test Automation',
        description: 'A test flow',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 50 },
            data: {
              platform: 'state',
              entity_id: 'light.living_room',
              to: 'on',
            },
          },
          {
            id: 'action-1',
            type: 'action',
            position: { x: 200, y: 150 },
            data: {
              service: 'notify.mobile_app',
              data: { message: 'Hello' },
            },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'trigger-1',
            target: 'action-1',
          },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Act: Export to YAML
      const result = transpiler.transpile(originalFlow);
      console.log(result.errors);
      expect(result.success).toBe(true);
      expect(result.yaml).toBeDefined();

      // Verify metadata is in YAML
      expect(result.yaml).toContain('_cafe_metadata');
      expect(result.yaml).toContain('trigger-1');
      expect(result.yaml).toContain('action-1');

      // Act: Parse back to flow
      const parseResult = parser.parse(result.yaml!);

      // Assert: Parsing succeeds
      expect(parseResult.success).toBe(true);
      expect(parseResult.hadMetadata).toBe(true);
      expect(parseResult.graph).toBeDefined();

      // Assert: Node positions are preserved
      const reimportedFlow = parseResult.graph!;
      expect(reimportedFlow.nodes).toHaveLength(2);

      const trigger = reimportedFlow.nodes.find((n) => n.id === 'trigger-1');
      const action = reimportedFlow.nodes.find((n) => n.id === 'action-1');

      expect(trigger?.position).toEqual({ x: 100, y: 50 });
      expect(action?.position).toEqual({ x: 200, y: 150 });
    });

    it('should preserve node IDs across round trip', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'ID Test',
        description: '',
        nodes: [
          {
            id: 'custom-trigger-id',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { platform: 'time', at: '12:00:00' },
          },
          {
            id: 'custom-action-id',
            type: 'action',
            position: { x: 100, y: 100 },
            data: { service: 'light.turn_on' },
          },
        ],
        edges: [{ id: 'e1', source: 'custom-trigger-id', target: 'custom-action-id' }],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.graph?.nodes[0].id).toBe('custom-trigger-id');
      expect(parsed.graph?.nodes[1].id).toBe('custom-action-id');
    });

    it('should preserve graph metadata (ID and version)', () => {
      const originalGraphId = uuidv4();
      const flow: FlowGraph = {
        id: originalGraphId,
        name: 'Metadata Test',
        description: 'Testing metadata preservation',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 50, y: 50 },
            data: { platform: 'state', entity_id: 'sensor.temperature' },
          },
        ],
        edges: [],
        metadata: { mode: 'parallel', max: 5, initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);
      const parsed = parser.parse(yaml);

      expect(parsed.graph?.id).toBe(originalGraphId);
      expect(parsed.graph?.version).toBe(1);
      expect(parsed.graph?.metadata?.mode).toBe('parallel');
      expect(parsed.graph?.metadata?.max).toBe(5);
    });

    it('should preserve node IDs when using native strategy', () => {
      // This test reproduces the issue where native strategy YAML
      // doesn't preserve node IDs during round-trip
      const flow: FlowGraph = {
        id: '013a49d4-4469-4087-84ff-17874278935e',
        name: 'Untitled Automation',
        description: '',
        nodes: [
          {
            id: 'trigger_1767870543439',
            type: 'trigger',
            position: { x: 255, y: 60 },
            data: {
              platform: 'state',
              entity_id: 'alarm_control_panel.allarme',
            },
          },
          {
            id: 'action_1767870548496',
            type: 'action',
            position: { x: 255, y: 285 },
            data: {
              service: 'light.turn_on',
              target: {
                entity_id: 'light.anta_ingresso_soggiorno',
              },
            },
          },
        ],
        edges: [
          {
            id: 'e-trigger_1767870543439-action_1767870548496-1767870551831',
            source: 'trigger_1767870543439',
            target: 'action_1767870548496',
          },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Use native strategy (default for simple linear flows)
      const yaml = transpiler.toYaml(flow);

      // Parse it back
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.hadMetadata).toBe(true);

      // Node IDs should be preserved
      const trigger = parsed.graph?.nodes.find((n) => n.id === 'trigger_1767870543439');
      const action = parsed.graph?.nodes.find((n) => n.id === 'action_1767870548496');

      expect(trigger).toBeDefined();
      expect(action).toBeDefined();

      // Positions should be preserved
      expect(trigger?.position).toEqual({ x: 255, y: 60 });
      expect(action?.position).toEqual({ x: 255, y: 285 });
    });
  });

  describe('State Machine Strategy - Round Trip', () => {
    it('should include metadata in state machine YAML', () => {
      // Create a flow that requires state machine (has cycle)
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Complex Flow',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: { platform: 'state', entity_id: 'input_boolean.test' },
          },
          {
            id: 'action-1',
            type: 'action',
            position: { x: 200, y: 200 },
            data: { service: 'light.turn_on', target: { entity_id: 'light.one' } },
          },
          {
            id: 'action-2',
            type: 'action',
            position: { x: 300, y: 300 },
            data: { service: 'light.turn_off', target: { entity_id: 'light.two' } },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'action-1' },
          { id: 'e2', source: 'action-1', target: 'action-2' },
          { id: 'e3', source: 'action-2', target: 'action-1' }, // Cycle
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const result = transpiler.transpile(flow, { forceStrategy: 'state-machine' });

      expect(result.success).toBe(true);
      expect(result.yaml).toContain('_cafe_metadata');
      expect(result.yaml).toContain('strategy: state-machine');
      expect(result.yaml).toContain('trigger-1');
      expect(result.yaml).toContain('action-1');
      expect(result.yaml).toContain('action-2');
    });

    it('should preserve positions when re-importing state machine YAML', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Position Test',
        description: '',
        nodes: [
          {
            id: 'trigger-sm',
            type: 'trigger',
            position: { x: 250, y: 100 },
            data: { platform: 'state', entity_id: 'switch.test' },
          },
          {
            id: 'action-sm-1',
            type: 'action',
            position: { x: 255, y: 240 },
            data: { service: 'switch.turn_on' },
          },
          {
            id: 'action-sm-2',
            type: 'action',
            position: { x: 150, y: 405 },
            data: { service: 'switch.turn_off' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-sm', target: 'action-sm-1' },
          { id: 'e2', source: 'action-sm-1', target: 'action-sm-2' },
          { id: 'e3', source: 'action-sm-2', target: 'action-sm-1' },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow, { forceStrategy: 'state-machine' });
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.hadMetadata).toBe(true);

      const reimported = parsed.graph!;
      const trigger = reimported.nodes.find((n) => n.id === 'trigger-sm');
      const action1 = reimported.nodes.find((n) => n.id === 'action-sm-1');
      const action2 = reimported.nodes.find((n) => n.id === 'action-sm-2');

      expect(trigger?.position).toEqual({ x: 250, y: 100 });
      expect(action1?.position).toEqual({ x: 255, y: 240 });
      expect(action2?.position).toEqual({ x: 150, y: 405 });
    });
  });

  describe('YAML without metadata', () => {
    it('should use heuristic layout for manually written YAML', () => {
      const manualYaml = `
alias: Manual Automation
description: Written by hand
trigger:
  - platform: state
    entity_id: binary_sensor.motion
    to: 'on'
action:
  - service: light.turn_on
    target:
      entity_id: light.hallway
mode: single
      `;

      const parsed = parser.parse(manualYaml);

      expect(parsed.success).toBe(true);
      expect(parsed.hadMetadata).toBe(false);
      expect(parsed.graph).toBeDefined();

      // Should have generated positions (fallback layout)
      const nodes = parsed.graph?.nodes;
      expect(nodes).toHaveLength(2);
      expect(nodes).toBeDefined();
      expect(nodes?.[0].position.x).toBeGreaterThanOrEqual(0);
      expect(nodes?.[0].position.y).toBeGreaterThanOrEqual(0);
      expect(nodes?.[1].position.x).toBeGreaterThanOrEqual(0);
      expect(nodes?.[1].position.y).toBeGreaterThanOrEqual(0);
    });

    it('should handle Home Assistant 2024+ format (triggers/actions)', () => {
      const modernYaml = `
alias: Modern Format
triggers:
  - trigger: state
    entity_id: sensor.temperature
    above: 25
conditions:
  - condition: numeric_state
    entity_id: sensor.humidity
    below: 60
actions:
  - action: climate.set_temperature
    target:
      entity_id: climate.bedroom
    data:
      temperature: 22
mode: single
      `;

      const parsed = parser.parse(modernYaml);

      expect(parsed.success).toBe(true);
      expect(parsed.graph?.nodes).toHaveLength(3); // trigger + condition + action
    });
  });

  describe('Complex flows with conditions', () => {
    it('should preserve positions for flows with condition nodes', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Condition Flow',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: { platform: 'state', entity_id: 'sensor.door' },
          },
          {
            id: 'condition-1',
            type: 'condition',
            position: { x: 200, y: 200 },
            data: { condition_type: 'state', entity_id: 'sun.sun', state: 'below_horizon' },
          },
          {
            id: 'action-1',
            type: 'action',
            position: { x: 300, y: 300 },
            data: { service: 'light.turn_on' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'condition-1' },
          { id: 'e2', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);

      const condition = parsed.graph?.nodes.find((n) => n.id === 'condition-1');
      expect(condition?.position).toEqual({ x: 200, y: 200 });
    });
  });

  describe('Edge cases', () => {
    it('should handle flows with delay and wait nodes', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Delay Test',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { platform: 'state', entity_id: 'input_boolean.test' },
          },
          {
            id: 'delay-1',
            type: 'delay',
            position: { x: 100, y: 100 },
            data: { delay: '00:00:05' },
          },
          {
            id: 'action-1',
            type: 'action',
            position: { x: 200, y: 200 },
            data: { service: 'light.turn_on' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'delay-1' },
          { id: 'e2', source: 'delay-1', target: 'action-1' },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.graph?.nodes).toHaveLength(3);

      const delay = parsed.graph?.nodes.find((n) => n.type === 'delay');
      expect(delay?.position).toEqual({ x: 100, y: 100 });
    });

    it('should handle empty positions gracefully', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Zero Test',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { platform: 'time', at: '09:00:00' },
          },
        ],
        edges: [],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.graph?.nodes[0].position).toEqual({ x: 0, y: 0 });
    });

    it('should handle very large position values', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Large Positions',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 9999, y: 8888 },
            data: { platform: 'state', entity_id: 'sensor.test' },
          },
        ],
        edges: [],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.graph?.nodes[0].position).toEqual({ x: 9999, y: 8888 });
    });

    it('should handle special characters in node IDs', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Special Chars',
        description: '',
        nodes: [
          {
            id: 'trigger_with_underscores_123',
            type: 'trigger',
            position: { x: 50, y: 50 },
            data: { platform: 'state', entity_id: 'sensor.test' },
          },
          {
            id: 'action-with-dashes-456',
            type: 'action',
            position: { x: 150, y: 150 },
            data: { service: 'notify.test' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger_with_underscores_123', target: 'action-with-dashes-456' },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.graph?.nodes[0].id).toBe('trigger_with_underscores_123');
      expect(parsed.graph?.nodes[1].id).toBe('action-with-dashes-456');
    });
  });

  describe('Validation and error handling', () => {
    it('should reject invalid YAML', () => {
      const invalidYaml = `
this is not
  valid: yaml: structure:
      `;

      const parsed = parser.parse(invalidYaml);

      expect(parsed.success).toBe(false);
      expect(parsed.errors).toBeDefined();
      expect(parsed.errors?.length).toBeGreaterThan(0);
    });

    it('should reject YAML without triggers', () => {
      const noTriggerYaml = `
alias: No Trigger
action:
  - service: light.turn_on
mode: single
      `;

      const parsed = parser.parse(noTriggerYaml);

      expect(parsed.success).toBe(false);
      expect(parsed.warnings).toContain('No triggers found in automation');
    });

    it('should handle corrupted metadata gracefully', () => {
      const corruptedMetadataYaml = `
alias: Corrupted Metadata
trigger:
  - platform: state
    entity_id: sensor.test
action:
  - service: light.turn_on
variables:
  _cafe_metadata: "this should be an object"
mode: single
      `;

      const parsed = parser.parse(corruptedMetadataYaml);

      // Should still parse, just without metadata
      expect(parsed.success).toBe(true);
      expect(parsed.hadMetadata).toBe(false);
    });
  });

  describe('Strategy selection', () => {
    it('should record native strategy in metadata', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'Native',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { platform: 'state', entity_id: 'sensor.test' },
          },
        ],
        edges: [],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow);

      expect(yaml).toContain('strategy: native');
    });

    it('should record state-machine strategy in metadata', () => {
      const flow: FlowGraph = {
        id: uuidv4(),
        name: 'State Machine',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { platform: 'state', entity_id: 'sensor.test' },
          },
          {
            id: 'action-1',
            type: 'action',
            position: { x: 100, y: 100 },
            data: { service: 'light.turn_on' },
          },
          {
            id: 'action-2',
            type: 'action',
            position: { x: 200, y: 200 },
            data: { service: 'light.turn_off' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'action-1' },
          { id: 'e2', source: 'action-1', target: 'action-2' },
          { id: 'e3', source: 'action-2', target: 'action-1' }, // Cycle between actions
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const yaml = transpiler.toYaml(flow, { forceStrategy: 'state-machine' });

      expect(yaml).toContain('strategy: state-machine');
    });

    it('should use node IDs in state machine conditions for proper round-trip', () => {
      // This test reproduces the issue from the user's example
      const flow: FlowGraph = {
        id: '013a49d4-4469-4087-84ff-17874278935e',
        name: 'Untitled Automation',
        description: '',
        nodes: [
          {
            id: 'trigger_1767870543439',
            type: 'trigger',
            position: { x: 270, y: 60 },
            data: {
              platform: 'state',
              entity_id: 'alarm_control_panel.allarme',
            },
          },
          {
            id: 'action_1767870548496',
            type: 'action',
            position: { x: 255, y: 285 },
            data: {
              service: 'light.turn_on',
              target: {
                entity_id: 'light.anta_ingresso_soggiorno',
              },
            },
          },
        ],
        edges: [
          {
            id: 'e-trigger_1767870543439-action_1767870548496-1767870551831',
            source: 'trigger_1767870543439',
            target: 'action_1767870548496',
          },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Force state-machine strategy as user did
      const yaml = transpiler.toYaml(flow, { forceStrategy: 'state-machine' });

      // The YAML should contain the actual node ID in the condition template
      expect(yaml).toContain('action_1767870548496');

      // Try to parse it back
      const parsed = parser.parse(yaml);

      expect(parsed.success).toBe(true);
      expect(parsed.hadMetadata).toBe(true);

      // The nodes should be restored with correct IDs
      const trigger = parsed.graph?.nodes.find((n) => n.id === 'trigger_1767870543439');
      const action = parsed.graph?.nodes.find((n) => n.id === 'action_1767870548496');

      expect(trigger).toBeDefined();
      expect(action).toBeDefined();

      // Positions should be preserved
      expect(trigger?.position).toEqual({ x: 270, y: 60 });
      expect(action?.position).toEqual({ x: 255, y: 285 });
    });

    it('should export condition attributes in YAML for numeric_state conditions', () => {
      // Arrange: Create a flow with numeric_state condition that has an attribute
      const flow: FlowGraph = {
        id: 'd37d0bc8-86c4-413c-8fa0-7550b702fc77',
        name: 'Untitled Automation',
        description: '',
        nodes: [
          {
            id: 'condition_1767872672940',
            type: 'condition',
            position: { x: 250, y: 150 },
            data: {
              condition_type: 'numeric_state',
              entity_id: 'sensor.sensore_di_luminosita_bagno_di_servizio',
              above: 10,
              below: 200,
              attribute: 'brightness',
            },
          },
          {
            id: 'trigger_1767872710200',
            type: 'trigger',
            position: { x: 105, y: -10 },
            data: {
              platform: 'state',
              entity_id: '',
            },
          },
          {
            id: 'action_1767872711354',
            type: 'action',
            position: { x: 420, y: -40 },
            data: {
              service: 'light.turn_on',
            },
          },
        ],
        edges: [
          {
            id: 'e-trigger_1767872710200-condition_1767872672940-1767872712890',
            source: 'trigger_1767872710200',
            target: 'condition_1767872672940',
          },
          {
            id: 'e-condition_1767872672940-action_1767872711354-1767872718711',
            source: 'condition_1767872672940',
            target: 'action_1767872711354',
            sourceHandle: 'true',
          },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Act: Export to YAML using native strategy
      const yaml = transpiler.toYaml(flow, { forceStrategy: 'native' });

      // Assert: The YAML should contain the attribute field
      expect(yaml).toContain('attribute: brightness');
      expect(yaml).toContain('condition: numeric_state');
      expect(yaml).toContain('above: 10');
      expect(yaml).toContain('below: 200');

      console.log('Generated YAML:');
      console.log(yaml);
    });
  });
});
