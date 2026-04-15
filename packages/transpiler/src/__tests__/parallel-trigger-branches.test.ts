import type { FlowGraph } from '@cafe/shared';
import { isActionNode, isTriggerNode } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

describe('Parallel Trigger Branches', () => {
  it('should execute all actions when a trigger has multiple targets', async () => {
    // Flow: trigger_0 → action_A AND action_B (parallel)
    //       trigger_1 → action_C
    const flow: FlowGraph = {
      id: 'dd446194-a857-41cd-a2c6-7e44df19919e',
      name: 'Untitled Automation',
      nodes: [
        {
          id: 'trigger_0',
          type: 'trigger',
          position: { x: -60, y: 45 },
          data: {
            entity_id: ['update.home_assistant_core_update'],
            trigger: 'state',
          },
        },
        {
          id: 'action_A',
          type: 'action',
          position: { x: 360, y: -15 },
          data: {
            service: 'light.turn_on',
            alias: 'Light Turn On',
          },
        },
        {
          id: 'action_B',
          type: 'action',
          position: { x: 360, y: 155 },
          data: {
            service: 'switch.turn_on',
            alias: 'Switch Turn On',
          },
        },
        {
          id: 'trigger_1',
          type: 'trigger',
          position: { x: -30, y: 360 },
          data: {
            trigger: 'time',
            at: '08:00:00',
          },
        },
        {
          id: 'action_C',
          type: 'action',
          position: { x: 345, y: 360 },
          data: {
            service: 'light.turn_off',
            alias: 'Light Turn Off',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'trigger_0',
          target: 'action_A',
        },
        {
          id: 'e2',
          source: 'trigger_0',
          target: 'action_B',
        },
        {
          id: 'e3',
          source: 'trigger_1',
          target: 'action_C',
        },
      ],
      metadata: { mode: 'single', initial_state: true },
      version: 1,
    };

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(flow);

    // Should succeed
    expect(result.success).toBe(true);

    // Should use state-machine strategy
    expect(result.output?.strategy).toBe('state-machine');

    // YAML should contain trigger.idx routing
    expect(result.yaml).toContain('trigger.idx');

    // All actions should be present
    expect(result.yaml).toContain('light.turn_on');
    expect(result.yaml).toContain('switch.turn_on');
    expect(result.yaml).toContain('light.turn_off');

    // Should have a parallel block for the trigger with multiple targets
    expect(result.yaml).toContain('parallel:');

    // Should have the parallel entry point for trigger 0
    expect(result.yaml).toContain('__parallel_trigger_0');

    // Trigger 1 should route directly to action_C (no parallel)
    expect(result.yaml).toContain('action_C');
  });

  it('should handle single trigger with multiple targets using native strategy', async () => {
    // Flow: trigger_0 → action_A AND action_B (parallel)
    // When there's only one trigger, native strategy handles parallel correctly
    const flow: FlowGraph = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Single Trigger Parallel',
      nodes: [
        {
          id: 'trigger_0',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'time', at: '21:00:00' },
        },
        {
          id: 'action_A',
          type: 'action',
          position: { x: 200, y: -50 },
          data: { service: 'light.turn_on', alias: 'Turn on light' },
        },
        {
          id: 'action_B',
          type: 'action',
          position: { x: 200, y: 50 },
          data: { service: 'switch.turn_on', alias: 'Turn on switch' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_0', target: 'action_A' },
        { id: 'e2', source: 'trigger_0', target: 'action_B' },
      ],
      metadata: { mode: 'single', initial_state: true },
      version: 1,
    };

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(flow);

    expect(result.success).toBe(true);

    // Should use native strategy (single trigger with parallel actions)
    expect(result.output?.strategy).toBe('native');

    // Should contain parallel block
    expect(result.yaml).toContain('parallel:');

    // Both actions should be in the parallel block
    expect(result.yaml).toContain('light.turn_on');
    expect(result.yaml).toContain('switch.turn_on');
  });

  it('should not create parallel block for single target', async () => {
    // Flow: trigger_0 → action_A (single target, no parallel)
    const flow: FlowGraph = {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      name: 'Single Target',
      nodes: [
        {
          id: 'trigger_0',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'time', at: '21:00:00' },
        },
        {
          id: 'action_A',
          type: 'action',
          position: { x: 200, y: 0 },
          data: { service: 'light.turn_on', alias: 'Turn on light' },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger_0', target: 'action_A' }],
      metadata: { mode: 'single', initial_state: true },
      version: 1,
    };

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(flow);

    expect(result.success).toBe(true);

    // Should NOT contain parallel block since there's only one target
    expect(result.yaml).not.toContain('parallel:');

    // Should NOT contain synthetic parallel entry point
    expect(result.yaml).not.toContain('__parallel_trigger');

    // Should directly route to action_A
    expect(result.yaml).toContain('action_A');
  });

  describe('round-trip (transpile → parse)', () => {
    it('should not create phantom nodes for __parallel_trigger_* entries', async () => {
      const flow: FlowGraph = {
        id: 'dd446194-a857-41cd-a2c6-7e44df19919e',
        name: 'Parallel Trigger Round Trip',
        nodes: [
          {
            id: 'trigger_0',
            type: 'trigger',
            position: { x: -60, y: 45 },
            data: {
              entity_id: ['update.home_assistant_core_update'],
              trigger: 'state',
            },
          },
          {
            id: 'action_A',
            type: 'action',
            position: { x: 360, y: -15 },
            data: {
              service: 'light.turn_on',
              alias: 'Light Turn On',
            },
          },
          {
            id: 'action_B',
            type: 'action',
            position: { x: 360, y: 155 },
            data: {
              service: 'switch.turn_on',
              alias: 'Switch Turn On',
            },
          },
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: -30, y: 360 },
            data: {
              trigger: 'time',
              at: '08:00:00',
            },
          },
          {
            id: 'action_C',
            type: 'action',
            position: { x: 345, y: 360 },
            data: {
              service: 'light.turn_off',
              alias: 'Light Turn Off',
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger_0', target: 'action_A' },
          { id: 'e2', source: 'trigger_0', target: 'action_B' },
          { id: 'e3', source: 'trigger_1', target: 'action_C' },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Transpile flow → YAML
      const transpiler = new FlowTranspiler();
      const transpileResult = transpiler.transpile(flow);
      expect(transpileResult.success).toBe(true);
      expect(transpileResult.yaml).toContain('__parallel_trigger_0');

      // Parse YAML → flow
      const parser = new YamlParser();
      const parseResult = await parser.parse(transpileResult.yaml!);
      expect(parseResult.success).toBe(true);
      expect(parseResult.graph).toBeDefined();

      const parsed = parseResult.graph!;

      // No phantom __parallel_trigger_* nodes should exist
      const phantomNodes = parsed.nodes.filter((n) => n.id.startsWith('__parallel_trigger_'));
      expect(phantomNodes).toHaveLength(0);

      // Find nodes by type using type guards
      const triggerNodes = parsed.nodes.filter(isTriggerNode);
      const actionNodes = parsed.nodes.filter(isActionNode);

      // trigger_0 (state) should have edges to both action_A and action_B
      const trigger0 = triggerNodes.find((n) => n.data.trigger === 'state');
      expect(trigger0).toBeDefined();
      const trigger0Edges = parsed.edges.filter((e) => e.source === trigger0!.id);
      const trigger0Targets = trigger0Edges.map((e) => e.target).sort();
      const actionAId = actionNodes.find((n) => n.data.service === 'light.turn_on')?.id;
      const actionBId = actionNodes.find((n) => n.data.service === 'switch.turn_on')?.id;
      expect(trigger0Targets).toEqual([actionAId, actionBId].sort());

      // trigger_1 (time) should have an edge to action_C
      const trigger1 = triggerNodes.find((n) => n.data.trigger === 'time');
      expect(trigger1).toBeDefined();
      const trigger1Edges = parsed.edges.filter((e) => e.source === trigger1!.id);
      const actionCId = actionNodes.find((n) => n.data.service === 'light.turn_off')?.id;
      expect(trigger1Edges).toHaveLength(1);
      expect(trigger1Edges[0].target).toBe(actionCId);
    });

    it('should round-trip trigger fan-out to non-action nodes', async () => {
      // trigger_0 → condition_X (true→action_A) AND condition_Y (true→action_B)
      // trigger_1 → action_D
      const flow: FlowGraph = {
        id: 'cc112233-4455-6677-8899-aabbccddeeff',
        name: 'Parallel Trigger Non-Action',
        nodes: [
          {
            id: 'trigger_0',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { trigger: 'time', at: '09:00:00' },
          },
          {
            id: 'condition_X',
            type: 'condition',
            position: { x: 300, y: -100 },
            data: {
              condition: 'state',
              entity_id: 'binary_sensor.door',
              state: 'on',
            },
          },
          {
            id: 'action_A',
            type: 'action',
            position: { x: 600, y: -100 },
            data: { service: 'light.turn_on', alias: 'Door Light' },
          },
          {
            id: 'condition_Y',
            type: 'condition',
            position: { x: 300, y: 100 },
            data: {
              condition: 'state',
              entity_id: 'binary_sensor.window',
              state: 'on',
            },
          },
          {
            id: 'action_B',
            type: 'action',
            position: { x: 600, y: 100 },
            data: { service: 'switch.turn_on', alias: 'Window Fan' },
          },
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 0, y: 300 },
            data: { trigger: 'time', at: '21:00:00' },
          },
          {
            id: 'action_D',
            type: 'action',
            position: { x: 300, y: 300 },
            data: { service: 'light.turn_off', alias: 'Lights Off' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger_0', target: 'condition_X' },
          { id: 'e2', source: 'trigger_0', target: 'condition_Y' },
          { id: 'e3', source: 'condition_X', target: 'action_A', sourceHandle: 'true' },
          { id: 'e4', source: 'condition_Y', target: 'action_B', sourceHandle: 'true' },
          { id: 'e5', source: 'trigger_1', target: 'action_D' },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      const transpiler = new FlowTranspiler();
      const transpileResult = transpiler.transpile(flow);
      expect(transpileResult.success).toBe(true);

      const parser = new YamlParser();
      const parseResult = await parser.parse(transpileResult.yaml!);
      expect(parseResult.success).toBe(true);
      expect(parseResult.graph).toBeDefined();

      const parsed = parseResult.graph!;

      // No phantom nodes
      const phantomNodes = parsed.nodes.filter((n) => n.id.startsWith('__parallel_trigger_'));
      expect(phantomNodes).toHaveLength(0);

      // trigger_0 connects to both conditions
      const triggerNodes = parsed.nodes.filter(isTriggerNode);
      const trigger0 = triggerNodes.find((n) => n.data.at === '09:00:00');
      expect(trigger0).toBeDefined();
      const trigger0Edges = parsed.edges.filter((e) => e.source === trigger0!.id);
      expect(trigger0Edges).toHaveLength(2);

      const conditionIds = parsed.nodes
        .filter((n) => n.type === 'condition')
        .map((n) => n.id)
        .sort();
      const trigger0Targets = trigger0Edges.map((e) => e.target).sort();
      expect(trigger0Targets).toEqual(conditionIds);
    });
  });
});
