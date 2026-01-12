import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';

const FIXTURES_DIR = join(__dirname, '../../../../__tests__/yaml-automation-fixtures');

function loadYamlFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

describe('YAML round-trip (fixtures)', () => {
  const fixtures = glob.sync('*.yaml', { cwd: FIXTURES_DIR });
  const parser = new YamlParser();
  const transpiler = new FlowTranspiler();

  for (const fixture of fixtures) {
    it(`parses and round-trips ${fixture} to identical YAML`, () => {
      const inputYaml = loadYamlFixture(fixture);
      // Parse YAML to FlowGraph
      const parseResult = parser.parse(inputYaml);
      if (!parseResult.success) {
        console.error('Parse errors:', parseResult.errors, 'Warnings:', parseResult.warnings);
      }

      expect(parseResult.success).toBe(true);
      expect(parseResult.graph).toBeDefined();
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

      expect(outputStripped).toEqual(inputStripped);
    });
  }
});
