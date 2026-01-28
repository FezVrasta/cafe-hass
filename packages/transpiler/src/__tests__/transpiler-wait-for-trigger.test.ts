// @vitest-environment node
import type { FlowGraph } from '@cafe/shared';
import { load as yamlLoad } from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { FlowTranspiler } from '../FlowTranspiler';

describe('FlowTranspiler', () => {
  it('transpiles a wait_for_trigger node correctly', () => {
    const flowGraph: FlowGraph = {
      id: uuidv4(),
      name: 'Wait for Trigger Flow',
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
              { trigger: 'state', entity_id: 'binary_sensor.door', to: 'on' },
              { trigger: 'event', event_type: 'my_event' },
            ],
            timeout: '00:00:30',
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
      metadata: {
        mode: 'single',
        initial_state: false,
      },
    };

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(flowGraph, { forceStrategy: 'native' });

    expect(result.success).toBe(true);
    expect(result.yaml).toBeDefined();

    const parsedYaml = yamlLoad(result.yaml!) as any;

    const waitAction = parsedYaml.actions[0];
    expect(waitAction.wait_for_trigger).toBeDefined();
    expect(waitAction.wait_for_trigger.length).toBe(2);
    expect(waitAction.timeout).toBe('00:00:30');

    const firstTrigger = waitAction.wait_for_trigger[0];
    expect(firstTrigger.trigger).toBe('state');
    expect(firstTrigger.entity_id).toBe('binary_sensor.door');

    const secondTrigger = waitAction.wait_for_trigger[1];
    expect(secondTrigger.trigger).toBe('event');
    expect(secondTrigger.event_type).toBe('my_event');
  });
});
