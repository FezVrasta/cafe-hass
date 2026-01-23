// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { yamlParser } from '../parser/YamlParser';

describe('YamlParser (failure check)', () => {
  it('fails if too many nodes are generated', async () => {
    const yamlPath = path.resolve(
      __dirname,
      '../../../../__tests__/yaml-automation-fixtures/09-templates.yaml'
    );
    const yamlString = readFileSync(yamlPath, 'utf8');
    const result = await yamlParser.parse(yamlString);
    // This test should fail if more than 13 nodes are generated
    // (13 = 3 triggers + 6 conditions exploded from choose blocks + 4 actions)
    expect(result.graph?.nodes.length).toBeLessThanOrEqual(13);
  });
});
