import { describe, expect, it } from 'vitest';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #221 - templated delay (object form)', () => {
  const parser = new YamlParser();

  it('accepts delay with template string in minutes field', async () => {
    const yaml = `
alias: Templated Delay Test
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - alias: Warte dynamisch lang
    delay:
      minutes: "{{ states('input_number.delay_minutes') | int(5) }}"
  - action: persistent_notification.create
    data:
      message: Done
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const delayNodes = result.graph!.nodes.filter((n) => n.type === 'delay');
    expect(delayNodes.length).toBe(1);
    expect((delayNodes[0].data as Record<string, unknown>).delay).toEqual({
      minutes: "{{ states('input_number.delay_minutes') | int(5) }}",
    });
  });

  it('accepts delay with template string in hours field', async () => {
    const yaml = `
alias: Templated Delay Hours
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - delay:
      hours: "{{ states('input_number.delay_hours') | int(1) }}"
      minutes: 30
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const delayNodes = result.graph!.nodes.filter((n) => n.type === 'delay');
    expect(delayNodes.length).toBe(1);
    const delayVal = (delayNodes[0].data as Record<string, unknown>).delay as Record<
      string,
      unknown
    >;
    expect(delayVal.hours).toBe("{{ states('input_number.delay_hours') | int(1) }}");
    expect(delayVal.minutes).toBe(30);
  });

  it('still accepts plain numeric delay object', async () => {
    const yaml = `
alias: Numeric Delay Test
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - delay:
      minutes: 5
      seconds: 30
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const delayNodes = result.graph!.nodes.filter((n) => n.type === 'delay');
    expect(delayNodes.length).toBe(1);
  });

  it('still accepts string delay (HH:MM:SS)', async () => {
    const yaml = `
alias: String Delay Test
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - delay: "00:05:00"
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const delayNodes = result.graph!.nodes.filter((n) => n.type === 'delay');
    expect(delayNodes.length).toBe(1);
  });

  it('accepts wait timeout with template string', async () => {
    const yaml = `
alias: Templated Wait Timeout
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - wait_template: "{{ is_state('input_boolean.done', 'on') }}"
    timeout:
      minutes: "{{ states('input_number.timeout_minutes') | int(10) }}"
    continue_on_timeout: true
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
  });
});
