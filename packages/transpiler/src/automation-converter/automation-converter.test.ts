import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FlowGraphSchema } from '@cafe/shared';
import { glob } from 'glob';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  type AutomationConfig,
  convertAutomationConfigToNodes,
} from '../automation-converter/automation-converter';

const FIXTURES_DIR = join(__dirname, '../../../../__tests__/yaml-automation-fixtures');

function loadYamlFixture(name: string): any {
  const file = readFileSync(join(FIXTURES_DIR, name), 'utf8');
  return yaml.load(file);
}

describe('automation-converter (isolated)', () => {
  const fixtures = glob.sync('*.yaml', { cwd: FIXTURES_DIR });

  for (const fixture of fixtures) {
    it(`converts ${fixture} to strict FlowGraph`, () => {
      const yamlObj = loadYamlFixture(fixture);
      // Support both array and single automation in YAML
      const automations = Array.isArray(yamlObj) ? yamlObj : [yamlObj];
      for (const automation of automations) {
        // Only test the converter, not the full parser
        const config = automation as AutomationConfig;
        const { nodes, edges } = convertAutomationConfigToNodes(config);
        // Strict: validate every node and edge against the schema
        for (const node of nodes) {
          expect(() => FlowGraphSchema.shape.nodes.element.parse(node)).not.toThrow();
        }
        edges.forEach((edge, i) => {
          // Add a mock id for schema validation, in the real application edges are managed by the
          // flow store and added when a node is added to the canvas
          const edgeWithId = { ...edge, id: `mock-edge-${i}` };
          expect(() => FlowGraphSchema.shape.edges.element.parse(edgeWithId)).not.toThrow();
        });
        // Optionally: check for unique node IDs and valid edge references
        const nodeIds = new Set(nodes.map((n) => n.id));
        for (const edge of edges) {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        }
      }
    });
  }
});
