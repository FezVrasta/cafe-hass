import type {
  FlowGraph,
  FlowNode,
  FlowEdge,
  TriggerNode,
  ConditionNode,
  ActionNode,
  DelayNode,
  WaitNode,
} from '@hflow/shared';
import type { TopologyAnalysis } from '../analyzer/topology';
import { BaseStrategy, type HAYamlOutput } from './base';

/**
 * State Machine strategy for complex flows with cycles, cross-links, or converging paths
 *
 * Implements the "Virtual CPU" pattern:
 * - current_node: A variable acting as the Program Counter
 * - repeat: A loop that keeps the automation alive until END
 * - choose: A dispatcher that executes the current node's logic
 *
 * This allows for arbitrary graph topologies including:
 * - Back-loops (returning to earlier nodes)
 * - Cross-links (jumping across branches)
 * - Converging paths (multiple paths merging)
 * - Complex state machines
 */
export class StateMachineStrategy extends BaseStrategy {
  readonly name = 'state-machine';
  readonly description = 'Generates state machine YAML for complex flows with cycles or cross-links';

  /**
   * Map of node IDs to friendly prefixed IDs
   */
  private nodeIdMap: Map<string, string> = new Map();

  canHandle(_analysis: TopologyAnalysis): boolean {
    // State machine can handle any topology
    return true;
  }

  /**
   * Build a mapping from original node IDs to friendly prefixed IDs
   */
  private buildNodeIdMap(flow: FlowGraph): void {
    this.nodeIdMap.clear();
    const usedIds = new Set<string>();

    for (const node of flow.nodes) {
      const friendlyId = this.generateFriendlyNodeId(node, usedIds);
      this.nodeIdMap.set(node.id, friendlyId);
      usedIds.add(friendlyId);
    }
  }

  /**
   * Generate a friendly, human-readable node ID
   */
  private generateFriendlyNodeId(node: FlowNode, usedIds: Set<string>): string {
    let prefix: string;
    let suffix: string = '';

    switch (node.type) {
      case 'trigger':
        prefix = 'trigger';
        if ((node as TriggerNode).data.platform) {
          suffix = (node as TriggerNode).data.platform;
        }
        break;

      case 'condition':
        prefix = 'check';
        const condData = (node as ConditionNode).data;
        if (condData.entity_id) {
          // Extract the entity name part (after the domain)
          const entityPart = condData.entity_id.split('.')[1] || '';
          suffix = entityPart;
        } else if (condData.condition_type === 'template') {
          suffix = 'template';
        } else if (condData.condition_type) {
          suffix = condData.condition_type;
        }
        break;

      case 'action':
        const actData = (node as ActionNode).data;
        if (actData.service) {
          // Use the service name as prefix (e.g., "light_turn_on")
          prefix = actData.service.replace('.', '_');
          // Add target entity if available
          if (actData.target?.entity_id) {
            const targetEntity = Array.isArray(actData.target.entity_id)
              ? actData.target.entity_id[0]
              : actData.target.entity_id;
            if (targetEntity) {
              suffix = targetEntity.split('.')[1] || '';
            }
          }
        } else {
          prefix = 'action';
        }
        break;

      case 'delay': {
        prefix = 'delay';
        const delayData = (node as DelayNode).data.delay;
        if (delayData) {
          if (typeof delayData === 'string') {
            suffix = delayData.replace(/:/g, '');
          } else if (typeof delayData === 'object') {
            // It's a duration object {hours, minutes, seconds}
            const parts: string[] = [];
            if (delayData.hours) parts.push(`${delayData.hours}h`);
            if (delayData.minutes) parts.push(`${delayData.minutes}m`);
            if (delayData.seconds) parts.push(`${delayData.seconds}s`);
            suffix = parts.join('') || '';
          }
        }
        break;
      }

      case 'wait':
        prefix = 'wait';
        break;

      default:
        prefix = (node as { type?: string }).type || 'node';
    }

    // Use alias if provided
    if (node.data.alias) {
      const aliasSlug = this.slugify(node.data.alias as string);
      if (aliasSlug) {
        prefix = aliasSlug;
        suffix = '';
      }
    }

    // Build the base ID
    let baseId = suffix ? `${prefix}_${suffix}` : prefix;
    baseId = this.slugify(baseId);

    // Ensure uniqueness by adding a counter if needed
    let finalId = baseId;
    let counter = 2;
    while (usedIds.has(finalId)) {
      finalId = `${baseId}_${counter}`;
      counter++;
    }

    return finalId;
  }

  /**
   * Convert a string to a URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50); // Limit length
  }

  /**
   * Get the friendly ID for a node, or return the original if not mapped
   */
  private getFriendlyId(nodeId: string): string {
    return this.nodeIdMap.get(nodeId) || nodeId;
  }

  generate(flow: FlowGraph, analysis: TopologyAnalysis): HAYamlOutput {
    const warnings: string[] = [];

    // Build the friendly node ID mapping
    this.buildNodeIdMap(flow);

    // Find the entry node (first trigger's first connected node)
    const entryNodeId = this.findFirstActionNode(flow, analysis);

    if (!entryNodeId) {
      warnings.push('No action nodes found after triggers');
      // Extract triggers to determine output format
      const triggers = this.extractTriggers(flow);
      if (triggers.length > 0) {
        // Output as automation with empty action
        return {
          automation: {
            alias: flow.name,
            description: flow.description || '',
            trigger: triggers,
            action: [],
            mode: flow.metadata?.mode ?? 'single',
          },
          warnings,
          strategy: this.name,
        };
      }
      // No triggers - output as script
      return {
        script: {
          alias: flow.name,
          description: flow.description || '',
          sequence: [],
          mode: flow.metadata?.mode ?? 'single',
        },
        warnings,
        strategy: this.name,
      };
    }

    // Build choose blocks for each non-trigger node
    const chooseBlocks = flow.nodes
      .filter((n) => n.type !== 'trigger')
      .map((node) => this.generateNodeBlock(flow, node));

    // Warn about potential infinite loops
    if (analysis.hasCycles) {
      const cycleWarning = this.detectPotentialInfiniteLoop(flow, analysis);
      if (cycleWarning) {
        warnings.push(cycleWarning);
      }
    }

    // Extract triggers for the automation wrapper
    const triggers = this.extractTriggers(flow);

    // Build the action sequence for the state machine
    // In HA automations, actions are a flat list - we use:
    // 1. A variables action to initialize state
    // 2. A repeat action with choose dispatcher
    const actionSequence: Record<string, unknown>[] = [
      // Initialize the state machine variables
      {
        variables: {
          current_node: this.getFriendlyId(entryNodeId),
          flow_context: {},
        },
      },
      // The main execution loop
      {
        alias: 'State Machine Loop',
        repeat: {
          until: '{{ current_node == "END" }}',
          sequence: [
            {
              choose: chooseBlocks,
              default: [
                {
                  service: 'system_log.write',
                  data: {
                    message: 'Flow Automator: Unknown state "{{ current_node }}", ending flow',
                    level: 'warning',
                  },
                },
                {
                  variables: {
                    current_node: 'END',
                  },
                },
              ],
            },
          ],
        },
      },
    ];

    // If there are triggers, output as automation format
    if (triggers.length > 0) {
      return {
        automation: {
          alias: flow.name,
          description: flow.description || '',
          trigger: triggers,
          action: actionSequence,
          mode: flow.metadata?.mode ?? 'single',
        },
        warnings,
        strategy: this.name,
      };
    }

    // No triggers - output as script format
    return {
      script: {
        alias: flow.name,
        description: flow.description || '',
        sequence: actionSequence,
        mode: flow.metadata?.mode ?? 'single',
      },
      warnings,
      strategy: this.name,
    };
  }

  /**
   * Find the first action node after triggers
   */
  private findFirstActionNode(flow: FlowGraph, analysis: TopologyAnalysis): string | null {
    for (const entryId of analysis.entryNodes) {
      const outgoing = this.getOutgoingEdges(flow, entryId);
      if (outgoing.length > 0) {
        return outgoing[0].target;
      }
    }
    return null;
  }

  /**
   * Extract triggers from trigger nodes
   */
  private extractTriggers(flow: FlowGraph): unknown[] {
    return flow.nodes
      .filter((n): n is TriggerNode => n.type === 'trigger')
      .map((node) => {
        const trigger: Record<string, unknown> = {
          platform: node.data.platform,
        };

        const { alias, platform, ...rest } = node.data;
        Object.assign(trigger, rest);

        if (alias) {
          trigger.alias = alias;
        }

        return Object.fromEntries(
          Object.entries(trigger).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
      });
  }

  /**
   * Generate a choose block for a single node
   */
  private generateNodeBlock(flow: FlowGraph, node: FlowNode): Record<string, unknown> {
    const outgoingEdges = this.getOutgoingEdges(flow, node.id);

    switch (node.type) {
      case 'condition':
        return this.generateConditionBlock(node, outgoingEdges);
      case 'action':
        return this.generateActionBlock(node, outgoingEdges);
      case 'delay':
        return this.generateDelayBlock(node, outgoingEdges);
      case 'wait':
        return this.generateWaitBlock(node, outgoingEdges);
      default:
        return this.generatePassthroughBlock(node, outgoingEdges);
    }
  }

  /**
   * Generate block for action node
   * Executes the service call then moves to the next node
   */
  private generateActionBlock(node: ActionNode, edges: FlowEdge[]): Record<string, unknown> {
    const nextNodeId = edges[0]?.target ?? 'END';
    const nextNode = nextNodeId === 'END' ? 'END' : this.getFriendlyId(nextNodeId);
    const currentNodeId = this.getFriendlyId(node.id);
    const alias = this.generateAlias(node);

    const actionCall: Record<string, unknown> = {
      alias,
      service: node.data.service,
    };

    if (node.data.target) {
      actionCall.target = node.data.target;
    }

    if (node.data.data) {
      actionCall.data = node.data.data;
    }

    if (node.data.data_template) {
      actionCall.data_template = node.data.data_template;
    }

    if (node.data.response_variable) {
      actionCall.response_variable = node.data.response_variable;
    }

    if (node.data.continue_on_error) {
      actionCall.continue_on_error = node.data.continue_on_error;
    }

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        actionCall,
        {
          variables: {
            current_node: nextNode,
          },
        },
      ],
    };
  }

  /**
   * Generate block for condition node
   * Evaluates the condition and sets current_node based on result
   */
  private generateConditionBlock(node: ConditionNode, edges: FlowEdge[]): Record<string, unknown> {
    const trueEdge = edges.find((e) => e.sourceHandle === 'true');
    const falseEdge = edges.find((e) => e.sourceHandle === 'false');

    const trueTargetId = trueEdge?.target ?? 'END';
    const falseTargetId = falseEdge?.target ?? 'END';
    const trueTarget = trueTargetId === 'END' ? 'END' : this.getFriendlyId(trueTargetId);
    const falseTarget = falseTargetId === 'END' ? 'END' : this.getFriendlyId(falseTargetId);
    const currentNodeId = this.getFriendlyId(node.id);

    // Generate Jinja2 template for condition evaluation
    const conditionTemplate = this.buildConditionTemplate(node);
    const alias = this.generateAlias(node);

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        {
          alias,
          variables: {
            current_node: `{% if ${conditionTemplate} %}"${trueTarget}"{% else %}"${falseTarget}"{% endif %}`,
          },
        },
      ],
    };
  }

  /**
   * Generate block for delay node
   */
  private generateDelayBlock(node: DelayNode, edges: FlowEdge[]): Record<string, unknown> {
    const nextNodeId = edges[0]?.target ?? 'END';
    const nextNode = nextNodeId === 'END' ? 'END' : this.getFriendlyId(nextNodeId);
    const currentNodeId = this.getFriendlyId(node.id);
    const alias = this.generateAlias(node);

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        {
          alias,
          delay: node.data.delay,
        },
        {
          variables: {
            current_node: nextNode,
          },
        },
      ],
    };
  }

  /**
   * Generate block for wait node
   */
  private generateWaitBlock(node: WaitNode, edges: FlowEdge[]): Record<string, unknown> {
    const nextNodeId = edges[0]?.target ?? 'END';
    const nextNode = nextNodeId === 'END' ? 'END' : this.getFriendlyId(nextNodeId);
    const currentNodeId = this.getFriendlyId(node.id);
    const alias = this.generateAlias(node);

    const waitAction: Record<string, unknown> = {
      alias,
    };

    if (node.data.wait_template) {
      waitAction.wait_template = node.data.wait_template;
    }

    if (node.data.timeout) {
      waitAction.timeout = node.data.timeout;
    }

    if (node.data.continue_on_timeout !== undefined) {
      waitAction.continue_on_timeout = node.data.continue_on_timeout;
    }

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        waitAction,
        {
          variables: {
            current_node: nextNode,
          },
        },
      ],
    };
  }

  /**
   * Generate passthrough block for unknown node types
   */
  private generatePassthroughBlock(node: FlowNode, edges: FlowEdge[]): Record<string, unknown> {
    const nextNodeId = edges[0]?.target ?? 'END';
    const nextNode = nextNodeId === 'END' ? 'END' : this.getFriendlyId(nextNodeId);
    const currentNodeId = this.getFriendlyId(node.id);

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        {
          variables: {
            current_node: nextNode,
          },
        },
      ],
    };
  }

  /**
   * Build Jinja2 template for condition evaluation
   */
  private buildConditionTemplate(node: ConditionNode): string {
    const data = node.data;

    switch (data.condition_type) {
      case 'state':
        if (Array.isArray(data.state)) {
          const states = data.state.map((s) => `'${s}'`).join(', ');
          return `states('${data.entity_id}') in [${states}]`;
        }
        return `is_state('${data.entity_id}', '${data.state}')`;

      case 'numeric_state':
        return this.buildNumericCondition(data);

      case 'template':
        // Strip outer {{ }} if present
        let template = data.template || 'true';
        if (template.startsWith('{{') && template.endsWith('}}')) {
          template = template.slice(2, -2).trim();
        }
        return template;

      case 'time':
        return this.buildTimeCondition(data);

      case 'sun':
        return this.buildSunCondition(data);

      case 'zone':
        return `is_state('${data.entity_id}', '${data.zone}')`;

      case 'and':
        if (data.conditions && data.conditions.length > 0) {
          return `(${data.conditions.map((c) => this.buildNestedCondition(c)).join(' and ')})`;
        }
        return 'true';

      case 'or':
        if (data.conditions && data.conditions.length > 0) {
          return `(${data.conditions.map((c) => this.buildNestedCondition(c)).join(' or ')})`;
        }
        return 'false';

      case 'not':
        if (data.conditions && data.conditions.length > 0) {
          return `not (${data.conditions.map((c) => this.buildNestedCondition(c)).join(' and ')})`;
        }
        return 'true';

      default:
        return 'true';
    }
  }

  /**
   * Build numeric state condition template
   */
  private buildNumericCondition(data: ConditionNode['data']): string {
    const parts: string[] = [];
    const valueExpr = data.value_template
      ? `(${data.value_template})`
      : `states('${data.entity_id}') | float`;

    if (data.above !== undefined) {
      parts.push(`${valueExpr} > ${data.above}`);
    }
    if (data.below !== undefined) {
      parts.push(`${valueExpr} < ${data.below}`);
    }

    return parts.length > 0 ? parts.join(' and ') : 'true';
  }

  /**
   * Build time condition template
   */
  private buildTimeCondition(data: ConditionNode['data']): string {
    const parts: string[] = [];

    if (data.after) {
      parts.push(`now().strftime('%H:%M:%S') >= '${data.after}'`);
    }
    if (data.before) {
      parts.push(`now().strftime('%H:%M:%S') < '${data.before}'`);
    }
    if (data.weekday && data.weekday.length > 0) {
      const days = data.weekday.map((d) => `'${d}'`).join(', ');
      parts.push(`now().strftime('%a').lower()[:3] in [${days}]`);
    }

    return parts.length > 0 ? parts.join(' and ') : 'true';
  }

  /**
   * Build sun condition template
   */
  private buildSunCondition(data: ConditionNode['data']): string {
    // Sun conditions check if current time is after sunrise/sunset
    if (data.after === 'sunrise' || data.before === 'sunset') {
      return `is_state('sun.sun', 'above_horizon')`;
    }
    if (data.after === 'sunset' || data.before === 'sunrise') {
      return `is_state('sun.sun', 'below_horizon')`;
    }
    return 'true';
  }

  /**
   * Build nested condition for and/or/not
   */
  private buildNestedCondition(condition: ConditionNode['data']): string {
    // Recursively build the condition template
    const mockNode: ConditionNode = {
      id: 'nested',
      type: 'condition',
      position: { x: 0, y: 0 },
      data: condition,
    };
    return this.buildConditionTemplate(mockNode);
  }

  /**
   * Detect if the flow could potentially run forever
   */
  private detectPotentialInfiniteLoop(flow: FlowGraph, analysis: TopologyAnalysis): string | null {
    if (!analysis.hasCycles) {
      return null;
    }

    // Check if all cycles have a condition that could break them
    // This is a simple heuristic - we check if there's at least one condition in the flow
    const hasConditions = flow.nodes.some((n) => n.type === 'condition');

    if (!hasConditions) {
      return (
        'Warning: This flow contains cycles but no conditions. ' +
        'This could result in an infinite loop. Consider adding a condition to break the cycle.'
      );
    }

    return (
      'Note: This flow contains cycles. Ensure your conditions can eventually evaluate to ' +
      'break the cycle, or the automation may run indefinitely.'
    );
  }

}
