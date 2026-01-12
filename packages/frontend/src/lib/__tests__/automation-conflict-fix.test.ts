/**
 * Test to verify that platform/trigger conflict is resolved
 */

import { convertAutomationConfigToNodes } from '@cafe/transpiler';
import { describe, expect, it } from 'vitest';

describe('Platform/Trigger Conflict Fix', () => {
  it('should not create nodes with both platform and trigger fields', () => {
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

    const result = convertAutomationConfigToNodes(automationConfig);

    expect(result.nodes).toHaveLength(2); // Should have trigger and action nodes

    const triggerNode = result.nodes.find((n) => n.type === 'trigger');
    expect(triggerNode).toBeDefined();

    if (triggerNode) {
      // Should have platform field
      expect(triggerNode.data.platform).toBe('state');

      // Should NOT have trigger field (should be cleaned up)
      expect(triggerNode.data.trigger).toBeUndefined();

      // Should still have other expected fields
      expect(triggerNode.data.entity_id).toBe('sensor.temperature');
      expect(triggerNode.data.to).toBe('on');
    }
  });

  it('should handle domain field conflicts as well', () => {
    const automationConfig = {
      triggers: [
        {
          platform: 'device',
          domain: 'device', // This should also be cleaned up
          entity_id: 'binary_sensor.motion',
        },
      ],
      actions: [],
    };

    const result = convertAutomationConfigToNodes(automationConfig);
    const triggerNode = result.nodes.find((n) => n.type === 'trigger');

    if (triggerNode) {
      expect(triggerNode.data.platform).toBe('device');
      expect(triggerNode.data.domain).toBe('device'); // Domain is now preserved
    }
  });
});
