import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../index';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #214 - stop action is a first-class node (not "Unknown node")', () => {
  const parser = new YamlParser();

  it('parses `- stop: "..."` into a trigger-able action node carrying the stop text', async () => {
    const yaml = `
alias: Stop test
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - stop: Condition not met
    error: true
mode: single
`;
    const result = await parser.parse(yaml);
    expect(result.success).toBe(true);
    const actionNodes = result.graph!.nodes.filter((n) => n.type === 'action');
    expect(actionNodes.length).toBe(1);
    const data = actionNodes[0].data as Record<string, unknown>;
    expect(data.stop).toBe('Condition not met');
    expect(data.error).toBe(true);
    // Must be recognised as a stop action, not a generic/unknown service call
    expect(data.service).toBeUndefined();
  });

  it('round-trips a stop action back to `stop:`/`error:` (not service: unknown.unknown)', async () => {
    const yaml = `
alias: Stop roundtrip
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - stop: All done
mode: single
`;
    const parsed = await parser.parse(yaml);
    expect(parsed.success).toBe(true);
    const output = new FlowTranspiler().toYaml(parsed.graph!);
    expect(output).toContain('stop: All done');
    expect(output).not.toContain('unknown.unknown');
  });
});
