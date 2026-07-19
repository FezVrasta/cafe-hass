import { describe, expect, it } from 'vitest';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #215 - datetime device-class trigger with offset (at: object form)', () => {
  const parser = new YamlParser();

  it('imports a time trigger whose `at` is an { entity_id, offset } object', async () => {
    const yaml = `
alias: Sunrise alarm
description: ""
triggers:
  - trigger: time
    at:
      entity_id: sensor.pixel_7a_next_alarm
      offset: "-00:05:00"
conditions: []
actions:
  - action: light.turn_on
    target:
      entity_id: light.bedroom
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const triggers = result.graph!.nodes.filter((n) => n.type === 'trigger');
    expect(triggers.length).toBe(1);
    expect((triggers[0].data as Record<string, unknown>).at).toEqual({
      entity_id: 'sensor.pixel_7a_next_alarm',
      offset: '-00:05:00',
    });
  });

  it('still imports a plain entity_id time trigger (no offset)', async () => {
    const yaml = `
alias: Alarm
triggers:
  - trigger: time
    at: sensor.pixel_7a_next_alarm
conditions: []
actions:
  - action: light.turn_on
    target:
      entity_id: light.bedroom
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const triggers = result.graph!.nodes.filter((n) => n.type === 'trigger');
    expect(triggers.length).toBe(1);
  });
});
