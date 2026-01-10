// @vitest-environment node
import { readFileSync } from 'fs';
import { yamlParser } from '../parser/YamlParser';
import path from 'path';
import type { ConditionNode } from '@cafe/shared';

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
    const triggerCount = nodes.filter((n) => n.type === 'trigger').length;
    const conditionCount = nodes.filter((n) => n.type === 'condition').length;
    const actionCount = nodes.filter((n) => n.type === 'action').length;
    expect(triggerCount).toBe(3);
    expect(conditionCount).toBe(3);
    expect(actionCount).toBe(4);
    expect(nodes.length).toBe(10);
  });

  it('parses template condition with value_template field', () => {
    const yaml = `
alias: Template Test
triggers:
  - trigger: state
    entity_id: sensor.test
actions:
  - choose:
      - conditions:
          - condition: template
            value_template: "{{ states('sensor.test') == 'on' }}"
        sequence:
          - action: light.turn_on
            target:
              entity_id: light.test
`;
    const result = yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph!.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes.length).toBe(1);

    const templateCondition = conditionNodes[0];
    expect(templateCondition.data.condition_type).toBe('template');
    expect(templateCondition.data.template).toBe("{{ states('sensor.test') == 'on' }}");
    expect(templateCondition.data.value_template).toBe("{{ states('sensor.test') == 'on' }}");
  });

  it('parses nested conditions with value_template in choose block', () => {
    const yaml = `
alias: Nested Template Test
triggers:
  - trigger: state
    entity_id: sensor.test
actions:
  - choose:
      - conditions:
          - condition: and
            conditions:
              - condition: template
                value_template: "{{ is_state('binary_sensor.motion', 'on') }}"
              - condition: state
                entity_id: light.living_room
                state: 'off'
        sequence:
          - action: light.turn_on
            target:
              entity_id: light.living_room
`;
    const result = yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph!.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes.length).toBe(1);

    const andCondition = conditionNodes[0];
    expect(andCondition.data.condition_type).toBe('and');
    expect(andCondition.data.conditions).toBeDefined();
    expect(andCondition.data.conditions!.length).toBe(2);

    // Verify the template condition within the 'and' has its template populated
    const nestedTemplateCondition = andCondition.data.conditions!.find(
      (c) => c.condition_type === 'template'
    );
    expect(nestedTemplateCondition).toBeDefined();
    expect(nestedTemplateCondition!.template).toBe(
      "{{ is_state('binary_sensor.motion', 'on') }}"
    );
  });

  it('parses if/then/else with template condition', () => {
    const yaml = `
alias: If Template Test
triggers:
  - trigger: state
    entity_id: sensor.test
actions:
  - if:
      - condition: template
        value_template: "{{ now().hour >= 18 }}"
    then:
      - action: light.turn_on
        target:
          entity_id: light.test
    else:
      - action: light.turn_off
        target:
          entity_id: light.test
`;
    const result = yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph!.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes.length).toBe(1);

    const ifCondition = conditionNodes[0];
    expect(ifCondition.data.condition_type).toBe('template');
    expect(ifCondition.data.template).toBe('{{ now().hour >= 18 }}');
    expect(ifCondition.data.value_template).toBe('{{ now().hour >= 18 }}');
  });

  it('parses top-level template condition', () => {
    const yaml = `
alias: Top Level Template Test
triggers:
  - trigger: state
    entity_id: sensor.test
conditions:
  - condition: template
    value_template: "{{ states('input_boolean.enabled') == 'on' }}"
actions:
  - action: light.turn_on
    target:
      entity_id: light.test
`;
    const result = yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph!.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes.length).toBe(1);

    const templateCondition = conditionNodes[0];
    expect(templateCondition.data.condition_type).toBe('template');
    expect(templateCondition.data.template).toBe(
      "{{ states('input_boolean.enabled') == 'on' }}"
    );
    expect(templateCondition.data.value_template).toBe(
      "{{ states('input_boolean.enabled') == 'on' }}"
    );
  });
});
