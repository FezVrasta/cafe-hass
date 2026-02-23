import type { FlowGraph } from '@cafe/shared';
import { describe, expect, it } from 'vitest';
import { FlowTranspiler } from '../FlowTranspiler';

describe('workspace metadata roundtrip', () => {
  it('parses v1 metadata and applies workspace defaults', async () => {
    const yaml = `
alias: Legacy Automation
trigger:
  - trigger: state
    entity_id: binary_sensor.motion
action:
  - service: light.turn_on
variables:
  _cafe_metadata:
    version: 1
    strategy: native
    graph_id: 123e4567-e89b-12d3-a456-426614174000
    graph_version: 1
    nodes: {}
`;

    const transpiler = new FlowTranspiler();
    const parsed = await transpiler.fromYaml(yaml);

    expect(parsed.success).toBe(true);
    expect(parsed.graph?.workspace).toEqual({
      mode: 'single',
      sources: [],
    });
  });

  it('writes and restores workspace/navigator metadata in v2', async () => {
    const transpiler = new FlowTranspiler();
    const flow: FlowGraph = {
      id: '123e4567-e89b-12d3-a456-426614174111',
      name: 'Merged Workspace',
      description: 'test',
      version: 1,
      metadata: {
        mode: 'single',
        initial_state: true,
      },
      workspace: {
        mode: 'merged',
        sources: [
          {
            automation_id: '1001',
            entity_id: 'automation.one',
            alias: 'One',
            node_prefix: 'one_1',
            imported_at: '2026-02-22T12:00:00.000Z',
          },
        ],
      },
      navigator: {
        primary_area_id: 'living_room',
      },
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: {
            trigger: 'state',
            entity_id: 'binary_sensor.motion',
          },
        },
        {
          id: 'action_1',
          type: 'action',
          position: { x: 200, y: 0 },
          data: {
            service: 'light.turn_on',
          },
        },
      ],
      edges: [
        {
          id: 'edge_1',
          source: 'trigger_1',
          target: 'action_1',
        },
      ],
    };

    const result = transpiler.transpile(flow);
    expect(result.success).toBe(true);
    expect(result.yaml).toContain('version: 2');
    expect(result.yaml).toContain('workspace:');
    expect(result.yaml).toContain('navigator:');

    const parsed = await transpiler.fromYaml(result.yaml!);
    expect(parsed.success).toBe(true);
    expect(parsed.graph?.workspace).toEqual(flow.workspace);
    expect(parsed.graph?.navigator).toEqual(flow.navigator);
  });
});

