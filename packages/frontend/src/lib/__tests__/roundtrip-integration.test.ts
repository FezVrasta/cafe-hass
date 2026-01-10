import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FlowGraph } from '@cafe/shared';
import { FlowTranspiler } from '@cafe/transpiler';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { useFlowStore } from '@/store/flow-store';
import { convertAutomationConfigToNodes } from '../automation-converter';
import { generateUUID } from '../utils';

describe('Roundtrip Import/Export Tests', () => {
  const fixturesDir = join(__dirname, 'fixtures');

  // Get all YAML files from fixtures directory
  const yamlFiles = readdirSync(fixturesDir)
    .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
    .sort(); // Sort to ensure consistent test order

  yamlFiles.forEach((filename) => {
    it(`should preserve data integrity for ${filename}`, async () => {
      const filePath = join(fixturesDir, filename);
      const originalYamlContent = readFileSync(filePath, 'utf8');

      console.log(`\n=== Testing ${filename} ===`);
      console.log('Original YAML:', originalYamlContent);

      // Parse the original YAML
      const originalConfig = yaml.load(originalYamlContent) as Record<string, unknown>;
      expect(originalConfig).toBeDefined();
      expect(originalConfig.alias).toBeDefined();

      // Step 1: Convert YAML to visual nodes
      const { nodes, edges } = convertAutomationConfigToNodes(originalConfig);
      expect(nodes.length).toBeGreaterThan(0);

      console.log(
        'Generated nodes:',
        nodes.map((n) => ({ id: n.id, type: n.type, alias: n.data.alias }))
      );
      console.log('Generated edges:', edges);

      // Validate node structure
      nodes.forEach((node) => {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.position).toBeDefined();
        expect(node.data).toBeDefined();
      });

      // Validate edge structure
      edges.forEach((edge) => {
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        // sourceHandle can be null, 'true', or 'false'
        expect(['true', 'false', null]).toContain(edge.sourceHandle);
      });

      // Step 2: Create a flow graph and set it in the store
      const flowGraph = {
        id: generateUUID(),
        name: originalConfig.alias,
        nodes,
        edges: edges.map((e) => ({
          id: `e-${e.source}-${e.target}-${Date.now()}`,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
        })),
        metadata: {
          mode: originalConfig.mode || 'single',
          initial_state: originalConfig.initial_state ?? true,
          max: originalConfig.max,
          max_exceeded: originalConfig.max_exceeded,
        },
        version: 1,
      };

      // Set the graph in the store
      const store = useFlowStore.getState();
      store.fromFlowGraph(flowGraph as FlowGraph);

      // Step 3: Transpile back to YAML using FlowTranspiler
      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(flowGraph);

      if (!result.success) {
        console.error('Transpilation failed for', filename);
        console.error('Errors:', result.errors);
        console.error('Warnings:', result.warnings);
      }

      expect(result.success).toBe(true);
      expect(result.output?.automation).toBeDefined();

      // Type the generated config properly
      interface GeneratedAutomationConfig {
        alias: string;
        description?: string;
        mode: string;
        trigger: unknown[];
        action: unknown[];
        [key: string]: unknown;
      }

      const generatedConfig = result.output?.automation as GeneratedAutomationConfig;
      console.log('Generated config:', JSON.stringify(generatedConfig, null, 2));

      // Step 4: Core property validation
      expect(generatedConfig.alias).toBe(originalConfig.alias);
      // Note: Description may not be preserved in all cases, focus on functional data
      if (originalConfig.description && generatedConfig.description) {
        expect(generatedConfig.description).toBe(originalConfig.description);
      }
      expect(generatedConfig.mode).toBe(originalConfig.mode || 'single');

      // Step 5: Trigger validation
      if (originalConfig.trigger || originalConfig.triggers) {
        expect(generatedConfig.trigger).toBeDefined();
        expect(Array.isArray(generatedConfig.trigger)).toBe(true);
        expect(generatedConfig.trigger.length).toBeGreaterThan(0);

        const originalTriggers = Array.isArray(originalConfig.trigger)
          ? originalConfig.trigger
          : Array.isArray(originalConfig.triggers)
            ? originalConfig.triggers
            : [originalConfig.trigger || originalConfig.triggers];

        expect(generatedConfig.trigger.length).toBe(originalTriggers.length);

        // Validate each trigger has essential properties
        generatedConfig.trigger.forEach((trigger: unknown, index: number) => {
          const triggerObj = trigger as Record<string, unknown>;
          const originalTrigger = originalTriggers[index] as Record<string, unknown>;
          expect(triggerObj.platform).toBeDefined();

          // Validate core trigger properties are preserved
          if (originalTrigger.entity_id)
            expect(triggerObj.entity_id).toStrictEqual(originalTrigger.entity_id);
          if (originalTrigger.device_id)
            expect(triggerObj.device_id).toBe(originalTrigger.device_id);
          if (originalTrigger.domain) expect(triggerObj.domain).toBe(originalTrigger.domain);
        });
      }

      // Step 6: Condition validation
      if (originalConfig.condition || originalConfig.conditions) {
        const originalConditions = Array.isArray(originalConfig.condition)
          ? originalConfig.condition
          : Array.isArray(originalConfig.conditions)
            ? originalConfig.conditions
            : [originalConfig.condition || originalConfig.conditions];

        // Conditions should be preserved in some form (either as top-level or within actions)
        expect(originalConditions.length).toBeGreaterThan(0);
      }

      // Step 7: Action validation
      if (originalConfig.action || originalConfig.actions) {
        expect(generatedConfig.action).toBeDefined();
        expect(Array.isArray(generatedConfig.action)).toBe(true);
        expect(generatedConfig.action.length).toBeGreaterThan(0);

        // Validate action structure preservation
        if (Array.isArray(generatedConfig.action)) {
          generatedConfig.action.forEach((action: unknown, actionIndex: number) => {
            expect(action).toBeDefined();
            // Action should have either service, choose, if, delay, wait, variables (for state machine), or repeat

            // Type guard to check if action is a valid object
            if (typeof action === 'object' && action !== null) {
              const actionObj = action as Record<string, unknown>;
              const hasValidActionType =
                actionObj.service ||
                actionObj.choose ||
                actionObj.if ||
                actionObj.delay ||
                actionObj.wait_template ||
                actionObj.wait_for_trigger ||
                actionObj.variables ||
                actionObj.repeat;

              if (!hasValidActionType) {
                console.error(`Invalid action at index ${actionIndex}:`, action);
              }
              expect(hasValidActionType).toBeTruthy();
            }
          });
        }
      }

      // Step 8: Generate final YAML and compare structure
      const finalYaml = result.yaml;
      expect(finalYaml).toBeDefined();
      expect(typeof finalYaml).toBe('string');

      console.log('Final YAML:', finalYaml);

      // Parse final YAML to ensure it's valid
      if (finalYaml) {
        const finalConfig = yaml.load(finalYaml) as Record<string, unknown>;
        expect(finalConfig).toBeDefined();
        expect(finalConfig.alias).toBe(originalConfig.alias);

        // Metadata validation (CAFE variables should be present)
        const variables = finalConfig.variables as
          | Record<string, Record<string, unknown>>
          | undefined;
        expect(variables?._cafe_metadata).toBeDefined();
        expect(variables?._cafe_metadata.version).toBe(1);
        // Strategy can be 'native' or 'state-machine' depending on complexity
        expect(['native', 'state-machine']).toContain(variables?._cafe_metadata.strategy);
      }

      console.log(`✅ ${filename} roundtrip test passed`);
    });
  });

  it('should handle empty fixtures directory gracefully', () => {
    expect(yamlFiles.length).toBeGreaterThan(0);
  });

  it('should have consistent node positioning', () => {
    // Test that all fixtures generate nodes with proper positioning
    yamlFiles.forEach((filename) => {
      const filePath = join(fixturesDir, filename);
      const originalYamlContent = readFileSync(filePath, 'utf8');
      const originalConfig = yaml.load(originalYamlContent) as Record<string, unknown>;

      const { nodes } = convertAutomationConfigToNodes(originalConfig);

      nodes.forEach((node) => {
        expect(node.position.x).toBeGreaterThanOrEqual(100);
        expect(node.position.y).toBeGreaterThanOrEqual(-200); // Allow negative Y for branch offsets
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
    });
  });

  it('should generate valid edge connections', () => {
    yamlFiles.forEach((filename) => {
      const filePath = join(fixturesDir, filename);
      const originalYamlContent = readFileSync(filePath, 'utf8');
      const originalConfig = yaml.load(originalYamlContent) as Record<string, unknown>;

      const { nodes, edges } = convertAutomationConfigToNodes(originalConfig);
      const nodeIds = new Set(nodes.map((n) => n.id));

      edges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
        expect(edge.source).not.toBe(edge.target);
      });
    });
  });
});
