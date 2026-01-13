import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { describe, expect, it } from 'vitest';
import { YamlParser } from '../parser/YamlParser';

const FIXTURES_DIR = join(__dirname, '../../../../__tests__/yaml-automation-fixtures');

function loadYamlFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

describe('parser.fromYaml', async () => {
  const fixtures = glob.sync('*.yaml', { cwd: FIXTURES_DIR });
  const parser = new YamlParser();

  for (const fixture of fixtures) {
    it(`should parse and transpile ${fixture} correctly`, async () => {
      const inputYaml = loadYamlFixture(fixture);
      // Parse YAML to FlowGraph
      const parseResult = await parser.parse(inputYaml);

      if (!parseResult.success) {
        console.error('Parse errors:', parseResult.errors, 'Warnings:', parseResult.warnings);
      }

      expect(parseResult.success).toBe(true);
      expect(parseResult.warnings).toHaveLength(0);
    });
  }
});
