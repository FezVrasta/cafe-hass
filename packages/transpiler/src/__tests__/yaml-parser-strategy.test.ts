import { FlowTranspiler } from '../FlowTranspiler';
import { YamlParser } from '../parser/YamlParser';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

describe('YamlParser Strategy Selection', () => {
  it('should recommend "native" strategy for automations with multiple triggers pointing to the same condition', async () => {
    const yamlPath = path.resolve(
      __dirname,
      '../../../frontend/src/lib/__tests__/fixtures/10-multiple-entity-ids.yaml'
    );
    const yamlString = await fs.readFile(yamlPath, 'utf-8');

    const parser = new YamlParser();
    const parseResult = parser.parse(yamlString);

    expect(parseResult.success).toBe(true);
    expect(parseResult.graph).toBeDefined();

    if (!parseResult.graph) {
      return;
    }

    const transpiler = new FlowTranspiler();
    const analysis = transpiler.analyzeTopology(parseResult.graph);

    expect(analysis.recommendedStrategy).toBe('native');
  });
});
