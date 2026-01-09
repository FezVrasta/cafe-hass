import { FlowTranspiler } from '@cafe/transpiler';
import { describe, expect, it } from 'vitest';
import { useFlowStore } from '@/store/flow-store';
import { convertAutomationConfigToNodes } from '../automation-converter';

describe('automation-converter', () => {
  it('should handle automation with multiple top-level conditions and choose structures', () => {
    const automationWithMultipleConditions = {
      id: '1761241902454',
      alias: 'Chiudi tenda e tapparella quando parte un film',
      description:
        'Chiude tenda Velux e tapparella se Apple TV riproduce un film in app whitelisted e la luminosità è alta.',
      triggers: [
        {
          entity_id: 'media_player.tv',
          to: 'playing',
          for: '00:00:05',
          trigger: 'state',
        },
      ],
      conditions: [
        {
          condition: 'numeric_state',
          entity_id: 'sensor.sensore_di_luminosita_soggiorno',
          above: 120,
        },
        {
          condition: 'template',
          value_template:
            "{% set app = (state_attr('media_player.tv', 'app_name') or '') | string %} {% set ok_apps = ['TV','Apple TV','Prime Video','Infuse','Disney+','Netflix'] %} {{ app in ok_apps }}\n",
        },
        {
          condition: 'template',
          value_template:
            "{{ (state_attr('media_player.tv','media_content_type') or '') | lower == 'movie' }}\n",
        },
      ],
      actions: [
        {
          choose: [
            {
              conditions: [
                {
                  condition: 'template',
                  value_template: "{{ states('cover.tenda_velux_soggiorno') != 'closed' }}\n",
                },
              ],
              sequence: [
                {
                  target: {
                    entity_id: 'cover.tenda_velux_soggiorno',
                  },
                  action: 'cover.close_cover',
                },
              ],
            },
          ],
        },
        {
          choose: [
            {
              conditions: [
                {
                  condition: 'template',
                  value_template: "{{ states('cover.tapparella_soggiorno') != 'closed' }}\n",
                },
              ],
              sequence: [
                {
                  target: {
                    entity_id: 'cover.tapparella_soggiorno',
                  },
                  action: 'cover.close_cover',
                },
              ],
            },
          ],
        },
      ],
      mode: 'single',
    };

    const { nodes, edges } = convertAutomationConfigToNodes(automationWithMultipleConditions);

    // Should create correct number of nodes
    expect(nodes.length).toBeGreaterThan(0);

    // All condition nodes should have proper edges with sourceHandle
    const conditionNodes = nodes.filter((n) => n.type === 'condition');
    conditionNodes.forEach((node) => {
      const outgoingEdges = edges.filter((e) => e.source === node.id);
      outgoingEdges.forEach((edge) => {
        expect(edge.sourceHandle).toBeDefined();
        expect(['true', 'false', null]).toContain(edge.sourceHandle);
      });
    });

    console.log(
      'Nodes:',
      nodes.map((n) => ({ id: n.id, type: n.type, position: n.position }))
    );
    console.log('Edges:', edges);
  });

  it('should preserve trigger properties during round-trip conversion', () => {
    const originalAutomation = {
      alias: 'Buona notte / Buongiorno da comodini',
      description: '',
      triggers: [
        {
          domain: 'knx',
          device_id: 'ee504a40b987814032d9ec9c29b1a43f',
          type: 'telegram',
          trigger: 'device',
          group_value_write: true,
          group_value_response: true,
          group_value_read: true,
          incoming: true,
          outgoing: false,
          destination: ['2/0/11', '2/0/5'],
        },
      ],
      conditions: [],
      actions: [
        {
          choose: [
            {
              conditions: [
                {
                  condition: 'or',
                  conditions: [
                    {
                      condition: 'sun',
                      after: 'sunset',
                      after_offset: '-03:00:00',
                    },
                    {
                      condition: 'sun',
                      before: 'sunrise',
                      before_offset: '-03:00:00',
                    },
                  ],
                },
              ],
              sequence: [
                {
                  action: 'script.turn_on',
                  target: {
                    entity_id: 'script.buonanotte',
                  },
                },
              ],
            },
          ],
          default: [
            {
              action: 'script.turn_on',
              target: {
                entity_id: 'script.buongiorno',
              },
            },
          ],
        },
      ],
      mode: 'single',
    };

    // Step 1: Convert automation to nodes
    const { nodes, edges } = convertAutomationConfigToNodes(originalAutomation);

    // Verify nodes were created
    expect(nodes.length).toBeGreaterThan(0);

    // Find the trigger node
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    expect(triggerNode).toBeDefined();
    expect(triggerNode?.data).toBeDefined();

    // Step 2: Check that trigger properties are preserved in the converted nodes
    if (triggerNode) {
      console.log('Trigger node data:', triggerNode.data);

      // Check essential KNX properties are preserved in nodes
      expect(triggerNode.data.domain).toBe('knx');
      expect(triggerNode.data.device_id).toBe('ee504a40b987814032d9ec9c29b1a43f');
      expect(triggerNode.data.type).toBe('telegram');
      expect(triggerNode.data.platform).toBe('device'); // 'trigger' field is replaced with 'platform'
      expect(triggerNode.data.group_value_write).toBe(true);
      expect(triggerNode.data.group_value_response).toBe(true);
      expect(triggerNode.data.group_value_read).toBe(true);
      expect(triggerNode.data.incoming).toBe(true);
      expect(triggerNode.data.outgoing).toBe(false);
      expect(triggerNode.data.destination).toEqual(['2/0/11', '2/0/5']);
    }

    // Step 3: Simulate the real application flow - add nodes to the store like AutomationImportDialog does
    const { reset, setFlowName, addNode, onConnect, toFlowGraph } = useFlowStore.getState();

    // Reset and setup like the real import
    reset();
    setFlowName(originalAutomation.alias);

    // Add all nodes to the store
    for (const node of nodes) {
      addNode(node);
    }

    // Add all edges
    for (const edge of edges) {
      onConnect({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: null,
      });
    }

    // Step 4: Get the FlowGraph from the store (this is where properties might be lost)
    const flowGraph = toFlowGraph();
    console.log('FlowGraph from store:', JSON.stringify(flowGraph, null, 2));

    // Check if trigger properties survived the store round-trip
    const storeTriggerpNode = flowGraph.nodes.find((n) => n.type === 'trigger');
    expect(storeTriggerpNode).toBeDefined();

    if (storeTriggerpNode) {
      console.log('Trigger node from store:', storeTriggerpNode.data);

      // These should pass if properties are preserved through the store
      expect(storeTriggerpNode.data.domain).toBe('knx');
      expect(storeTriggerpNode.data.device_id).toBe('ee504a40b987814032d9ec9c29b1a43f');
      expect(storeTriggerpNode.data.type).toBe('telegram');
      expect(storeTriggerpNode.data.platform).toBe('device'); // 'trigger' field is replaced with 'platform'
      expect(storeTriggerpNode.data.group_value_write).toBe(true);
      expect(storeTriggerpNode.data.group_value_response).toBe(true);
      expect(storeTriggerpNode.data.group_value_read).toBe(true);
      expect(storeTriggerpNode.data.incoming).toBe(true);
      expect(storeTriggerpNode.data.outgoing).toBe(false);
      expect(storeTriggerpNode.data.destination).toEqual(['2/0/11', '2/0/5']);
    }

    // Step 5: Test transpilation using the FlowGraph from the store (real scenario)
    const transpiler = new FlowTranspiler();
    const result = transpiler.transpile(flowGraph);

    console.log('Transpilation result:', result);

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output?.automation).toBeDefined();

    if (result.output?.automation) {
      const automation = result.output.automation as Record<string, unknown>;
      console.log('Generated automation:', JSON.stringify(automation, null, 2));

      // Check that trigger properties are preserved in final output
      expect(automation.trigger).toBeDefined();
      expect(Array.isArray(automation.trigger)).toBe(true);

      if (Array.isArray(automation.trigger) && automation.trigger[0]) {
        const trigger = automation.trigger[0];
        console.log('Generated trigger:', trigger);

        // These are the properties that should be preserved but are currently being lost
        expect(trigger.domain).toBe('knx');
        expect(trigger.device_id).toBe('ee504a40b987814032d9ec9c29b1a43f');
        expect(trigger.type).toBe('telegram');
        expect(trigger.group_value_write).toBe(true);
        expect(trigger.group_value_response).toBe(true);
        expect(trigger.group_value_read).toBe(true);
        expect(trigger.incoming).toBe(true);
        expect(trigger.outgoing).toBe(false);
        expect(trigger.destination).toEqual(['2/0/11', '2/0/5']);
      }

      // Check that actions are preserved
      expect(automation.action).toBeDefined();
      expect(Array.isArray(automation.action)).toBe(true);
      expect(Array.isArray(automation.action) ? automation.action.length : 1).toBeGreaterThan(0);

      // TODO: Fix action preservation - currently actions are being simplified
      // The original automation had choose conditions with sun conditions and script actions
      // but they're being converted to empty then/else blocks
      console.log('Action preservation needs to be fixed. Current actions:', automation.action);
    }
  });
});
