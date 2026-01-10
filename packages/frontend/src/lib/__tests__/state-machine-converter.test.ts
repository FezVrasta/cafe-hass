import { describe, expect, it } from 'vitest';
import type { AutomationConfig } from '../ha-api';
import {
  convertStateMachineAutomationConfigToNodes,
  extractNodeIdFromCondition,
  extractNextNodeFromVariables,
  parseStateMachineChooseBlock,
} from '../automation-converter';

describe('State Machine Converter', () => {
  describe('extractNodeIdFromCondition', () => {
    it('should extract node ID from template condition', () => {
      const condition = {
        condition: 'template',
        value_template: '{{ current_node == "action-1" }}',
      };
      expect(extractNodeIdFromCondition(condition)).toBe('action-1');
    });

    it('should handle node IDs with underscores', () => {
      const condition = {
        condition: 'template',
        value_template: '{{ current_node == "action_1767870548496" }}',
      };
      expect(extractNodeIdFromCondition(condition)).toBe('action_1767870548496');
    });

    it('should return null for non-template conditions', () => {
      const condition = {
        condition: 'state',
        entity_id: 'sensor.test',
      };
      expect(extractNodeIdFromCondition(condition)).toBeNull();
    });

    it('should return null for malformed template', () => {
      const condition = {
        condition: 'template',
        value_template: '{{ some_other_check }}',
      };
      expect(extractNodeIdFromCondition(condition)).toBeNull();
    });
  });

  describe('extractNextNodeFromVariables', () => {
    it('should extract simple next node ID', () => {
      const variablesAction = {
        variables: {
          current_node: 'action-2',
        },
      };
      expect(extractNextNodeFromVariables(variablesAction)).toEqual({
        trueTarget: 'action-2',
        falseTarget: null,
      });
    });

    it('should extract END as next node', () => {
      const variablesAction = {
        variables: {
          current_node: 'END',
        },
      };
      expect(extractNextNodeFromVariables(variablesAction)).toEqual({
        trueTarget: 'END',
        falseTarget: null,
      });
    });

    it('should extract conditional next nodes (if/else template)', () => {
      const variablesAction = {
        variables: {
          current_node:
            '{% if is_state(\'sensor.temp\', \'on\') %}"action-1"{% else %}"action-2"{% endif %}',
        },
      };
      expect(extractNextNodeFromVariables(variablesAction)).toEqual({
        trueTarget: 'action-1',
        falseTarget: 'action-2',
      });
    });

    it('should handle complex condition templates', () => {
      const variablesAction = {
        variables: {
          current_node:
            '{% if states(\'sensor.temp\') | float > 20 %}"action-high"{% else %}"action-low"{% endif %}',
        },
      };
      expect(extractNextNodeFromVariables(variablesAction)).toEqual({
        trueTarget: 'action-high',
        falseTarget: 'action-low',
      });
    });

    it('should return null for non-variables action', () => {
      const action = {
        service: 'light.turn_on',
      };
      expect(extractNextNodeFromVariables(action)).toBeNull();
    });
  });

  describe('parseStateMachineChooseBlock', () => {
    it('should parse a simple action choose block', () => {
      const chooseBlock = {
        conditions: [
          {
            condition: 'template',
            value_template: '{{ current_node == "action-1" }}',
          },
        ],
        sequence: [
          {
            alias: 'Action: light.turn_on',
            service: 'light.turn_on',
            target: { entity_id: 'light.test' },
          },
          {
            variables: { current_node: 'action-2' },
          },
        ],
      };

      const result = parseStateMachineChooseBlock(chooseBlock);

      expect(result).not.toBeNull();
      expect(result?.nodeId).toBe('action-1');
      expect(result?.nodeType).toBe('action');
      expect(result?.data.service).toBe('light.turn_on');
      expect(result?.data.target).toEqual({ entity_id: 'light.test' });
      expect(result?.trueTarget).toBe('action-2');
      expect(result?.falseTarget).toBeNull();
    });

    it('should parse a condition choose block', () => {
      const chooseBlock = {
        conditions: [
          {
            condition: 'template',
            value_template: '{{ current_node == "condition-1" }}',
          },
        ],
        sequence: [
          {
            alias: 'Check: state',
            variables: {
              current_node:
                '{% if is_state(\'sensor.temp\', \'on\') %}"action-1"{% else %}"action-2"{% endif %}',
            },
          },
        ],
      };

      const result = parseStateMachineChooseBlock(chooseBlock);

      expect(result).not.toBeNull();
      expect(result?.nodeId).toBe('condition-1');
      expect(result?.nodeType).toBe('condition');
      expect(result?.trueTarget).toBe('action-1');
      expect(result?.falseTarget).toBe('action-2');
    });

    it('should parse a delay choose block', () => {
      const chooseBlock = {
        conditions: [
          {
            condition: 'template',
            value_template: '{{ current_node == "delay-1" }}',
          },
        ],
        sequence: [
          {
            alias: 'Delay',
            delay: '00:00:05',
          },
          {
            variables: { current_node: 'action-2' },
          },
        ],
      };

      const result = parseStateMachineChooseBlock(chooseBlock);

      expect(result).not.toBeNull();
      expect(result?.nodeId).toBe('delay-1');
      expect(result?.nodeType).toBe('delay');
      expect(result?.data.delay).toBe('00:00:05');
      expect(result?.trueTarget).toBe('action-2');
    });

    it('should parse a wait choose block', () => {
      const chooseBlock = {
        conditions: [
          {
            condition: 'template',
            value_template: '{{ current_node == "wait-1" }}',
          },
        ],
        sequence: [
          {
            alias: 'Wait',
            wait_template: '{{ is_state("sensor.test", "on") }}',
            timeout: '00:05:00',
            continue_on_timeout: true,
          },
          {
            variables: { current_node: 'action-1' },
          },
        ],
      };

      const result = parseStateMachineChooseBlock(chooseBlock);

      expect(result).not.toBeNull();
      expect(result?.nodeId).toBe('wait-1');
      expect(result?.nodeType).toBe('wait');
      expect(result?.data.wait_template).toBe('{{ is_state("sensor.test", "on") }}');
      expect(result?.data.timeout).toBe('00:05:00');
      expect(result?.data.continue_on_timeout).toBe(true);
    });
  });

  describe('convertStateMachineAutomationConfigToNodes', () => {
    it('should convert a simple state-machine automation', () => {
      const config: AutomationConfig = {
        alias: 'Test State Machine',
        description: 'A test automation',
        triggers: [{ platform: 'state', entity_id: 'sensor.test' }],
        actions: [
          {
            variables: {
              current_node: 'action-1',
              flow_context: {},
            },
          },
          {
            alias: 'State Machine Loop',
            repeat: {
              until: '{{ current_node == "END" }}',
              sequence: [
                {
                  choose: [
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "action-1" }}',
                        },
                      ],
                      sequence: [
                        {
                          alias: 'Action: light.turn_on',
                          service: 'light.turn_on',
                          target: { entity_id: 'light.test' },
                        },
                        {
                          variables: { current_node: 'END' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
        mode: 'single',
        variables: {
          _cafe_metadata: {
            strategy: 'state-machine',
            nodes: {
              'trigger-1': { x: 100, y: 50 },
              'action-1': { x: 200, y: 150 },
            },
            graph_id: 'test-graph-id',
            graph_version: 1,
          },
        },
      };

      const { nodes, edges } = convertStateMachineAutomationConfigToNodes(config);

      // Should have trigger + action nodes
      expect(nodes.length).toBe(2);

      // Check trigger node
      const triggerNode = nodes.find((n) => n.type === 'trigger');
      expect(triggerNode).toBeDefined();
      expect(triggerNode?.data.platform).toBe('state');
      expect(triggerNode?.data.entity_id).toBe('sensor.test');

      // Check action node
      const actionNode = nodes.find((n) => n.type === 'action');
      expect(actionNode).toBeDefined();
      expect(actionNode?.id).toBe('action-1');
      expect(actionNode?.data.service).toBe('light.turn_on');

      // Check edges
      expect(edges.length).toBe(1);
      expect(edges[0].source).toContain('trigger');
      expect(edges[0].target).toBe('action-1');
    });

    it('should convert state-machine with condition branching', () => {
      const config: AutomationConfig = {
        alias: 'Branching State Machine',
        triggers: [{ platform: 'state', entity_id: 'sensor.test' }],
        actions: [
          {
            variables: {
              current_node: 'condition-1',
              flow_context: {},
            },
          },
          {
            repeat: {
              until: '{{ current_node == "END" }}',
              sequence: [
                {
                  choose: [
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "condition-1" }}',
                        },
                      ],
                      sequence: [
                        {
                          alias: 'Check: state',
                          variables: {
                            current_node:
                              '{% if is_state(\'sensor.temp\', \'on\') %}"action-1"{% else %}"action-2"{% endif %}',
                          },
                        },
                      ],
                    },
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "action-1" }}',
                        },
                      ],
                      sequence: [
                        {
                          alias: 'Action: light.turn_on',
                          service: 'light.turn_on',
                        },
                        {
                          variables: { current_node: 'END' },
                        },
                      ],
                    },
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "action-2" }}',
                        },
                      ],
                      sequence: [
                        {
                          alias: 'Action: light.turn_off',
                          service: 'light.turn_off',
                        },
                        {
                          variables: { current_node: 'END' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
        mode: 'single',
        variables: {
          _cafe_metadata: {
            strategy: 'state-machine',
            nodes: {
              'trigger-1': { x: 100, y: 50 },
              'condition-1': { x: 200, y: 150 },
              'action-1': { x: 300, y: 100 },
              'action-2': { x: 300, y: 200 },
            },
            graph_id: 'test-graph-id',
            graph_version: 1,
          },
        },
      };

      const { nodes, edges } = convertStateMachineAutomationConfigToNodes(config);

      // Should have 4 nodes: trigger, condition, action-1, action-2
      expect(nodes.length).toBe(4);

      // Check condition node
      const conditionNode = nodes.find((n) => n.id === 'condition-1');
      expect(conditionNode).toBeDefined();
      expect(conditionNode?.type).toBe('condition');

      // Check edges - should have proper branching
      const conditionEdges = edges.filter((e) => e.source === 'condition-1');
      expect(conditionEdges.length).toBe(2);

      const trueEdge = conditionEdges.find((e) => e.sourceHandle === 'true');
      const falseEdge = conditionEdges.find((e) => e.sourceHandle === 'false');
      expect(trueEdge?.target).toBe('action-1');
      expect(falseEdge?.target).toBe('action-2');
    });

    it('should restore node positions from metadata', () => {
      const config: AutomationConfig = {
        alias: 'Position Test',
        triggers: [{ platform: 'state', entity_id: 'sensor.test' }],
        actions: [
          {
            variables: { current_node: 'action-1', flow_context: {} },
          },
          {
            repeat: {
              until: '{{ current_node == "END" }}',
              sequence: [
                {
                  choose: [
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "action-1" }}',
                        },
                      ],
                      sequence: [
                        { service: 'light.turn_on' },
                        { variables: { current_node: 'END' } },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
        mode: 'single',
        variables: {
          _cafe_metadata: {
            strategy: 'state-machine',
            nodes: {
              'trigger-1': { x: 150, y: 75 },
              'action-1': { x: 250, y: 175 },
            },
            graph_id: 'test-graph-id',
            graph_version: 1,
          },
        },
      };

      const { nodes } = convertStateMachineAutomationConfigToNodes(config);

      const actionNode = nodes.find((n) => n.id === 'action-1');
      expect(actionNode?.position).toEqual({ x: 250, y: 175 });
    });

    it('should handle state-machine with delay and wait nodes', () => {
      const config: AutomationConfig = {
        alias: 'Delay and Wait Test',
        triggers: [{ platform: 'state', entity_id: 'sensor.test' }],
        actions: [
          {
            variables: { current_node: 'delay-1', flow_context: {} },
          },
          {
            repeat: {
              until: '{{ current_node == "END" }}',
              sequence: [
                {
                  choose: [
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "delay-1" }}',
                        },
                      ],
                      sequence: [
                        { alias: 'Delay', delay: { seconds: 30 } },
                        { variables: { current_node: 'wait-1' } },
                      ],
                    },
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "wait-1" }}',
                        },
                      ],
                      sequence: [
                        {
                          alias: 'Wait',
                          wait_template: '{{ is_state("sensor.test", "ready") }}',
                          timeout: '00:01:00',
                        },
                        { variables: { current_node: 'action-1' } },
                      ],
                    },
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "action-1" }}',
                        },
                      ],
                      sequence: [
                        { service: 'light.turn_on' },
                        { variables: { current_node: 'END' } },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
        mode: 'single',
        variables: {
          _cafe_metadata: {
            strategy: 'state-machine',
            nodes: {},
            graph_id: 'test-graph-id',
            graph_version: 1,
          },
        },
      };

      const { nodes, edges } = convertStateMachineAutomationConfigToNodes(config);

      // Check delay node
      const delayNode = nodes.find((n) => n.type === 'delay');
      expect(delayNode).toBeDefined();
      expect(delayNode?.id).toBe('delay-1');
      expect(delayNode?.data.delay).toEqual({ seconds: 30 });

      // Check wait node
      const waitNode = nodes.find((n) => n.type === 'wait');
      expect(waitNode).toBeDefined();
      expect(waitNode?.id).toBe('wait-1');
      expect(waitNode?.data.wait_template).toBe('{{ is_state("sensor.test", "ready") }}');

      // Check edges
      const delayEdge = edges.find((e) => e.source === 'delay-1');
      expect(delayEdge?.target).toBe('wait-1');

      const waitEdge = edges.find((e) => e.source === 'wait-1');
      expect(waitEdge?.target).toBe('action-1');
    });

    it('should handle cycle (loop back) in state-machine', () => {
      const config: AutomationConfig = {
        alias: 'Cycle Test',
        triggers: [{ platform: 'state', entity_id: 'sensor.test' }],
        actions: [
          {
            variables: { current_node: 'action-1', flow_context: {} },
          },
          {
            repeat: {
              until: '{{ current_node == "END" }}',
              sequence: [
                {
                  choose: [
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "action-1" }}',
                        },
                      ],
                      sequence: [
                        { service: 'light.turn_on' },
                        { variables: { current_node: 'action-2' } },
                      ],
                    },
                    {
                      conditions: [
                        {
                          condition: 'template',
                          value_template: '{{ current_node == "action-2" }}',
                        },
                      ],
                      sequence: [
                        { service: 'light.turn_off' },
                        { variables: { current_node: 'action-1' } }, // Loop back!
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
        mode: 'single',
        variables: {
          _cafe_metadata: {
            strategy: 'state-machine',
            nodes: {},
            graph_id: 'test-graph-id',
            graph_version: 1,
          },
        },
      };

      const { edges } = convertStateMachineAutomationConfigToNodes(config);

      // Should have edge from action-2 back to action-1
      const loopEdge = edges.find((e) => e.source === 'action-2' && e.target === 'action-1');
      expect(loopEdge).toBeDefined();
    });
  });
});
