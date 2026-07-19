import { describe, expect, it } from 'vitest';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #219 - trigger fallback (must have at least one trigger node)', () => {
  const parser = new YamlParser();

  it('handles event_type as array (modern HA multi-event trigger)', async () => {
    const yaml = `
alias: Test
triggers:
  - trigger: event
    event_type:
      - ha_started
      - homeassistant_started
conditions: []
actions:
  - action: light.turn_on
    target:
      entity_id: light.kitchen
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const triggers = result.graph!.nodes.filter((n) => n.type === 'trigger');
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  it('handles for: as a number (seconds)', async () => {
    const yaml = `
alias: Test
triggers:
  - trigger: state
    entity_id: sensor.temperature
    to: "on"
    for: 300
conditions: []
actions:
  - action: light.turn_on
    target:
      entity_id: light.kitchen
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const triggers = result.graph!.nodes.filter((n) => n.type === 'trigger');
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  it('handles dict-keyed trigger format (novel HA format)', async () => {
    const yaml = `
alias: Test
triggers:
  - state:
      entity_id: sensor.temperature
      to: "on"
conditions: []
actions:
  - action: light.turn_on
    target:
      entity_id: light.kitchen
mode: single
`;
    const result = await parser.parse(yaml);
    // Should not fail with "must have at least one trigger node"
    expect(result.success).toBe(true);
    const triggers = result.graph!.nodes.filter((n) => n.type === 'trigger');
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  it('handles for: with template string value in duration object', async () => {
    const yaml = `
alias: Test
triggers:
  - trigger: state
    entity_id: sensor.temperature
    to: "on"
    for:
      minutes: "{{ states('input_number.delay') | int }}"
conditions: []
actions:
  - action: light.turn_on
    target:
      entity_id: light.kitchen
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const triggers = result.graph!.nodes.filter((n) => n.type === 'trigger');
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });
});
