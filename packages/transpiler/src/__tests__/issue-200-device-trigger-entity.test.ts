import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../index';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #200 - device trigger entity_id is a single entity', () => {
  const parser = new YamlParser();

  it('writes a one-entity list as a single entity', async () => {
    const yaml = `
alias: GR Light Switch
description: ""
triggers:
  - trigger: device
    entity_id:
      - update.gr_light_switch
    device_id: 58fb330c048a594d671104b003de13f2
    type: pressed
    domain: button
conditions: []
actions:
  - action: input_boolean.toggle
    target:
      entity_id: input_boolean.gr_light_helper
mode: single
`;
    const parsed = await parser.parse(yaml);
    expect(parsed.success).toBe(true);

    const output = new FlowTranspiler().toYaml(parsed.graph!);
    expect(output).toContain('entity_id: update.gr_light_switch');
    expect(output).not.toContain('- update.gr_light_switch');
  });

  it('leaves a state trigger’s entity list alone', async () => {
    const yaml = `
alias: Two sensors
description: ""
triggers:
  - trigger: state
    entity_id:
      - binary_sensor.one
      - binary_sensor.two
    to: "on"
conditions: []
actions:
  - action: input_boolean.toggle
    target:
      entity_id: input_boolean.helper
mode: single
`;
    const parsed = await parser.parse(yaml);
    const output = new FlowTranspiler().toYaml(parsed.graph!);

    expect(output).toContain('- binary_sensor.one');
    expect(output).toContain('- binary_sensor.two');
  });

  it('leaves a device trigger naming several entities alone', async () => {
    const yaml = `
alias: Two buttons
description: ""
triggers:
  - trigger: device
    entity_id:
      - event.one
      - event.two
    device_id: 58fb330c048a594d671104b003de13f2
    type: pressed
    domain: button
conditions: []
actions:
  - action: input_boolean.toggle
    target:
      entity_id: input_boolean.helper
mode: single
`;
    const parsed = await parser.parse(yaml);
    const output = new FlowTranspiler().toYaml(parsed.graph!);

    expect(output).toContain('- event.one');
    expect(output).toContain('- event.two');
  });
});
