import type { FlowGraph } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';

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
});
