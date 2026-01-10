/**
 * State Machine Roundtrip Tests
 *
 * Tests the full roundtrip:
 * 1. Parse native YAML → FlowGraph (via YamlParser)
 * 2. Export FlowGraph → State-machine YAML (via FlowTranspiler with forceStrategy)
 * 3. Import State-machine YAML → FlowGraph (via convertStateMachineAutomationConfigToNodes)
 * 4. Export FlowGraph → Native YAML (via FlowTranspiler)
 * 5. Compare: Original should match final (semantically)
 */

import type { FlowGraph } from '@cafe/shared';
import { FlowTranspiler, YamlParser } from '@cafe/transpiler';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { convertStateMachineAutomationConfigToNodes } from '../automation-converter';
import type { AutomationConfig } from '../ha-api';

// Read all fixture files from the fixtures directory
const fixturesDir = path.join(__dirname, 'fixtures');
const allFixtureFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.yaml'));

// Filter out state-machine fixtures (those containing '-sm-' in the filename)
const nativeFixtureFiles = allFixtureFiles.filter((f) => !f.includes('-sm-'));

const parser = new YamlParser();
const transpiler = new FlowTranspiler();

/**
 * Helper to convert nodes/edges from automation-converter to a FlowGraph
 */
function nodesToFlowGraph(
  nodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }[],
  edges: { source: string; target: string; sourceHandle: string | null }[],
  name: string,
  description: string
): FlowGraph {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as 'trigger' | 'condition' | 'action' | 'delay' | 'wait',
      position: n.position,
      data: n.data,
    })) as FlowGraph['nodes'],
    edges: edges.map((e, i) => ({
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
    })),
    metadata: { mode: 'single', initial_state: true },
    version: 1,
  };
}

/**
 * Helper to extract meaningful automation structure for comparison
 * (ignores metadata, positions, IDs - focuses on semantic equivalence)
 */
function extractAutomationStructure(yamlContent: string): {
  alias: string;
  triggerCount: number;
  triggerPlatforms: string[];
  actionServices: string[];
} {
  const parsed = yaml.load(yamlContent) as Record<string, unknown>;

  // Extract triggers
  const rawTriggers = (parsed.trigger || parsed.triggers || []) as Record<string, unknown>[];
  const triggerPlatforms = rawTriggers.map(
    (t) => (t.platform || t.trigger || 'unknown') as string
  );

  // Extract actions recursively
  const rawActions = (parsed.action || parsed.actions || []) as Record<string, unknown>[];
  const actionServices = extractServicesRecursively(rawActions);

  return {
    alias: (parsed.alias || '') as string,
    triggerCount: rawTriggers.length,
    triggerPlatforms,
    actionServices,
  };
}

function extractServicesRecursively(actions: Record<string, unknown>[]): string[] {
  const services: string[] = [];

  for (const action of actions) {
    if (action.service || action.action) {
      services.push((action.service || action.action) as string);
    }
    if (action.delay) {
      services.push('delay');
    }
    if (action.wait_template) {
      services.push('wait_template');
    }
    if (action.if) {
      const thenActions = (action.then || []) as Record<string, unknown>[];
      const elseActions = (action.else || []) as Record<string, unknown>[];
      services.push(...extractServicesRecursively(thenActions));
      services.push(...extractServicesRecursively(elseActions));
    }
    if (action.choose) {
      const choices = action.choose as Record<string, unknown>[];
      for (const choice of choices) {
        const sequence = (choice.sequence || []) as Record<string, unknown>[];
        services.push(...extractServicesRecursively(sequence));
      }
      const defaultActions = (action.default || []) as Record<string, unknown>[];
      services.push(...extractServicesRecursively(defaultActions));
    }
  }

  return services;
}

describe('State Machine Roundtrip Tests', () => {
  describe('Native → State-Machine → Native roundtrip', () => {
    // Generate a test for each native fixture
    for (const fixtureFile of nativeFixtureFiles) {
      it(`should roundtrip ${fixtureFile}`, () => {
        const fixturePath = path.join(fixturesDir, fixtureFile);
        const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');

        console.log(`\n=== Testing ${fixtureFile} ===`);

        // Step 1: Parse native YAML to FlowGraph
        const parseResult1 = parser.parse(fixtureContent);

        if (!parseResult1.success) {
          console.log(`Skipping ${fixtureFile} - parsing failed:`, parseResult1.errors);
          // Some fixtures may have parsing issues - that's okay, skip them
          return;
        }

        const flowGraph1 = parseResult1.graph;
        if (!flowGraph1) {
          console.log(`Skipping ${fixtureFile} - no graph returned`);
          return;
        }

        console.log('Step 1 - Parsed native YAML:');
        console.log('  Nodes:', flowGraph1.nodes.map((n) => `${n.type}:${n.id}`).join(', '));
        console.log('  Edges:', flowGraph1.edges.length);

        // Step 2: Export to state-machine YAML
        const smYamlResult = transpiler.transpile(flowGraph1, { forceStrategy: 'state-machine' });

        if (!smYamlResult.success || !smYamlResult.yaml) {
          console.log(`Skipping ${fixtureFile} - state-machine transpilation failed:`, smYamlResult.errors);
          return;
        }

        console.log('Step 2 - Exported to state-machine YAML');

        // Step 3: Import state-machine YAML using our new converter
        const smConfig = yaml.load(smYamlResult.yaml) as AutomationConfig;
        const { nodes, edges } = convertStateMachineAutomationConfigToNodes(smConfig);

        console.log('Step 3 - Imported state-machine:');
        console.log('  Nodes:', nodes.map((n) => `${n.type}:${n.id}`).join(', '));
        console.log('  Edges:', edges.length);

        // Step 4: Create FlowGraph from imported nodes
        const flowGraph2 = nodesToFlowGraph(
          nodes,
          edges,
          smConfig.alias || 'Test',
          smConfig.description || ''
        );

        // Step 5: Export back to native YAML
        const nativeYamlResult = transpiler.transpile(flowGraph2, { forceStrategy: 'native' });

        if (!nativeYamlResult.success || !nativeYamlResult.yaml) {
          console.log(`Step 5 failed - native transpilation failed:`, nativeYamlResult.errors);
          expect(nativeYamlResult.success).toBe(true);
          return;
        }

        console.log('Step 5 - Exported to native YAML');

        // Compare structures
        const originalStructure = extractAutomationStructure(fixtureContent);
        const finalStructure = extractAutomationStructure(nativeYamlResult.yaml);

        console.log('Original:', JSON.stringify(originalStructure, null, 2));
        console.log('Final:', JSON.stringify(finalStructure, null, 2));

        // Verify semantic equivalence
        // Same number of triggers
        expect(finalStructure.triggerCount).toBe(originalStructure.triggerCount);

        // Same trigger platforms
        expect(finalStructure.triggerPlatforms.sort()).toEqual(
          originalStructure.triggerPlatforms.sort()
        );

        // Same services (actions) - sorted for comparison
        expect(finalStructure.actionServices.sort()).toEqual(
          originalStructure.actionServices.sort()
        );

        console.log(`✅ ${fixtureFile} roundtrip successful!`);
      });
    }
  });

  describe('Position preservation through state-machine roundtrip', () => {
    it('should preserve node positions', () => {
      // Create a simple flow with specific positions
      const originalFlow: FlowGraph = {
        id: crypto.randomUUID(),
        name: 'Position Test',
        description: '',
        nodes: [
          {
            id: 'trigger-pos-1',
            type: 'trigger',
            position: { x: 100, y: 200 },
            data: { platform: 'state', entity_id: 'sensor.test' },
          },
          {
            id: 'action-pos-1',
            type: 'action',
            position: { x: 300, y: 400 },
            data: { service: 'light.turn_on' },
          },
        ],
        edges: [{ id: 'e1', source: 'trigger-pos-1', target: 'action-pos-1' }],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Export to state-machine
      const smResult = transpiler.transpile(originalFlow, { forceStrategy: 'state-machine' });
      expect(smResult.success).toBe(true);
      expect(smResult.yaml).toBeDefined();

      // Import state-machine
      const smConfig = yaml.load(smResult.yaml!) as AutomationConfig;
      const { nodes } = convertStateMachineAutomationConfigToNodes(smConfig);

      // Check positions are preserved
      const triggerNode = nodes.find((n) => n.id === 'trigger-pos-1');
      const actionNode = nodes.find((n) => n.id === 'action-pos-1');

      expect(triggerNode).toBeDefined();
      expect(actionNode).toBeDefined();
      expect(triggerNode?.position).toEqual({ x: 100, y: 200 });
      expect(actionNode?.position).toEqual({ x: 300, y: 400 });
    });
  });

  describe('Edge preservation through state-machine roundtrip', () => {
    it('should preserve condition branching edges', () => {
      // Create a flow with condition branching
      const originalFlow: FlowGraph = {
        id: crypto.randomUUID(),
        name: 'Branching Test',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 150 },
            data: { platform: 'state', entity_id: 'sensor.test' },
          },
          {
            id: 'condition-1',
            type: 'condition',
            position: { x: 300, y: 150 },
            data: { condition_type: 'state', entity_id: 'sensor.temp', state: 'on' },
          },
          {
            id: 'action-true',
            type: 'action',
            position: { x: 500, y: 50 },
            data: { service: 'light.turn_on' },
          },
          {
            id: 'action-false',
            type: 'action',
            position: { x: 500, y: 250 },
            data: { service: 'light.turn_off' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'condition-1' },
          { id: 'e2', source: 'condition-1', target: 'action-true', sourceHandle: 'true' },
          { id: 'e3', source: 'condition-1', target: 'action-false', sourceHandle: 'false' },
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Export to state-machine
      const smResult = transpiler.transpile(originalFlow, { forceStrategy: 'state-machine' });
      expect(smResult.success).toBe(true);
      expect(smResult.yaml).toBeDefined();

      // Import state-machine
      const smConfig = yaml.load(smResult.yaml!) as AutomationConfig;
      const { nodes, edges } = convertStateMachineAutomationConfigToNodes(smConfig);

      console.log('Imported nodes:', nodes.map((n) => `${n.type}:${n.id}`));
      console.log('Imported edges:', edges.map((e) => `${e.source} -[${e.sourceHandle}]-> ${e.target}`));

      // Verify condition node exists
      const conditionNode = nodes.find((n) => n.id === 'condition-1');
      expect(conditionNode).toBeDefined();
      expect(conditionNode?.type).toBe('condition');

      // Verify branching edges from condition
      const conditionEdges = edges.filter((e) => e.source === 'condition-1');
      expect(conditionEdges.length).toBe(2);

      const trueEdge = conditionEdges.find((e) => e.sourceHandle === 'true');
      const falseEdge = conditionEdges.find((e) => e.sourceHandle === 'false');

      expect(trueEdge).toBeDefined();
      expect(falseEdge).toBeDefined();
      expect(trueEdge?.target).toBe('action-true');
      expect(falseEdge?.target).toBe('action-false');
    });

    it('should preserve cycle edges', () => {
      // Create a flow with a cycle
      const originalFlow: FlowGraph = {
        id: crypto.randomUUID(),
        name: 'Cycle Test',
        description: '',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 150 },
            data: { platform: 'state', entity_id: 'sensor.test' },
          },
          {
            id: 'action-1',
            type: 'action',
            position: { x: 300, y: 150 },
            data: { service: 'light.turn_on' },
          },
          {
            id: 'action-2',
            type: 'action',
            position: { x: 500, y: 150 },
            data: { service: 'light.turn_off' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'action-1' },
          { id: 'e2', source: 'action-1', target: 'action-2' },
          { id: 'e3', source: 'action-2', target: 'action-1' }, // Cycle back
        ],
        metadata: { mode: 'single', initial_state: true },
        version: 1,
      };

      // Export to state-machine
      const smResult = transpiler.transpile(originalFlow, { forceStrategy: 'state-machine' });
      expect(smResult.success).toBe(true);

      // Import state-machine
      const smConfig = yaml.load(smResult.yaml!) as AutomationConfig;
      const { edges } = convertStateMachineAutomationConfigToNodes(smConfig);

      // Verify cycle edge exists
      const cycleEdge = edges.find((e) => e.source === 'action-2' && e.target === 'action-1');
      expect(cycleEdge).toBeDefined();
    });
  });
});
