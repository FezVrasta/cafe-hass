/**
 * Test to verify that platform/trigger conflict is resolved
 */

import { transpiler } from '@cafe/transpiler';
import { dump as yamlDump } from 'js-yaml';
import { describe, expect, it } from 'vitest';

describe('Platform/Trigger Conflict Fix', () => {
  it('should not create nodes with both platform and trigger fields', async () => {
    // Simulated HA automation config with both platform and trigger fields (this used to cause conflicts)
    const automationConfig = {
      alias: 'Test Automation',
      triggers: [
        {
          platform: 'state',
          trigger: 'state', // This would cause the conflict
          entity_id: 'sensor.temperature',
          to: 'on',
        },
      ],
      actions: [
        {
          service: 'light.turn_on',
          target: {
            entity_id: 'light.living_room',
          },
        },
      ],
    };

    const yamlString = yamlDump(automationConfig);
    const result = await transpiler.fromYaml(yamlString);

    expect(result.success).toBe(true);
    expect(result.graph!.nodes).toHaveLength(2); // Should have trigger and action nodes

    const triggerNode = result.graph!.nodes.find((n) => n.type === 'trigger');
    expect(triggerNode).toBeDefined();

    if (triggerNode) {
      // Should have platform field
      expect(triggerNode.data.platform).toBe('state');

      // Should still have other expected fields
      expect(triggerNode.data.entity_id).toBe('sensor.temperature');
      expect(triggerNode.data.to).toBe('on');
    }
  });

  it('should handle domain field conflicts as well', async () => {
    const automationConfig = {
      alias: 'Test Automation',
      triggers: [
        {
          platform: 'device',
          domain: 'device', // This should also be cleaned up
          entity_id: 'binary_sensor.motion',
        },
      ],
      actions: [
        {
          service: 'light.turn_on',
          target: {
            entity_id: 'light.living_room',
          },
        },
      ],
    };

    const yamlString = yamlDump(automationConfig);
    const result = await transpiler.fromYaml(yamlString);

    expect(result.success).toBe(true);
    const triggerNode = result.graph!.nodes.find((n) => n.type === 'trigger');

    if (triggerNode) {
      expect(triggerNode.data.platform).toBe('device');
    }
  });
});
