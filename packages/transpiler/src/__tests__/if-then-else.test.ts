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
    const switch3Matches = (
      transpileResult.yaml!.match(/switch\.dingtian_relay9277_switch3/g) || []
    ).length;
    const switch7Matches = (
      transpileResult.yaml!.match(/switch\.dingtian_relay9277_switch7/g) || []
    ).length;

    console.log('switch3 matches:', switch3Matches);
    console.log('switch7 matches:', switch7Matches);

    // switch3 should appear twice: once in condition, once in else action target
    expect(switch3Matches).toBe(2);
    // switch7 should appear 3 times: once in condition, once in then action target, once in else action target
    expect(switch7Matches).toBe(3);
  });

  it('should not duplicate actions that come after an if/then/else block (issue #164)', async () => {
    // Regression test: when an if/then/else block is followed by more actions at the same level,
    // those actions were being duplicated into each branch of the condition.
    const inputYaml = `
alias: Test actions after condition
triggers:
  - trigger: state
    entity_id: binary_sensor.button
    to: "on"
actions:
  - if:
      - condition: state
        entity_id: switch.tv
        state: "off"
    then:
      - action: light.turn_on
        data:
          brightness_pct: 30
    else:
      - action: light.turn_off
        target:
          entity_id: light.main
  - action: switch.toggle
    data: {}
    target:
      entity_id: switch.tv
  - action: switch.toggle
    data: {}
    target:
      entity_id: switch.relay
mode: single
`;

    const transpiler = new FlowTranspiler();
    const parseResult = await transpiler.fromYaml(inputYaml);

    expect(parseResult.success).toBe(true);

    const transpileResult = transpiler.transpile(parseResult.graph!);
    expect(transpileResult.success).toBe(true);

    const yaml = transpileResult.yaml!;

    // switch.toggle should appear exactly twice (once per action), not duplicated into branches
    const toggleMatches = (yaml.match(/switch\.toggle/g) || []).length;
    expect(toggleMatches).toBe(2);

    // switch.tv should appear exactly twice: once in condition entity_id, once in toggle target
    const tvMatches = (yaml.match(/switch\.tv\b/g) || []).length;
    expect(tvMatches).toBe(2);

    // The if/then/else block should appear (condition not promoted since it has an else branch)
    expect(yaml).toContain('if:');
    expect(yaml).toContain('then:');
    expect(yaml).toContain('else:');
  });

  it('should not duplicate actions after nested if/then/else inside outer then block (issue #164 full case)', async () => {
    // The full reported case: outer if/then with nested if/then/else inside then branch,
    // followed by actions at the same level as the outer if.
    const inputYaml = `
alias: Full issue 164 test
triggers:
  - trigger: state
    entity_id: binary_sensor.button
    to: "on"
actions:
  - if:
      - condition: state
        entity_id: switch.tv
        state: "off"
    then:
      - action: light.turn_on
        data:
          brightness_pct: 30
      - if:
          - condition: numeric_state
            entity_id: sensor.days
            below: 30
        then:
          - action: tts.speak
            data:
              message: Many days left
        else:
          - action: tts.speak
            data:
              message: Few days left
      - action: media_player.volume_set
        data:
          volume_level: 0.5
        target:
          entity_id: media_player.tv
    else: []
  - action: switch.toggle
    data: {}
    target:
      entity_id: switch.tv
  - action: switch.toggle
    data: {}
    target:
      entity_id: switch.relay
mode: single
`;

    const transpiler = new FlowTranspiler();
    const parseResult = await transpiler.fromYaml(inputYaml);

    expect(parseResult.success).toBe(true);

    const transpileResult = transpiler.transpile(parseResult.graph!);
    expect(transpileResult.success).toBe(true);

    const yaml = transpileResult.yaml!;

    // switch.toggle at the end should appear exactly twice (not duplicated into the if branches)
    const toggleMatches = (yaml.match(/switch\.toggle/g) || []).length;
    expect(toggleMatches).toBe(2);

    // media_player.volume_set should appear exactly once (inside the outer then, after inner if)
    const volumeMatches = (yaml.match(/volume_set/g) || []).length;
    expect(volumeMatches).toBe(1);
  });

  it('should connect next action via false path when if has no else branch (issue #188)', async () => {
    // Sequential if-then blocks without else: each if's false path should connect
    // to the next action in sequence (not just the true path).
    const inputYaml = `
alias: Trigger ID sequential ifs
triggers:
  - trigger: state
    entity_id: binary_sensor.button_a
    to: "on"
    id: button_a
  - trigger: state
    entity_id: binary_sensor.button_b
    to: "on"
    id: button_b
actions:
  - if:
      - condition: trigger
        id: button_a
    then:
      - action: light.turn_on
        target:
          entity_id: light.a
  - if:
      - condition: trigger
        id: button_b
    then:
      - action: light.turn_on
        target:
          entity_id: light.b
mode: single
`;

    const transpiler = new FlowTranspiler();
    const parseResult = await transpiler.fromYaml(inputYaml);

    expect(parseResult.success).toBe(true);

    const graph = parseResult.graph!;

    // Should have 2 condition nodes, 2 action nodes
    const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
    expect(conditionNodes).toHaveLength(2);

    const actionNodes = graph.nodes.filter((n) => n.type === 'action');
    expect(actionNodes).toHaveLength(2);

    const edges = graph.edges;
    const firstCondId = conditionNodes[0].id;
    const secondCondId = conditionNodes[1].id;

    // With trigger-id routing, the two ifs are INDEPENDENT branches:
    // trigger_a → condition_1(button_a) → action_a
    // trigger_b → condition_2(button_b) → action_b
    // There must be NO edge connecting condition_1 to condition_2
    const chainEdge = edges.find(
      (e) => e.source === firstCondId && e.target === secondCondId
    );
    expect(chainEdge).toBeUndefined();

    // Each condition connects from its matching trigger only
    const triggerNodes = graph.nodes.filter((n) => n.type === 'trigger');
    expect(triggerNodes).toHaveLength(2);

    // Roundtrip: transpile back to YAML
    const transpileResult = transpiler.transpile(graph);
    if (!transpileResult.success) console.log('errors:', transpileResult.errors);
    console.log('YAML:\n', transpileResult.yaml);
    expect(transpileResult.success).toBe(true);

    const yaml = transpileResult.yaml!;
    // Both ifs should be present, not merged or duplicated
    const ifMatches = (yaml.match(/^\s+- if:/gm) || []).length;
    expect(ifMatches).toBe(2);

    // Each light should appear exactly once
    expect((yaml.match(/light\.a\b/g) || []).length).toBe(1);
    expect((yaml.match(/light\.b\b/g) || []).length).toBe(1);
  });

  it('should create independent flows when condition: trigger id is an array (real-world format)', async () => {
    // HA YAML allows `id: [T_ON]` (array) as well as `id: T_ON` (string).
    // Both must produce independent parallel branches, not a chained sequence.
    const inputYaml = `
alias: BathFlowers_automation
triggers:
  - trigger: state
    entity_id: binary_sensor.flowersinbath
    from: "off"
    to: "on"
    id: T_FlowerBath_to_ON
  - trigger: state
    entity_id: binary_sensor.flowersinbath
    from: "on"
    to: "off"
    id: T_FlowerBath_to_OFF
actions:
  - alias: Conditionally_Fower_ON
    if:
      - condition: trigger
        id:
          - T_FlowerBath_to_ON
    then:
      - action: switch.turn_on
        target:
          entity_id: switch.flower_light
  - alias: Conditionally_Flower_OFF
    if:
      - condition: trigger
        id:
          - T_FlowerBath_to_OFF
    then:
      - action: switch.turn_off
        target:
          entity_id: switch.flower_light
mode: restart
`;

    const transpiler = new FlowTranspiler();
    const parseResult = await transpiler.fromYaml(inputYaml);
    expect(parseResult.success).toBe(true);

    const graph = parseResult.graph!;
    const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
    expect(conditionNodes).toHaveLength(2);

    const firstCondId = conditionNodes[0].id;
    const secondCondId = conditionNodes[1].id;

    // No edge between the two conditions — they are independent
    const chainEdge = graph.edges.find(
      (e) => e.source === firstCondId && e.target === secondCondId
    );
    expect(chainEdge).toBeUndefined();

    // Each trigger connects only to its matching condition
    const triggerON = graph.nodes.find(
      (n) => n.type === 'trigger' && (n.data as Record<string, unknown>).id === 'T_FlowerBath_to_ON'
    );
    const triggerOFF = graph.nodes.find(
      (n) => n.type === 'trigger' && (n.data as Record<string, unknown>).id === 'T_FlowerBath_to_OFF'
    );
    expect(triggerON).toBeDefined();
    expect(triggerOFF).toBeDefined();

    // trigger_ON should NOT connect to the OFF condition
    const wrongEdge = graph.edges.find(
      (e) => e.source === triggerON!.id && e.target === secondCondId
    );
    expect(wrongEdge).toBeUndefined();

    // Roundtrip
    const transpileResult = transpiler.transpile(graph);
    expect(transpileResult.success).toBe(true);
    const yaml = transpileResult.yaml!;
    // Both conditions should appear in the output
    expect(yaml).toContain('T_FlowerBath_to_ON');
    expect(yaml).toContain('T_FlowerBath_to_OFF');
    expect(yaml).toContain('switch.turn_on');
    expect(yaml).toContain('switch.turn_off');
    // Should NOT use state-machine strategy
    expect(yaml).not.toContain('state_machine');
    expect(yaml).not.toContain('current_node');
  });
});
