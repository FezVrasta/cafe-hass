/**
 * Test to verify that transpiler doesn't generate conflicting platform/trigger fields
 */

import { transpiler } from '@cafe/transpiler';
import { dump as yamlDump } from 'js-yaml';
import { describe, expect, it } from 'vitest';

describe('Transpiler Platform/Trigger Fix', () => {
  it('should handle round-trip conversion without conflicts', async () => {
    // Test the full cycle: HA automation -> nodes -> HA automation
    const originalAutomation = {
      alias: 'Test Round Trip',
      trigger: [
        {
          platform: 'state', // Legacy format - should be normalized to 'trigger' on parse
          entity_id: 'sensor.temperature',
          above: 25,
        },
      ],
      action: [
        {
          service: 'notify.mobile_app_my_phone',
          data: {
            message: 'Temperature is high!',
          },
        },
      ],
    };

    // Step 1: Parse HA automation to nodes via YAML transpiler
    const yamlString = yamlDump(originalAutomation);
    const result = await transpiler.fromYaml(yamlString);

    expect(result.success).toBe(true);
    const nodes = result.graph!.nodes;

    expect(nodes).toHaveLength(2); // trigger + action

    const triggerNode = nodes.find((n) => n.type === 'trigger');
    expect(triggerNode).toBeDefined();

    if (triggerNode) {
      // Should preserve platform
      expect(triggerNode.data.trigger).toBe('state');
      expect(triggerNode.data.entity_id).toBe('sensor.temperature');
      expect(triggerNode.data.above).toBe(25);
    }
  });
});
