import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';

describe('If/Then/Else Parsing', () => {
  it('should correctly parse and transpile if/then/else with multiple conditions', async () => {
    const inputYaml = `
alias: Test If Then Else
description: ""
triggers:
  - trigger: state
    entity_id: sensor.test
actions:
  - if:
      - condition: state
        entity_id: switch.dingtian_relay9277_switch3
        state: "off"
      - condition: state
        entity_id: switch.dingtian_relay9277_switch7
        state: "on"
    then:
      - data: {}
        target:
          entity_id:
            - switch.dingtian_relay9277_switch7
        action: switch.turn_off
    else:
      - data: {}
        target:
          entity_id:
            - switch.dingtian_relay9277_switch3
            - switch.dingtian_relay9277_switch7
        action: switch.toggle
mode: single
`;

    const transpiler = new FlowTranspiler();
    const parseResult = await transpiler.fromYaml(inputYaml);

    // Should parse successfully
    expect(parseResult.success).toBe(true);
    expect(parseResult.errors ?? []).toHaveLength(0);
    expect(parseResult.warnings).toHaveLength(0);

    // Should have the correct nodes
    const graph = parseResult.graph!;
    expect(graph.nodes.length).toBeGreaterThanOrEqual(4); // trigger, condition, 2 actions

    // Find the condition node
    const conditionNode = graph.nodes.find((n) => n.type === 'condition');
    expect(conditionNode).toBeDefined();

    // Transpile back to YAML
    const transpileResult = transpiler.transpile(graph);
    expect(transpileResult.success).toBe(true);

    // The output should not contain garbage like "enablea" or duplicated conditions
    expect(transpileResult.yaml).not.toContain('enablea');
    expect(transpileResult.yaml).not.toContain('TaLse');

    // Should contain proper if/then/else structure
    expect(transpileResult.yaml).toContain('if:');
    expect(transpileResult.yaml).toContain('then:');
    expect(transpileResult.yaml).toContain('else:');

    console.log('Output YAML:');
    console.log(transpileResult.yaml);

    // Both conditions should appear in the output (but not duplicated)
    const switch3Matches = (transpileResult.yaml!.match(/switch\.dingtian_relay9277_switch3/g) || []).length;
    const switch7Matches = (transpileResult.yaml!.match(/switch\.dingtian_relay9277_switch7/g) || []).length;

    console.log('switch3 matches:', switch3Matches);
    console.log('switch7 matches:', switch7Matches);

    // switch3 should appear twice: once in condition, once in else action target
    expect(switch3Matches).toBe(2);
    // switch7 should appear 3 times: once in condition, once in then action target, once in else action target
    expect(switch7Matches).toBe(3);
  });
});
