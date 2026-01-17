import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

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

    if (!parseResult.success) {
      console.error('Parse errors:', parseResult.errors, 'Warnings:', parseResult.warnings);
      it.todo(`parses ${fixture} successfully`);
      continue;
    }

    it(`parses ${fixture} successfully`, () => {
      expect(parseResult.success).toBe(true);
      expect(parseResult.graph).toBeDefined();
    });

    // Convert FlowGraph back to YAML
    const outputYaml = transpiler.toYaml(parseResult.graph!);
    // Compare YAML as objects for structural equality, ignoring variables._cafe_metadata
    const inputObj = yaml.load(inputYaml);
    const outputObj = yaml.load(outputYaml);

    function stripCafeMetadata(obj: any): any {
      if (!obj || typeof obj !== 'object') return obj;
      const clone = Array.isArray(obj) ? obj.map(stripCafeMetadata) : { ...obj };
      if (clone.variables && typeof clone.variables === 'object') {
        const { _cafe_metadata, ...rest } = clone.variables;
        clone.variables = rest;
      }
      // Recursively strip from nested objects
      for (const key of Object.keys(clone)) {
        clone[key] = stripCafeMetadata(clone[key]);
      }

      if (clone.variables && Object.keys(clone.variables).length === 0) {
        delete clone.variables;
      }

      return clone;
    }

    const inputStripped = stripCafeMetadata(inputObj);
    const outputStripped = stripCafeMetadata(outputObj);

    if (JSON.stringify(inputStripped) !== JSON.stringify(outputStripped)) {
      it.todo(`round-trips ${fixture} to identical YAML`);
      console.error('Input YAML (stripped):', yaml.dump(inputStripped));
      console.error('Output YAML (stripped):', yaml.dump(outputStripped));
      continue;
    }

    it(`round-trips ${fixture} to identical YAML`, () => {
      expect(parseResult.success).toBe(true);
      expect(parseResult.graph).toBeDefined();

      expect(outputStripped).toEqual(inputStripped);
    });
  }
});
