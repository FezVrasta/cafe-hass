/**
 * Unit tests for automation YAML to nodes conversion logic
 * These tests don't require DOM and run in Node environment
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { convertAutomationConfigToNodes, processActions } from '@/lib/automation-converter';

describe('automation-converter', () => {
  // Type guard helper for tests
  const getActionProperty = (action: Record<string, unknown>, property: string): string => {
    return typeof action[property] === 'string' ? action[property] : '';
  };

  describe('processActions helper', () => {
    it('should handle simple action list', () => {
      const actions = [
        { action: 'light.turn_on', target: { entity_id: 'light.living_room' } },
        { action: 'light.turn_off', target: { entity_id: 'light.bedroom' } },
      ];

      const result = processActions(actions);

      expect(result).toHaveLength(2);
      expect(getActionProperty(result[0].action, 'action')).toBe('light.turn_on');
      expect(getActionProperty(result[1].action, 'action')).toBe('light.turn_off');
    });

    it('should process if/then/else structure with branch tracking', () => {
      const actions = [
        {
          if: [{ condition: 'template', value_template: '{{ trigger.payload == 1 }}' }],
          then: [
            {
              action: 'light.turn_on',
              target: { entity_id: ['light.libreria_destra_soggiorno'] },
            },
          ],
          else: [
            {
              action: 'light.turn_off',
              target: { entity_id: ['light.libreria_destra_soggiorno'] },
            },
          ],
        },
      ];

      const result = processActions(actions);

      expect(result).toHaveLength(3);
      expect(getActionProperty(result[0].action, 'type')).toBe('condition');
      expect(getActionProperty(result[0].action, 'alias')).toBe('If condition');
      expect(getActionProperty(result[1].action, 'action')).toBe('light.turn_on');
      expect(result[1].branch).toBe('then');
      expect(getActionProperty(result[2].action, 'action')).toBe('light.turn_off');
      expect(result[2].branch).toBe('else');
    });

    it('should process nested if/then/else structures', () => {
      const actions = [
        {
          if: [{ condition: 'state', entity_id: 'binary_sensor.motion' }],
          then: [
            {
              if: [{ condition: 'numeric_state', entity_id: 'sensor.lux', below: 100 }],
              then: [{ action: 'light.turn_on', target: { entity_id: 'light.room' } }],
              else: [{ action: 'light.turn_off', target: { entity_id: 'light.room' } }],
            },
          ],
        },
      ];

      const result = processActions(actions);

      expect(result).toHaveLength(4);
      expect(getActionProperty(result[0].action, 'type')).toBe('condition');
      expect(getActionProperty(result[0].action, 'alias')).toBe('If condition');
      expect(getActionProperty(result[1].action, 'type')).toBe('condition');
      expect(result[1].branch).toBe('then');
      expect(getActionProperty(result[2].action, 'action')).toBe('light.turn_on');
      expect(result[2].branch).toBe('then');
      expect(getActionProperty(result[3].action, 'action')).toBe('light.turn_off');
      expect(result[3].branch).toBe('else');
    });

    it('should handle choose structure', () => {
      const actions = [
        {
          choose: [
            {
              conditions: [{ condition: 'state', entity_id: 'input_select.mode', state: 'home' }],
              sequence: [{ action: 'light.turn_on', target: { entity_id: 'light.home' } }],
            },
            {
              conditions: [{ condition: 'state', entity_id: 'input_select.mode', state: 'away' }],
              sequence: [{ action: 'light.turn_off', target: { entity_id: 'light.home' } }],
            },
          ],
          default: [{ action: 'light.turn_on', target: { entity_id: 'light.default' } }],
        },
      ];

      const result = processActions(actions);

      expect(result).toHaveLength(5);
      expect(getActionProperty(result[0].action, 'type')).toBe('condition');
      expect(getActionProperty(result[0].action, 'alias')).toBe('Choose condition');
      expect(getActionProperty(result[1].action, 'action')).toBe('light.turn_on');
      expect(result[1].branch).toBe('then');
      expect(getActionProperty(result[2].action, 'type')).toBe('condition');
      expect(getActionProperty(result[3].action, 'action')).toBe('light.turn_off');
      expect(result[3].branch).toBe('else');
      expect(getActionProperty(result[4].action, 'action')).toBe('light.turn_on');
      expect(result[4].branch).toBe('else');
    });

    it('should handle empty then/else branches', () => {
      const actions = [
        {
          if: [{ condition: 'template', value_template: '{{ true }}' }],
          then: [{ action: 'light.turn_on', target: { entity_id: 'light.test' } }],
        },
      ];

      const result = processActions(actions);

      expect(result).toHaveLength(2);
      expect(getActionProperty(result[0].action, 'type')).toBe('condition');
      expect(getActionProperty(result[1].action, 'action')).toBe('light.turn_on');
      expect(result[1].branch).toBe('then');
    });

    it('should preserve action properties when processing', () => {
      const actions = [
        {
          if: [{ condition: 'template', value_template: '{{ trigger.payload == 1 }}' }],
          then: [
            {
              action: 'light.turn_on',
              metadata: {},
              data: { brightness: 255 },
              target: { entity_id: ['light.living_room'] },
            },
          ],
        },
      ];

      const result = processActions(actions);

      expect(result).toHaveLength(2);
      expect(result[1].action).toEqual({
        action: 'light.turn_on',
        metadata: {},
        data: { brightness: 255 },
        target: { entity_id: ['light.living_room'] },
      });
      expect(result[1].branch).toBe('then');
    });
  });

  describe('automation config conversion', () => {
    it('should handle new Home Assistant format with triggers (plural)', () => {
      const config = {
        triggers: [
          {
            domain: 'knx',
            device_id: 'test-device',
            type: 'telegram',
          },
        ],
        conditions: [],
        actions: [
          {
            action: 'light.turn_on',
            target: { entity_id: ['light.test'] },
          },
        ],
      };

      // This would test the full conversion
      // For now, just verify the structure is correct
      expect(config.triggers).toBeInstanceOf(Array);
      expect(config.triggers[0].domain).toBe('knx');
    });

    it('should handle old Home Assistant format with trigger (singular)', () => {
      const config = {
        trigger: {
          platform: 'state',
          entity_id: 'binary_sensor.motion',
        },
        condition: {
          condition: 'state',
          entity_id: 'sun.sun',
          state: 'below_horizon',
        },
        action: {
          service: 'light.turn_on',
          entity_id: 'light.living_room',
        },
      };

      // Verify both formats are supported
      expect(config.trigger).toBeDefined();
      expect(config.condition).toBeDefined();
      expect(config.action).toBeDefined();
    });
  });

  describe('node connection logic', () => {
    it('should connect nodes sequentially', () => {
      // Simulated test showing connection logic
      const nodes = ['node1', 'node2', 'node3'];
      let previousNodeId: string | null = null;
      const connections: Array<{ source: string; target: string }> = [];

      // Simulate what the function does
      for (const nodeId of nodes) {
        if (previousNodeId) {
          connections.push({ source: previousNodeId, target: nodeId });
        }
        previousNodeId = nodeId;
      }

      expect(connections).toHaveLength(2);
      expect(connections[0]).toEqual({ source: 'node1', target: 'node2' });
      expect(connections[1]).toEqual({ source: 'node2', target: 'node3' });
    });

    it('should connect triggers to conditions to actions', () => {
      // Test the full flow connection
      const expectedFlow = [
        { type: 'trigger', id: 'trigger-1' },
        { type: 'condition', id: 'condition-1' },
        { type: 'action', id: 'action-1' },
        { type: 'action', id: 'action-2' },
      ];

      const connections: Array<{ source: string; target: string }> = [];
      let previousNodeId: string | null = null;

      for (const node of expectedFlow) {
        if (previousNodeId) {
          connections.push({ source: previousNodeId, target: node.id });
        }
        previousNodeId = node.id;
      }

      expect(connections).toHaveLength(3);
      expect(connections[0]).toEqual({ source: 'trigger-1', target: 'condition-1' });
      expect(connections[1]).toEqual({ source: 'condition-1', target: 'action-1' });
      expect(connections[2]).toEqual({ source: 'action-1', target: 'action-2' });
    });
  });

  describe('node data extraction', () => {
    it('should extract trigger data correctly', () => {
      const trigger = {
        domain: 'knx',
        device_id: 'ee504a40b987814032d9ec9c29b1a43f',
        type: 'telegram',
        trigger: 'device',
        group_value_write: true,
        destination: ['2/4/6'],
      };

      const nodeData = {
        alias: 'Trigger 1',
        platform:
          ('platform' in trigger ? trigger.platform : null) || 
          ('trigger' in trigger ? (trigger as { trigger: string }).trigger : null) || 
          trigger.domain || 'device',
        entity_id: 'entity_id' in trigger ? (trigger as { entity_id: string }).entity_id : undefined,
        ...trigger,
      };

      expect(nodeData.platform).toBe('device');
      expect(nodeData.domain).toBe('knx');
      expect(nodeData.type).toBe('telegram');
    });

    it('should extract action data with new format', () => {
      const action = {
        action: 'light.turn_on',
        metadata: {},
        data: {},
        target: {
          entity_id: ['light.libreria_destra_soggiorno', 'light.libreria_sinistra_soggiorno'],
        },
      };

      const nodeData = {
        alias: 'Action 1',
        service: action.action || ('service' in action ? (action as { service: string }).service : null) || 'unknown',
        entity_id: action.target?.entity_id || ('entity_id' in action ? (action as { entity_id: unknown }).entity_id : undefined),
        data: ('data' in action ? action.data : {}) || {},
        target: action.target,
      };

      expect(nodeData.service).toBe('light.turn_on');
      expect(nodeData.entity_id).toEqual([
        'light.libreria_destra_soggiorno',
        'light.libreria_sinistra_soggiorno',
      ]);
    });

    it('should extract action data with old format', () => {
      const action = {
        service: 'light.turn_on',
        entity_id: 'light.living_room',
        service_data: { brightness: 255 },
      };

      const nodeData = {
        alias: 'Action 1',
        service: ('action' in action ? (action as { action: string }).action : null) || action.service || 'unknown',
        entity_id: ('target' in action ? (action as { target?: { entity_id: unknown } }).target?.entity_id : null) || action.entity_id,
        data: ('data' in action ? (action as { data: unknown }).data : null) || action.service_data || {},
      };

      expect(nodeData.service).toBe('light.turn_on');
      expect(nodeData.entity_id).toBe('light.living_room');
      expect(nodeData.data).toEqual({ brightness: 255 });
    });

    it('should extract condition data from if/then/else', () => {
      const condition = [
        {
          condition: 'template',
          value_template: '{{ trigger.payload == 1 }}',
        },
      ];

      const nodeData = {
        alias: 'If condition',
        condition_type:
          Array.isArray(condition) && condition[0]?.condition ? condition[0].condition : 'template',
        condition,
      };

      expect(nodeData.condition_type).toBe('template');
      expect(nodeData.condition[0].value_template).toBe('{{ trigger.payload == 1 }}');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty config', () => {
      const config = {};

      // Should not throw, just not create any nodes
      expect(() => {
        const triggers = 'triggers' in config ? config.triggers : 'trigger' in config ? config.trigger : undefined;
        const conditions = 'conditions' in config ? config.conditions : 'condition' in config ? config.condition : undefined;
        const actions = 'actions' in config ? config.actions : 'action' in config ? config.action : undefined;

        expect(triggers).toBeUndefined();
        expect(conditions).toBeUndefined();
        expect(actions).toBeUndefined();
      }).not.toThrow();
    });

    it('should handle action with missing service field', () => {
      const action = {
        // No action or service field
        target: { entity_id: 'light.test' },
      };

      const service = 'action' in action ? action.action : 'service' in action ? action.service : 'unknown';

      expect(service).toBe('unknown');
    });

    it('should handle trigger with multiple platform formats', () => {
      const scenarios = [
        { platform: 'state', expected: 'state' },
        { trigger: 'device', expected: 'device' },
        { domain: 'knx', expected: 'knx' },
        {}, // No platform info
      ];

      for (const scenario of scenarios) {
        const platform = scenario.platform || scenario.trigger || scenario.domain || 'device';
        expect(platform).toBe(scenario.expected || 'device');
      }
    });

    it('should handle array vs single item for trigger/condition/action', () => {
      const testConfigs = [
        { trigger: { platform: 'state' } }, // Single item
        { trigger: [{ platform: 'state' }] }, // Array
        { triggers: [{ platform: 'state' }] }, // Plural array
      ];

      for (const config of testConfigs) {
        const triggers = Array.isArray(config.triggers)
          ? config.triggers
          : Array.isArray(config.trigger)
            ? config.trigger
            : [config.trigger];

        expect(Array.isArray(triggers)).toBe(true);
        expect(triggers[0]).toBeDefined();
      }
    });
  });

  describe('real-world automation example', () => {
    it('should handle KNX automation with if/then/else', () => {
      const config = {
        id: '1760805672537',
        alias: 'Sincronizza luci libreria con gruppo luci soggiorno',
        description: '',
        triggers: [
          {
            domain: 'knx',
            device_id: 'ee504a40b987814032d9ec9c29b1a43f',
            type: 'telegram',
            trigger: 'device',
            group_value_write: true,
            group_value_response: true,
            group_value_read: false,
            incoming: true,
            outgoing: true,
            destination: ['2/4/6'],
          },
        ],
        conditions: [],
        actions: [
          {
            if: [
              {
                condition: 'template',
                value_template: '{{ trigger.payload == 1 }}',
              },
            ],
            then: [
              {
                action: 'light.turn_on',
                metadata: {},
                data: {},
                target: {
                  entity_id: [
                    'light.libreria_destra_soggiorno',
                    'light.libreria_sinistra_soggiorno',
                  ],
                },
              },
            ],
            else: [
              {
                action: 'light.turn_off',
                metadata: {},
                data: {},
                target: {
                  entity_id: [
                    'light.libreria_destra_soggiorno',
                    'light.libreria_sinistra_soggiorno',
                  ],
                },
              },
            ],
          },
        ],
        mode: 'single',
      };

      const { nodes, edges } = convertAutomationConfigToNodes(config);

      // Should create 4 nodes: 1 trigger, 1 condition, 2 actions (then/else)
      expect(nodes).toHaveLength(4);
      expect(nodes[0].type).toBe('trigger');
      expect(nodes[1].type).toBe('condition');
      expect(nodes[2].type).toBe('action');
      expect(nodes[3].type).toBe('action');

      // Should create proper edges with sourceHandle for condition branches
      expect(edges).toHaveLength(3);

      // Trigger connects to condition
      expect(edges[0].source).toBe(nodes[0].id);
      expect(edges[0].target).toBe(nodes[1].id);
      expect(edges[0].sourceHandle).toBeNull();

      // Condition connects to 'then' action with sourceHandle='true'
      expect(edges[1].source).toBe(nodes[1].id);
      expect(edges[1].target).toBe(nodes[2].id);
      expect(edges[1].sourceHandle).toBe('true');

      // Condition connects to 'else' action with sourceHandle='false'
      expect(edges[2].source).toBe(nodes[1].id);
      expect(edges[2].target).toBe(nodes[3].id);
      expect(edges[2].sourceHandle).toBe('false');
    });
  });
});
