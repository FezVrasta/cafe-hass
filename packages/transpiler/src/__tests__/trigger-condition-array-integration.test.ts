// @vitest-environment node

import type { ConditionNode } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { yamlParser } from '../parser/YamlParser';

describe('Trigger Condition Array Parsing', () => {
  it('should parse trigger condition with array IDs from YAML', async () => {
    // Test YAML with trigger condition using array of IDs
    const yaml = `
alias: Trigger Condition Array Test
triggers:
  - id: arriving
    trigger: state
    entity_id: person.alice
    to: 'home'
  - id: leaving
    trigger: state
    entity_id: person.alice
    to: 'away'
  - id: motion_detected
    trigger: state
    entity_id: binary_sensor.motion
    to: 'on'
conditions:
  - condition: trigger
    id:
      - arriving
      - motion_detected
actions:
  - action: light.turn_on
    target:
      entity_id: light.entrance
`;

    // Parse YAML to FlowGraph
    const parseResult = await yamlParser.parse(yaml);
    expect(parseResult.success).toBe(true);
    expect(parseResult.graph).toBeDefined();

    const graph = parseResult.graph!;

    // Verify condition node has array of trigger IDs
    const conditionNodes = graph.nodes.filter(
      (n: any) => n.type === 'condition'
    ) as ConditionNode[];
    expect(conditionNodes).toHaveLength(1);

    const triggerCondition = conditionNodes[0];
    expect(triggerCondition.data.condition).toBe('trigger');
    expect(Array.isArray(triggerCondition.data.id)).toBe(true);
    expect(triggerCondition.data.id).toEqual(['arriving', 'motion_detected']);
  });

  it('should parse trigger condition with single ID from YAML', async () => {
    const yaml = `
alias: Single Trigger ID Test
triggers:
  - id: single_trigger
    trigger: state
    entity_id: sensor.test
    to: 'on'
conditions:
  - condition: trigger
    id: single_trigger
actions:
  - action: light.turn_on
`;

    const parseResult = await yamlParser.parse(yaml);
    expect(parseResult.success).toBe(true);

    const graph = parseResult.graph!;
    const conditionNodes = graph.nodes.filter(
      (n: any) => n.type === 'condition'
    ) as ConditionNode[];
    const triggerCondition = conditionNodes[0];

    expect(triggerCondition.data.condition).toBe('trigger');
    expect(typeof triggerCondition.data.id).toBe('string');
    expect(triggerCondition.data.id).toBe('single_trigger');
  });
});
