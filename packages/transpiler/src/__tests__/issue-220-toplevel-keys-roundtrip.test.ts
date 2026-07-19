import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../index';
import { YamlParser } from '../parser/YamlParser';

describe('Issue #220 - top-level keys round-trip', () => {
  const parser = new YamlParser();
  const transpiler = new FlowTranspiler();

  it('220a: preserves trigger_variables in round-trip', async () => {
    const yaml = `
alias: trigger_variables Test
trigger_variables:
  threshold: 25
  label: test-run
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - action: persistent_notification.create
    data:
      message: "threshold={{ threshold }}"
mode: single
`;
    const parseResult = await parser.parse(yaml);
    expect(parseResult.success).toBe(true);
    expect(parseResult.graph?.userTriggerVariables).toEqual({ threshold: 25, label: 'test-run' });

    const result = transpiler.transpile(parseResult.graph!);
    expect(result.success).toBe(true);

    const automation = result.output?.automation as Record<string, unknown>;
    expect(automation.trigger_variables).toEqual({ threshold: 25, label: 'test-run' });
  });

  it('220b: preserves initial_state: false in round-trip', async () => {
    const yaml = `
alias: initial_state Test
initial_state: false
triggers:
  - trigger: time
    at: "03:00:00"
conditions: []
actions:
  - action: persistent_notification.create
    data:
      message: Never shown
mode: single
`;
    const parseResult = await parser.parse(yaml);
    expect(parseResult.success).toBe(true);
    expect(parseResult.graph?.metadata?.initial_state).toBe(false);

    const result = transpiler.transpile(parseResult.graph!);
    expect(result.success).toBe(true);

    const automation = result.output?.automation as Record<string, unknown>;
    expect(automation.initial_state).toBe(false);
  });

  it('220b: does not write initial_state when it is true (default)', async () => {
    const yaml = `
alias: initial_state default Test
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - action: persistent_notification.create
    data:
      message: OK
mode: single
`;
    const parseResult = await parser.parse(yaml);
    expect(parseResult.success).toBe(true);

    const result = transpiler.transpile(parseResult.graph!);
    const automation = result.output?.automation as Record<string, unknown>;
    expect(automation.initial_state).toBeUndefined();
  });

  it('220c: preserves trace.stored_traces in round-trip', async () => {
    const yaml = `
alias: trace Test
trace:
  stored_traces: 20
triggers:
  - trigger: time_pattern
    minutes: /15
conditions: []
actions:
  - action: persistent_notification.create
    data:
      message: Running
mode: single
`;
    const parseResult = await parser.parse(yaml);
    expect(parseResult.success).toBe(true);
    expect(parseResult.graph?.metadata?.trace).toEqual({ stored_traces: 20 });

    const result = transpiler.transpile(parseResult.graph!);
    expect(result.success).toBe(true);

    const automation = result.output?.automation as Record<string, unknown>;
    expect(automation.trace).toEqual({ stored_traces: 20 });
  });

  it('220c: does not write trace when not in original', async () => {
    const yaml = `
alias: No trace Test
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
    to: "on"
conditions: []
actions:
  - action: persistent_notification.create
    data:
      message: OK
mode: single
`;
    const parseResult = await parser.parse(yaml);
    const result = transpiler.transpile(parseResult.graph!);
    const automation = result.output?.automation as Record<string, unknown>;
    expect(automation.trace).toBeUndefined();
  });

  it('220d: max and max_exceeded still work (control test)', async () => {
    const yaml = `
alias: max Test
triggers:
  - trigger: state
    entity_id: input_boolean.enabled
conditions: []
actions:
  - action: persistent_notification.create
    data:
      message: OK
mode: parallel
max: 3
max_exceeded: silent
`;
    const parseResult = await parser.parse(yaml);
    const result = transpiler.transpile(parseResult.graph!);
    const automation = result.output?.automation as Record<string, unknown>;
    expect(automation.max).toBe(3);
    expect(automation.max_exceeded).toBe('silent');
  });
});
