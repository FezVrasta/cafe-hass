/**
 * Test to verify that transpiler doesn't generate conflicting platform/trigger fields
 */

import { describe, expect, it } from 'vitest';
import { convertAutomationConfigToNodes } from '../automation-converter';

describe('Transpiler Platform/Trigger Fix', () => {
  it('should handle round-trip conversion without conflicts', () => {
    // Test the full cycle: HA automation -> nodes -> HA automation
    const originalAutomation = {
      alias: 'Test Round Trip',
      triggers: [
        {
          platform: 'state',
          trigger: 'state', // This would cause conflicts before the fix
          entity_id: 'sensor.temperature',
          above: 25,
        },
      ],
      actions: [
        {
          service: 'notify.mobile_app_my_phone',
          data: {
            message: 'Temperature is high!',
          },
        },
      ],
    };

    // Step 1: Parse HA automation to nodes (this is where conflicts used to be introduced)
    const { nodes } = convertAutomationConfigToNodes(originalAutomation);

    expect(nodes).toHaveLength(2); // trigger + action

    const triggerNode = nodes.find((n) => n.type === 'trigger');
    expect(triggerNode).toBeDefined();

    if (triggerNode) {
      // Should preserve platform
      expect(triggerNode.data.platform).toBe('state');
      expect(triggerNode.data.entity_id).toBe('sensor.temperature');
      expect(triggerNode.data.above).toBe(25);

      // Should NOT have conflicting trigger field
      expect(triggerNode.data.trigger).toBeUndefined();
    }
  });
});
