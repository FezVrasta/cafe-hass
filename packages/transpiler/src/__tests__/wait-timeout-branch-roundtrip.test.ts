// @vitest-environment node
// Covers the "branch on wait timeout" pattern used to fix
// https://github.com/FezVrasta/cafe-hass/issues/226: a Wait node followed by
// a template Condition node checking `wait.trigger`/`wait.completed`, wired
// with 'true'/'false' branches — exactly what the frontend's
// `addWaitTimeoutBranch` store action builds. No dedicated transpiler/parser
// support is needed for this: it's an ordinary Wait -> Condition chain using
// existing choose/if machinery, verified end to end here.
import { type FlowGraph, isActionNode } from '@cafe/shared';
import { load as yamlLoad } from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { FlowTranspiler } from '../FlowTranspiler';

function buildFlow(waitData: Record<string, unknown>): FlowGraph {
  return {
    id: uuidv4(),
    name: 'Wait Timeout Branch Flow',
    description: '',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: { trigger: 'state', entity_id: 'binary_sensor.door' },
      },
      {
        id: 'wait-1',
        type: 'wait',
        position: { x: 200, y: 0 },
        data: waitData,
      },
      {
        id: 'cond-1',
        type: 'condition',
        position: { x: 400, y: 0 },
        data: { condition: 'template', value_template: '{{ wait.trigger is not none }}' },
      },
      {
        id: 'action-ok',
        type: 'action',
        position: { x: 600, y: -50 },
        data: { service: 'light.turn_on' },
      },
      {
        id: 'action-timeout',
        type: 'action',
        position: { x: 600, y: 50 },
        data: { service: 'notify.notify', data: { message: 'timed out' } },
      },
    ],
    edges: [
      { id: 'e-t1-w1', source: 'trigger-1', target: 'wait-1' },
      { id: 'e-w1-c1', source: 'wait-1', target: 'cond-1' },
      { id: 'e-c1-ok', source: 'cond-1', target: 'action-ok', sourceHandle: 'true' },
      { id: 'e-c1-timeout', source: 'cond-1', target: 'action-timeout', sourceHandle: 'false' },
    ],
    version: 1,
    metadata: { mode: 'single', initial_state: false },
  };
}

describe('Wait node timeout branching', () => {
  it('transpiles a wait_for_trigger node followed by a wait.trigger condition into an if/then/else', () => {
    const flow = buildFlow({
      wait_for_trigger: [{ trigger: 'state', entity_id: 'binary_sensor.motion', to: 'on' }],
      timeout: '00:05:00',
      continue_on_timeout: true,
    });

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(flow, { forceStrategy: 'native' });

    expect(result.success).toBe(true);
    const parsed = yamlLoad(result.yaml!) as {
      actions: [
        { wait_for_trigger: unknown[]; timeout: string; continue_on_timeout: boolean },
        { if: { value_template: string }[]; then: { service: string }[]; else: { service: string }[] },
      ];
    };

    const [waitAction, branchAction] = parsed.actions;
    expect(waitAction.wait_for_trigger).toHaveLength(1);
    expect(waitAction.timeout).toBe('00:05:00');
    expect(waitAction.continue_on_timeout).toBe(true);

    expect(branchAction.if[0].value_template).toBe('{{ wait.trigger is not none }}');
    expect(branchAction.then[0].service).toBe('light.turn_on');
    expect(branchAction.else[0].service).toBe('notify.notify');
  });

  it('round-trips back to a Wait node with true/false edges to the same two actions', async () => {
    const flow = buildFlow({
      wait_for_trigger: [{ trigger: 'state', entity_id: 'binary_sensor.motion', to: 'on' }],
      timeout: '00:05:00',
      continue_on_timeout: true,
    });

    const transpiler = new FlowTranspiler();
    const { yaml } = transpiler.transpile(flow, { forceStrategy: 'native' });
    const parseResult = await transpiler.fromYaml(yaml!);

    expect(parseResult.success).toBe(true);
    const graph = parseResult.graph!;

    const waitNode = graph.nodes.find((n) => n.type === 'wait');
    expect(waitNode).toBeDefined();
    expect(waitNode?.data.wait_for_trigger).toHaveLength(1);
    expect(waitNode?.data.continue_on_timeout).toBe(true);

    const conditionNode = graph.nodes.find((n) => n.type === 'condition');
    expect(conditionNode?.data.value_template).toBe('{{ wait.trigger is not none }}');

    const waitToCondition = graph.edges.find(
      (e) => e.source === waitNode?.id && e.target === conditionNode?.id
    );
    expect(waitToCondition).toBeDefined();

    const trueTarget = graph.edges.find(
      (e) => e.source === conditionNode?.id && e.sourceHandle === 'true'
    );
    const falseTarget = graph.edges.find(
      (e) => e.source === conditionNode?.id && e.sourceHandle === 'false'
    );
    const trueActionNode = graph.nodes.find((n) => n.id === trueTarget?.target);
    const falseActionNode = graph.nodes.find((n) => n.id === falseTarget?.target);
    expect(trueActionNode && isActionNode(trueActionNode) ? trueActionNode.data.service : null).toBe(
      'light.turn_on'
    );
    expect(
      falseActionNode && isActionNode(falseActionNode) ? falseActionNode.data.service : null
    ).toBe('notify.notify');
  });

  it('works with wait_template using wait.completed', () => {
    const flow = buildFlow({
      wait_template: "{{ is_state('binary_sensor.motion', 'on') }}",
      timeout: '00:05:00',
      continue_on_timeout: true,
    });
    flow.nodes.find((n) => n.id === 'cond-1')!.data.value_template = '{{ wait.completed }}';

    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(flow, { forceStrategy: 'native' });

    expect(result.success).toBe(true);
    const parsed = yamlLoad(result.yaml!) as {
      actions: [unknown, { if: { value_template: string }[] }];
    };
    expect(parsed.actions[1].if[0].value_template).toBe('{{ wait.completed }}');
  });
});
