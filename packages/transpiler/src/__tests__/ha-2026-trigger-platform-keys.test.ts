// @vitest-environment node
import type { FlowGraph } from '@cafe/shared';
import { load as yamlLoad } from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

const automation = (triggers: string) => `
alias: Sunset lights
description: ""
triggers:
${triggers}
conditions: []
actions:
  - action: light.turn_on
    target:
      entity_id: light.living
mode: single
`;

const parser = new YamlParser();
const transpiler = new FlowTranspiler();

function triggersOf(yaml: string): Record<string, unknown>[] {
  return (yamlLoad(yaml) as { triggers: Record<string, unknown>[] }).triggers;
}

describe('HA 2026.10 sun trigger offsets', () => {
  it('imports the offset 0 the Home Assistant editor writes by default', async () => {
    const parsed = await parser.parse(
      automation(`  - trigger: sun
    event: sunset
    offset: 0`)
    );

    expect(parsed.success).toBe(true);
    expect(parsed.graph?.nodes[0]?.data).toMatchObject({
      trigger: 'sun',
      event: 'sunset',
      offset: 0,
    });
  });

  it('keeps a positive offset through a round trip', async () => {
    const parsed = await parser.parse(
      automation(`  - trigger: sun
    event: sunset
    offset: "+00:30:00"`)
    );
    expect(parsed.success).toBe(true);

    const output = transpiler.toYaml(parsed.graph!);
    expect(output).toContain('offset: "+00:30:00"');
  });

  it('keeps a negative offset through a round trip', async () => {
    const parsed = await parser.parse(
      automation(`  - trigger: sun
    event: sunset
    offset: "-00:30:00"`)
    );
    expect(parsed.success).toBe(true);

    const output = transpiler.toYaml(parsed.graph!);
    expect(output).toContain('offset: "-00:30:00"');
  });
});

describe('HA 2026.10 rejects trigger keys of another platform', () => {
  it('drops state trigger keys left on a sun trigger', async () => {
    const parsed = await parser.parse(
      automation(`  - trigger: sun
    event: sunset
    entity_id: light.living
    from: "on"
    to: "off"`)
    );
    expect(parsed.success).toBe(true);

    const output = transpiler.toYaml(parsed.graph!);
    expect(triggersOf(output)).toEqual([{ trigger: 'sun', event: 'sunset' }]);
  });

  it('drops keys of other platforms inside wait_for_trigger', () => {
    const flow: FlowGraph = {
      id: uuidv4(),
      name: 'Wait with stale keys',
      description: '',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'state', entity_id: 'input_boolean.test' },
        },
        {
          id: 'wait-1',
          type: 'wait',
          position: { x: 200, y: 0 },
          data: {
            wait_for_trigger: [
              { trigger: 'sun', event: 'sunset', entity_id: 'light.living', for: 60 },
            ],
          },
        },
        {
          id: 'action-1',
          type: 'action',
          position: { x: 400, y: 0 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e-t1-w1', source: 'trigger-1', target: 'wait-1' },
        { id: 'e-w1-a1', source: 'wait-1', target: 'action-1' },
      ],
      version: 1,
      metadata: { mode: 'single', initial_state: false },
    };

    const output = transpiler.transpile(flow);
    expect(output.success).toBe(true);
    const wait = (
      yamlLoad(output.yaml!) as { actions: { wait_for_trigger: unknown[] }[] }
    ).actions.find((step) => 'wait_for_trigger' in step);
    expect(wait?.wait_for_trigger).toEqual([{ trigger: 'sun', event: 'sunset' }]);
  });

  it('drops them in the state machine strategy too', async () => {
    const flow: FlowGraph = {
      id: uuidv4(),
      name: 'Two branches',
      description: '',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: { trigger: 'sun', event: 'sunset', entity_id: 'light.living' },
        },
        {
          id: 'trigger-2',
          type: 'trigger',
          position: { x: 0, y: 200 },
          data: { trigger: 'sun', event: 'sunrise' },
        },
        {
          id: 'action-1',
          type: 'action',
          position: { x: 300, y: 0 },
          data: { service: 'light.turn_on' },
        },
        {
          id: 'action-2',
          type: 'action',
          position: { x: 300, y: 200 },
          data: { service: 'light.turn_off' },
        },
      ],
      edges: [
        { id: 'e-t1-a1', source: 'trigger-1', target: 'action-1' },
        { id: 'e-t2-a2', source: 'trigger-2', target: 'action-2' },
      ],
      version: 1,
      metadata: { mode: 'single', initial_state: false },
    };

    const output = transpiler.transpile(flow);
    expect(output.success).toBe(true);
    expect(triggersOf(output.yaml!)).toEqual([
      { trigger: 'sun', event: 'sunset' },
      { trigger: 'sun', event: 'sunrise' },
    ]);
  });

  it('leaves device triggers alone, since their schema comes from the device registry', async () => {
    const parsed = await parser.parse(
      automation(`  - trigger: device
    device_id: 58fb330c048a594d671104b003de13f2
    domain: sensor
    type: changed_states
    entity_id: sensor.temperature
    above: 25`)
    );
    expect(parsed.success).toBe(true);

    expect(triggersOf(transpiler.toYaml(parsed.graph!))).toEqual([
      {
        trigger: 'device',
        device_id: '58fb330c048a594d671104b003de13f2',
        domain: 'sensor',
        type: 'changed_states',
        entity_id: 'sensor.temperature',
        above: 25,
      },
    ]);
  });

  it('leaves platforms C.A.F.E. does not know alone', async () => {
    const parsed = await parser.parse(
      automation(`  - trigger: power.crossed_threshold
    target:
      device_id: ac841705789afd9e919f31ac5007629d
    above: 100`)
    );
    expect(parsed.success).toBe(true);

    expect(triggersOf(transpiler.toYaml(parsed.graph!))).toEqual([
      {
        trigger: 'power.crossed_threshold',
        target: { device_id: 'ac841705789afd9e919f31ac5007629d' },
        above: 100,
      },
    ]);
  });
});
