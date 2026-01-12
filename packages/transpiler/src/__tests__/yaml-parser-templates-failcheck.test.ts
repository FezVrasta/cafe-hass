// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { yamlParser } from '../parser/YamlParser';

describe('YamlParser (failure check)', () => {
  it('fails if too many nodes are generated', async () => {
    const yamlPath = path.resolve(
      __dirname,
      '../../../frontend/src/lib/__tests__/fixtures/09-templates.yaml'
    );
    const yamlString = readFileSync(yamlPath, 'utf8');
    const result = await yamlParser.parse(yamlString);
    // This test should fail if more than 10 nodes are generated (simulate stricter expectation)
    expect(result.graph?.nodes.length).toBeLessThanOrEqual(10);
  });
});
