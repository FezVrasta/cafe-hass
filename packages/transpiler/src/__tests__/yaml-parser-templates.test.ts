// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ConditionNode } from '@cafe/shared';
import { yamlParser } from '../parser/YamlParser';

describe('YamlParser', () => {
  it('parses trigger and condition with entity_id as array', async () => {
    const yaml = `
  alias: Array Entity Test
  triggers:
    - trigger: state
      entity_id:
        - sensor.one
        - sensor.two
  conditions:
    - condition: state
      entity_id:
        - binary_sensor.a
        - binary_sensor.b
      state: 'on'
  actions:
    - action: light.turn_on
      target:
        entity_id:
          - light.a
          - light.b
  `;
    const result = await yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const triggerNodes = result.graph?.nodes.filter((n) => n.type === 'trigger');
    expect(triggerNodes?.length).toBe(1);
    expect(Array.isArray(triggerNodes?.[0].data.entity_id)).toBe(true);
    expect(triggerNodes?.[0].data.entity_id).toEqual(['sensor.one', 'sensor.two']);

    const conditionNodes = result.graph?.nodes.filter((n) => n.type === 'condition');
    expect(conditionNodes?.length).toBe(1);
    expect(Array.isArray(conditionNodes?.[0].data.entity_id)).toBe(true);
    expect(conditionNodes?.[0].data.entity_id).toEqual(['binary_sensor.a', 'binary_sensor.b']);
  });
  it('parses 09-templates.yaml correctly', async () => {
    const yamlPath = path.resolve(
      __dirname,
      '../../../../__tests__/yaml-automation-fixtures/09-templates.yaml'
    );
    const yamlString = readFileSync(yamlPath, 'utf8');
    const result = await yamlParser.parse(yamlString);
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

  it('parses template condition with value_template field', async () => {
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
    const result = await yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph?.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes?.length).toBe(1);

    const templateCondition = conditionNodes?.[0];
    expect(templateCondition?.data.condition_type).toBe('template');
    expect(templateCondition?.data.template).toBeUndefined();
    expect(templateCondition?.data.value_template).toBe("{{ states('sensor.test') == 'on' }}");
  });

  it('parses nested conditions with value_template in choose block', async () => {
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
    const result = await yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph?.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes?.length).toBe(1);

    const andCondition = conditionNodes?.[0];
    expect(andCondition?.data.condition_type).toBe('and');
    expect(andCondition?.data.conditions).toBeDefined();
    expect(andCondition?.data.conditions?.length).toBe(2);

    // Verify the template condition within the 'and' has its template populated
    const nestedTemplateCondition = andCondition?.data.conditions?.find(
      (c) => c.condition_type === 'template'
    );
    expect(nestedTemplateCondition).toBeDefined();
    expect(nestedTemplateCondition?.template).toBeUndefined();
  });

  it('parses if/then/else with template condition', async () => {
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
    const result = await yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph?.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes?.length).toBe(1);

    const ifCondition = conditionNodes?.[0];
    expect(ifCondition?.data.condition_type).toBe('template');
    expect(ifCondition?.data.template).toBeUndefined();
    expect(ifCondition?.data.value_template).toBe('{{ now().hour >= 18 }}');
  });

  it('parses top-level template condition', async () => {
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
    const result = await yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const conditionNodes = result.graph?.nodes.filter(
      (n): n is ConditionNode => n.type === 'condition'
    );
    expect(conditionNodes?.length).toBe(1);

    const templateCondition = conditionNodes?.[0];
    expect(templateCondition?.data.condition_type).toBe('template');
    expect(templateCondition?.data.template).toBeUndefined();
    expect(templateCondition?.data.value_template).toBe(
      "{{ states('input_boolean.enabled') == 'on' }}"
    );
  });

  it('parses wait_for_trigger action', async () => {
    const yaml = `
alias: Wait for Trigger Test
trigger:
  - platform: state
    entity_id: input_boolean.start_test
    to: 'on'
action:
  - service: light.turn_on
    target:
      entity_id: light.test_light
  - wait_for_trigger:
      - platform: state
        entity_id: binary_sensor.door
        to: 'on'
      - platform: event
        event_type: my_custom_event
    timeout: '00:00:10'
  - service: light.turn_off
    target:
      entity_id: light.test_light
`;
    const result = await yamlParser.parse(yaml);
    expect(result.success).toBe(true);
    expect(result.graph).toBeDefined();

    const waitNode = result.graph?.nodes.find((n) => n.type === 'wait');
    expect(waitNode).toBeDefined();

    const waitData = waitNode?.data as any;
    expect(waitData.wait_for_trigger).toBeDefined();
    expect(Array.isArray(waitData.wait_for_trigger)).toBe(true);
    expect(waitData.wait_for_trigger.length).toBe(2);
    expect(waitData.timeout).toBe('00:00:10');

    const firstTrigger = waitData.wait_for_trigger[0];
    expect(firstTrigger.platform).toBe('state');
    expect(firstTrigger.entity_id).toBe('binary_sensor.door');
    expect(firstTrigger.to).toBe('on');

    const secondTrigger = waitData.wait_for_trigger[1];
    expect(secondTrigger.platform).toBe('event');
    expect(secondTrigger.event_type).toBe('my_custom_event');
  });
});
