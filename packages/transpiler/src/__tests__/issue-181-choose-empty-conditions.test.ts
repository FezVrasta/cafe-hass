import { describe, expect, it } from 'vitest';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #181 - choose block with a default / empty-conditions case', () => {
  const parser = new YamlParser();

  it('does not crash importing a choose case with `conditions: []`', async () => {
    // Exact reproduction from the issue. Previously threw
    // "Cannot read properties of undefined (reading 'id')".
    const yaml = `
alias: delete.choose test
description: ""
triggers: []
conditions: []
actions:
  - choose:
      - conditions: []
        sequence: []
mode: single
`;
    // The parse must resolve (not throw); an empty-conditions choice is skipped.
    await expect(parser.parse(yaml)).resolves.toBeDefined();
  });

  it('imports a choose block that mixes a real case with an empty-conditions case', async () => {
    const yaml = `
alias: Choose with default
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - choose:
      - conditions:
          - condition: state
            entity_id: input_boolean.mode
            state: "on"
        sequence:
          - action: light.turn_on
            target:
              entity_id: light.kitchen
      - conditions: []
        sequence:
          - action: light.turn_off
            target:
              entity_id: light.kitchen
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    // The valid choice's condition node exists; the empty-conditions choice
    // was skipped without crashing.
    const conditionNodes = result.graph!.nodes.filter((n) => n.type === 'condition');
    expect(conditionNodes.length).toBeGreaterThanOrEqual(1);
  });
});
