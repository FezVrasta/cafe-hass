import type { FlowGraph } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { mergeAutomationGraphs, sanitizeSourcePrefix } from '../automation-merge';

function createGraph(idPrefix: string, xOffset = 0): FlowGraph {
  return {
    id: `${idPrefix}-graph`,
    name: `${idPrefix} graph`,
    description: '',
    version: 1,
    metadata: { mode: 'single', initial_state: true },
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 10 + xOffset, y: 20 },
        data: { trigger: 'state', entity_id: 'binary_sensor.motion' },
      },
      {
        id: 'action_1',
        type: 'action',
        position: { x: 150 + xOffset, y: 90 },
        data: { service: 'light.turn_on' },
      },
    ],
    edges: [
      {
        id: 'edge_1',
        source: 'trigger_1',
        target: 'action_1',
      },
    ],
    userVariables: { shared: `${idPrefix}-value` },
  };
}

describe('automation-merge', () => {
  it('creates deterministic, collision-free node and edge IDs', () => {
    const merged = mergeAutomationGraphs([
      {
        graph: createGraph('first'),
        automationId: '1001',
        entityId: 'automation.first',
        alias: 'First Flow',
        importedAt: '2026-02-22T12:00:00.000Z',
      },
      {
        graph: createGraph('second'),
        automationId: '1002',
        entityId: 'automation.second',
        alias: 'Second Flow',
        importedAt: '2026-02-22T12:01:00.000Z',
      },
    ]);

    const nodeIds = merged.nodes.map((node) => node.id);
    const edgeIds = merged.edges.map((edge) => edge.id);

    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
    expect(nodeIds.every((id) => id.includes('__'))).toBe(true);
    expect(edgeIds.every((id) => id.includes('__'))).toBe(true);
  });

  it('applies deterministic layout offsets per source', () => {
    const merged = mergeAutomationGraphs([
      {
        graph: createGraph('first', 0),
        automationId: '1001',
        entityId: 'automation.first',
        alias: 'First',
      },
      {
        graph: createGraph('second', 500),
        automationId: '1002',
        entityId: 'automation.second',
        alias: 'Second',
      },
    ]);

    const firstPrefix = sanitizeSourcePrefix('First', 0);
    const secondPrefix = sanitizeSourcePrefix('Second', 1);

    const firstTrigger = merged.nodes.find((node) => node.id === `${firstPrefix}__trigger_1`);
    const secondTrigger = merged.nodes.find((node) => node.id === `${secondPrefix}__trigger_1`);

    expect(firstTrigger).toBeDefined();
    expect(secondTrigger).toBeDefined();
    expect(secondTrigger!.position.x).toBeGreaterThan(firstTrigger!.position.x);
  });

  it('stores merged workspace source metadata', () => {
    const merged = mergeAutomationGraphs([
      {
        graph: createGraph('first'),
        automationId: '1001',
        entityId: 'automation.first',
        alias: 'First Flow',
        importedAt: '2026-02-22T12:00:00.000Z',
      },
      {
        graph: createGraph('second'),
        automationId: '1002',
        entityId: 'automation.second',
        alias: 'Second Flow',
        importedAt: '2026-02-22T12:01:00.000Z',
      },
    ]);

    expect(merged.workspace?.mode).toBe('merged');
    expect(merged.workspace?.sources).toHaveLength(2);
    expect(merged.workspace?.sources[0]).toMatchObject({
      automation_id: '1001',
      entity_id: 'automation.first',
      alias: 'First Flow',
      imported_at: '2026-02-22T12:00:00.000Z',
    });
  });
});

