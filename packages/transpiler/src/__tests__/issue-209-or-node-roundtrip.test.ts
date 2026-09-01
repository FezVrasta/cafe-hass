import { describe, expect, it } from 'vitest';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #209 - OR/AND condition nodes lose branches on import', () => {
  const parser = new YamlParser();

  it('preserves both branches of an OR condition parsed from a state-machine template', async () => {
    const yaml = `
alias: Study
description: ""
triggers:
  - alias: Study PIR
    trigger: state
    entity_id:
      - binary_sensor.epo_study_pir
    to: "on"
actions:
  - variables:
      current_node: "{% if trigger.idx == \\"0\\" %}condition_1776433902316_0{% else %}action_1776266360072_6{% endif %}"
      flow_context: {}
  - alias: State Machine Loop
    repeat:
      until: "{{ current_node == \\"END\\" }}"
      sequence:
        - choose:
            - conditions:
                - condition: template
                  value_template: "{{ current_node == \\"action_1776266360072_6\\" }}"
              sequence:
                - alias: Turn off light
                  service: light.turn_off
                  target:
                    entity_id:
                      - light.study_light
                - variables:
                    current_node: END
            - conditions:
                - condition: template
                  value_template: "{{ current_node == \\"condition_1776433902316_0\\" }}"
              sequence:
                - alias: Night or Dark?
                  variables:
                    current_node: "{% if (is_state('sun.sun', 'below_horizon') or state_attr('sensor.epo_study_illuminance', '25') == '') %}action_1776266360072_6{% else %}END{% endif %}"
mode: single
`;

    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);

    const conditionNode = result.graph!.nodes.find((n) => n.type === 'condition');
    expect(conditionNode).toBeDefined();

    const data = conditionNode!.data as Record<string, unknown>;
    // Before the fix, this collapsed to a single `sun` condition and silently
    // dropped the `state_attr(...)` branch entirely.
    expect(data.condition).toBe('or');
    expect(Array.isArray(data.conditions)).toBe(true);
    expect((data.conditions as unknown[]).length).toBe(2);

    const [first, second] = data.conditions as Record<string, unknown>[];
    expect(first.condition).toBe('sun');
    expect(second.condition).toBe('state');
    expect(second.entity_id).toBe('sensor.epo_study_illuminance');
    expect(second.attribute).toBe('25');
    expect(second.state).toBe('');
  });

  it('still parses a plain single-condition template without wrapping it in or/and', async () => {
    const yaml = `
alias: Simple Condition
triggers:
  - trigger: state
    entity_id: binary_sensor.motion
    to: "on"
actions:
  - variables:
      current_node: "{% if trigger.idx == \\"0\\" %}condition_1_0{% else %}action_1_1{% endif %}"
      flow_context: {}
  - alias: State Machine Loop
    repeat:
      until: "{{ current_node == \\"END\\" }}"
      sequence:
        - choose:
            - conditions:
                - condition: template
                  value_template: "{{ current_node == \\"condition_1_0\\" }}"
              sequence:
                - alias: Is dark?
                  variables:
                    current_node: "{% if is_state('sun.sun', 'below_horizon') %}action_1_1{% else %}END{% endif %}"
            - conditions:
                - condition: template
                  value_template: "{{ current_node == \\"action_1_1\\" }}"
              sequence:
                - alias: Turn on
                  service: light.turn_on
                  target:
                    entity_id:
                      - light.study_light
                - variables:
                    current_node: END
mode: single
`;

    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);

    const conditionNode = result.graph!.nodes.find((n) => n.type === 'condition');
    expect(conditionNode).toBeDefined();

    const data = conditionNode!.data as Record<string, unknown>;
    expect(data.condition).toBe('sun');
    expect(data.conditions).toBeUndefined();
  });
});
