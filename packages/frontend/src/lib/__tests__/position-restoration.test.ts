import { transpiler } from '@cafe/transpiler';
import { dump as yamlDump } from 'js-yaml';
import { describe, expect, it } from 'vitest';

describe('Position Restoration', () => {
  it('should restore node positions from transpiler metadata', async () => {
    const automationConfig = {
      alias: 'CAFE',
      description: '',
      trigger: [
        {
          alias: 'Trigger 1',
          trigger: 'state',
          entity_id: 'alarm_control_panel.allarme',
        },
      ],
      action: [
        {
          alias: 'Action: light.turn_on',
          service: 'light.turn_on',
          target: {
            entity_id: 'light.studio',
          },
          data: {},
        },
      ],
      mode: 'single',
      variables: {
        _cafe_metadata: {
          version: 1,
          nodes: {
            trigger_1767901134917_0: {
              x: 150,
              y: 200,
            },
            action_1767901134917_0: {
              x: 450,
              y: 250,
            },
          },
          graph_id: '4600fa94-4226-4a53-bab7-16c06799c614',
          graph_version: 1,
          strategy: 'native',
        },
      },
    };

    const yamlString = yamlDump(automationConfig);
    const result = await transpiler.fromYaml(yamlString);

    expect(result.success).toBe(true);
    const nodes = result.graph!.nodes;

    // Should have created 2 nodes
    expect(nodes).toHaveLength(2);

    // Find trigger and action nodes
    const triggerNode = nodes.find((node) => node.type === 'trigger');
    const actionNode = nodes.find((node) => node.type === 'action');

    expect(triggerNode).toBeTruthy();
    expect(actionNode).toBeTruthy();

    // When metadata is present, positions should be restored
    expect(result.hadMetadata).toBe(true);

    // Check that positions were restored (should match saved positions)
    expect(triggerNode?.position.x).toBe(150);
    expect(triggerNode?.position.y).toBe(200);
    expect(actionNode?.position.x).toBe(450);
    expect(actionNode?.position.y).toBe(250);
  });

  it('should handle missing metadata gracefully', async () => {
    const automationConfigWithoutMetadata = {
      alias: 'Simple Automation',
      trigger: [{ trigger: 'state', entity_id: 'sensor.test' }],
      action: [{ service: 'light.turn_on', entity_id: 'light.test' }],
      mode: 'single',
    };

    const yamlString = yamlDump(automationConfigWithoutMetadata);
    const result = await transpiler.fromYaml(yamlString);

    expect(result.success).toBe(true);
    const nodes = result.graph!.nodes;

    expect(nodes).toHaveLength(2);
    expect(result.hadMetadata).toBe(false);

    // Should use ELK layout positions when no metadata
    const triggerNode = nodes.find((node) => node.type === 'trigger');
    const actionNode = nodes.find((node) => node.type === 'action');

    // ELK layout generates valid positions
    expect(triggerNode?.position.x).toBeGreaterThanOrEqual(0);
    expect(triggerNode?.position.y).toBeGreaterThanOrEqual(0);
    expect(actionNode?.position.x).toBeGreaterThanOrEqual(0);
    expect(actionNode?.position.y).toBeGreaterThanOrEqual(0);
  });
});
