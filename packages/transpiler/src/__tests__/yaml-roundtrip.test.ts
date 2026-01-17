import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { describe, expect, it, vi } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

// Mock the generateIds functions for deterministic IDs
let mockNodeCounter = 0;
vi.mock('../utils/generateIds', () => ({
  generateNodeId: (type: string, index: number) => `${type}_test_${index}_${mockNodeCounter++}`,
  generateEdgeId: (source: string, target: string) => `e-${source}-${target}`,
  generateGraphId: () => `a18b0fbb-d966-432c-aba7-4f7361da8d29`,
  resetNodeCounter: () => {
    mockNodeCounter = 0;
  },
}));

const FIXTURES_DIR = join(__dirname, '../../../../__tests__/yaml-automation-fixtures');

/**
 * Test that specifically verifies condition properties are preserved during roundtrip.
 * This catches regressions like nested condition fields (weekday, after, before, etc.) being lost.
 */
describe('Condition property preservation', () => {
  const parser = new YamlParser();
  const transpiler = new FlowTranspiler();

  it('should preserve weekday in nested time condition (19-nested-condition.yaml)', async () => {
    const inputYaml = readFileSync(join(FIXTURES_DIR, '19-nested-condition.yaml'), 'utf8');

    // Parse the YAML
    const parseResult = await parser.parse(inputYaml);
    expect(parseResult.success).toBe(true);
    expect(parseResult.graph).toBeDefined();

    // Find the condition node
    const conditionNode = parseResult.graph!.nodes.find((n) => n.type === 'condition');
    expect(conditionNode).toBeDefined();

    // Verify the condition data has the weekday field preserved
    const conditionData = conditionNode!.data as Record<string, unknown>;

    // The condition should be an 'and' type with nested conditions
    expect(conditionData.condition_type).toBe('and');
    expect(conditionData.conditions).toBeDefined();
    expect(Array.isArray(conditionData.conditions)).toBe(true);

    // The nested condition should be a time condition with weekday
    const nestedConditions = conditionData.conditions as Record<string, unknown>[];
    expect(nestedConditions.length).toBeGreaterThan(0);

    const timeCondition = nestedConditions.find((c) => c.condition_type === 'time');
    expect(timeCondition).toBeDefined();
    expect(timeCondition!.weekday).toBeDefined();
    expect(timeCondition!.weekday).toEqual(['sat']);

    // Convert back to YAML and verify the weekday is still present
    const outputYaml = transpiler.toYaml(parseResult.graph!);
    expect(outputYaml).toContain('weekday');
    expect(outputYaml).toContain('sat');
  });
});

function loadYamlFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

describe('YAML round-trip (fixtures)', async () => {
  const fixtures = glob.sync('*.yaml', { cwd: FIXTURES_DIR });
  const parser = new YamlParser();
  const transpiler = new FlowTranspiler();

  for (const fixture of fixtures) {
    const inputYaml = loadYamlFixture(fixture);
    // Parse YAML to FlowGraph
    const parseResult = await parser.parse(inputYaml);

    it(`parses ${fixture} successfully`, () => {
      expect(parseResult.success).toBe(true);
      expect(parseResult.graph).toBeDefined();
    });

    // Convert FlowGraph back to YAML
    const outputYaml = transpiler.toYaml(parseResult.graph!);

    it(`round-trips ${fixture} to identical YAML`, () => {
      expect(parseResult.success).toBe(true);
      expect(parseResult.graph).toBeDefined();

      expect(outputYaml).toMatchSnapshot();
    });
  }
});
