// @vitest-environment node
import { readFileSync } from 'fs';
import { yamlParser } from '../parser/YamlParser';
import path from 'path';

describe('YamlParser', () => {
  it('parses 09-templates.yaml correctly', () => {
    const yamlPath = path.resolve(
      __dirname,
      '../../../frontend/src/lib/__tests__/fixtures/09-templates.yaml'
    );
    const yamlString = readFileSync(yamlPath, 'utf8');
    const result = yamlParser.parse(yamlString);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('YAML parser errors:', result.errors);
    }
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(result.graph).toBeDefined();
    const { nodes } = result.graph!;
    // Debug: log nodes for inspection
    // eslint-disable-next-line no-console
    console.log('Parsed nodes:', JSON.stringify(nodes, null, 2));
    // Should not contain unknown nodes
    expect(
      nodes.filter((n) => n.type === 'action' && n.data.alias?.startsWith('Unknown')).length
    ).toBe(0);

    // Strict: check exact node counts for this fixture
    // The fixture has:
    // - 3 triggers (2 zone triggers, 1 numeric_state trigger)
    // - 3 conditions (1 template in first choose branch, 1 numeric_state from if block, 1 template in second choose branch)
    // - 4 actions (1 notify in then, 2 in else branch: water_heater.turn_on + notify, 1 water_heater.turn_off in second choose)
    const triggerCount = nodes.filter(n => n.type === 'trigger').length;
    const conditionCount = nodes.filter(n => n.type === 'condition').length;
    const actionCount = nodes.filter(n => n.type === 'action').length;
    expect(triggerCount).toBe(3);
    expect(conditionCount).toBe(3);
    expect(actionCount).toBe(4);
    expect(nodes.length).toBe(10);
  });
});
