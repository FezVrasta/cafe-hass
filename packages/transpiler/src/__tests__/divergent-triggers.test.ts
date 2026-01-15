import type { FlowGraph } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';

describe('Divergent Trigger Paths', () => {
  it('should use state-machine strategy when triggers have different targets', async () => {
    const flow: FlowGraph = {
      id: '6d933f09-4d19-410e-bf70-01dd3c07b57d',
      name: 'Alarm Mode Changes',
      nodes: [
        {
          id: 'trigger_0',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { platform: 'time', at: '21:00:00' },
        },
        {
          id: 'trigger_1',
          type: 'trigger',
          position: { x: 0, y: 100 },
          data: { platform: 'time', at: '07:00:00' },
        },
        {
          id: 'action_0',
          type: 'action',
          position: { x: 200, y: 0 },
          data: { service: 'alarm_control_panel.alarm_arm_night' },
        },
        {
          id: 'action_1',
          type: 'action',
          position: { x: 200, y: 100 },
          data: { service: 'alarm_control_panel.alarm_arm_home' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_0', target: 'action_0' },
        { id: 'e2', source: 'trigger_1', target: 'action_1' },
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

    // Both actions should be present
    expect(result.yaml).toContain('alarm_control_panel.alarm_arm_night');
    expect(result.yaml).toContain('alarm_control_panel.alarm_arm_home');

    const parsed = await transpiler.fromYaml(result.yaml!);

    // Parsed flow should succeed without errors/warnings
    expect(parsed.success).toBe(true);
    expect(parsed.errors ?? []).toHaveLength(0);
    expect(parsed.warnings).toHaveLength(0);

    // Verify the parsed graph has correct structure
    expect(parsed.graph?.nodes).toHaveLength(4); // 2 triggers + 2 actions
    expect(parsed.graph?.edges).toHaveLength(2); // Each trigger → its action

    // Verify edges connect correctly
    const edges = parsed.graph!.edges;
    expect(edges.find((e) => e.source === 'trigger_0')?.target).toBe('action_0');
    expect(edges.find((e) => e.source === 'trigger_1')?.target).toBe('action_1');
  });
});
