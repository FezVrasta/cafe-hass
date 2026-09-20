import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../index';
import { YamlParser } from '../parser/YamlParser';

/**
 * A condition in the root `conditions:` block and a condition inside the action
 * sequence are not the same automation: `automation.trigger` skips the root block
 * by default, so an automation that another automation calls stops checking once
 * the condition is hoisted. Whatever the imported YAML had, the export keeps.
 */
describe('Issue #248 - conditions stay where the automation had them', () => {
  const parser = new YamlParser();

  it('keeps an if/then guard inside the actions', async () => {
    const yaml = `
alias: Living room chimney OFF
description: ""
triggers:
  - trigger: event
    event_type: cafe_dummy_trigger
conditions: []
actions:
  - if:
      - condition: state
        entity_id: binary_sensor.chimney_on_off_detection
        state:
          - "on"
    then:
      - action: switch.turn_on
        target:
          entity_id: switch.chimney
      - action: switch.turn_off
        target:
          entity_id: switch.chimney
mode: single
`;
    const parsed = await parser.parse(yaml);
    expect(parsed.success).toBe(true);

    const output = new FlowTranspiler().toYaml(parsed.graph!);

    // The guard stays in the sequence, where automation.trigger still runs it.
    expect(output).toMatch(/actions:\n {2}- if:\n {6}- condition: state/);
    expect(output).not.toMatch(/conditions:\n {2}- condition: state/);
  });

  it('keeps a bare condition guard inside the actions', async () => {
    const yaml = `
alias: Guarded sequence
description: ""
triggers:
  - trigger: state
    entity_id: binary_sensor.motion
    to: "on"
conditions: []
actions:
  - condition: state
    entity_id: binary_sensor.dark
    state: "on"
  - action: light.turn_on
    target:
      entity_id: light.hall
mode: single
`;
    const parsed = await parser.parse(yaml);
    const output = new FlowTranspiler().toYaml(parsed.graph!);

    expect(output).not.toMatch(/conditions:\n {2}- condition: state/);
    expect(output).toContain('binary_sensor.dark');
  });

  it('keeps a root condition at the root', async () => {
    const yaml = `
alias: Root condition
description: ""
triggers:
  - trigger: state
    entity_id: binary_sensor.motion
    to: "on"
conditions:
  - condition: state
    entity_id: binary_sensor.dark
    state: "on"
actions:
  - action: light.turn_on
    target:
      entity_id: light.hall
mode: single
`;
    const parsed = await parser.parse(yaml);
    const output = new FlowTranspiler().toYaml(parsed.graph!);

    expect(output).toMatch(/conditions:\n {2}- condition: state/);
    expect(output).toContain('binary_sensor.dark');
  });

  it("never writes C.A.F.E.'s own bookkeeping key into the YAML", async () => {
    const yaml = `
alias: Guarded sequence
description: ""
triggers:
  - trigger: state
    entity_id: binary_sensor.motion
    to: "on"
conditions: []
actions:
  - if:
      - condition: state
        entity_id: binary_sensor.dark
        state: "on"
    then:
      - action: light.turn_on
        target:
          entity_id: light.hall
mode: single
`;
    const parsed = await parser.parse(yaml);
    const output = new FlowTranspiler().toYaml(parsed.graph!);

    expect(output).not.toContain('cafe_in_sequence');
  });
});
