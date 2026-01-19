import type {
  ActionNode,
  ConditionNode,
  DelayNode,
  FlowEdge,
  FlowGraph,
  FlowNode,
  SetVariablesNode,
  TriggerNode,
  WaitNode,
} from '@cafe/shared';
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
  readonly description =
    'Generates state machine YAML for complex flows with cycles or cross-links';

  canHandle(_analysis: TopologyAnalysis): boolean {
    // State machine can handle any topology
    return true;
  }

  generate(flow: FlowGraph, analysis: TopologyAnalysis): HAYamlOutput {
    const warnings: string[] = [];

    // Build trigger-to-action mapping for routing
    const triggerRouting = this.buildTriggerRouting(flow);

    if (triggerRouting.size === 0) {
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

    // Generate the initial node expression
    // If all triggers lead to the same node, use that directly
    // Otherwise, use a Jinja2 template to route based on trigger.idx
    const entryNodeExpr = this.generateEntryNodeExpression(triggerRouting);

    // Build the action sequence for the state machine
    // In HA automations, actions are a flat list - we use:
    // 1. A variables action to initialize state
    // 2. A repeat action with choose dispatcher
    const actionSequence: Record<string, unknown>[] = [
      // Initialize the state machine variables
      {
        variables: {
          current_node: entryNodeExpr,
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
                    message: 'C.A.F.E.: Unknown state "{{ current_node }}", ending flow',
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
   * Build a mapping from trigger index to first action node
   * Returns a Map where key = trigger index, value = first action node ID
   */
  private buildTriggerRouting(flow: FlowGraph): Map<number, string> {
    const routing = new Map<number, string>();

    // Get trigger nodes in order (they will be output in this order)
    const triggerNodes = flow.nodes.filter((n): n is TriggerNode => n.type === 'trigger');

    triggerNodes.forEach((trigger, index) => {
      const outgoing = this.getOutgoingEdges(flow, trigger.id);
      if (outgoing.length > 0) {
        routing.set(index, outgoing[0].target);
      }
    });

    return routing;
  }

  /**
   * Generate the entry node expression for initialization
   * If all triggers lead to the same node, return that node ID
   * Otherwise, return a Jinja2 template that routes based on trigger.idx
   */
  private generateEntryNodeExpression(triggerRouting: Map<number, string>): string {
    const uniqueTargets = new Set(triggerRouting.values());

    // If all triggers lead to the same node (or there's only one trigger)
    if (uniqueTargets.size === 1) {
      return [...uniqueTargets][0];
    }

    // Multiple different targets - generate routing template
    // Using trigger.idx which is 0-based index of which trigger fired
    const entries = [...triggerRouting.entries()].sort((a, b) => a[0] - b[0]);

    // Build a Jinja2 if/elif chain
    // Note: trigger.idx is a string in HA, so compare with quoted string values
    // Node IDs should NOT be quoted - they're compared with quoted strings in conditions
    const parts: string[] = [];
    entries.forEach(([idx, nodeId], i) => {
      if (i === 0) {
        parts.push(`{% if trigger.idx == "${idx}" %}${nodeId}`);
      } else if (i === entries.length - 1) {
        parts.push(`{% else %}${nodeId}{% endif %}`);
      } else {
        parts.push(`{% elif trigger.idx == "${idx}" %}${nodeId}`);
      }
    });

    // Handle edge case where we have only one entry
    if (entries.length === 1) {
      return entries[0][1];
    }

    return parts.join('');
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
      case 'set_variables':
        return this.generateSetVariablesBlock(node, outgoingEdges);
      default:
        return this.generatePassthroughBlock(node, outgoingEdges);
    }
  }

  /**
   * Generate block for action node
   * Executes the service call then moves to the next node
   */
  private generateActionBlock(node: ActionNode, edges: FlowEdge[]): Record<string, unknown> {
    const currentNodeId = node.id;
    const actionCall = this.buildActionCall(node);

    // Single outgoing edge - standard behavior
    const nextNodeId = edges[0]?.target ?? 'END';
    const nextNode = nextNodeId === 'END' ? 'END' : nextNodeId;

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
   * Build service call action or device action
   */
  private buildActionCall(node: ActionNode): Record<string, unknown> {
    // Check if this is a device action (needs special format)
    if (node.data.isDeviceAction && node.data.data) {
      const deviceData = node.data.data as Record<string, unknown>;
      const action: Record<string, unknown> = {
        device_id: deviceData.device_id,
        domain: deviceData.domain,
        type: deviceData.type,
      };

      if (node.data.alias) {
        action.alias = node.data.alias;
      }

      // Add entity_id if present
      if (deviceData.entity_id) {
        action.entity_id = deviceData.entity_id;
      }

      // Add subtype if present
      if (deviceData.subtype) {
        action.subtype = deviceData.subtype;
      }

      // Add any additional parameters (like 'option' for select)
      const knownFields = ['type', 'device_id', 'domain', 'entity_id', 'subtype'];
      for (const [key, value] of Object.entries(deviceData)) {
        if (!knownFields.includes(key) && value !== undefined) {
          action[key] = value;
        }
      }

      if (node.data.enabled === false) {
        action.enabled = false;
      }

      return action;
    }

    // Standard service call format
    // Use spread pattern to preserve unknown properties from custom integrations
    const {
      alias,
      service,
      id,
      target,
      data,
      data_template,
      response_variable,
      continue_on_error,
      enabled,
      isDeviceAction: _isDeviceAction,
      ...extraProps
    } = node.data;
    const actionCall: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      alias,
      service,
    };

    if (id) {
      actionCall.id = id;
    }

    if (target) {
      actionCall.target = target;
    }

    if (data) {
      actionCall.data = data;
    }

    if (data_template) {
      actionCall.data_template = data_template;
    }

    if (response_variable) {
      actionCall.response_variable = response_variable;
    }

    if (continue_on_error) {
      actionCall.continue_on_error = continue_on_error;
    }

    if (enabled === false) {
      actionCall.enabled = false;
    }

    return actionCall;
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
    const trueTarget = trueTargetId === 'END' ? 'END' : trueTargetId;
    const falseTarget = falseTargetId === 'END' ? 'END' : falseTargetId;
    const currentNodeId = node.id;

    // Check if this is a complex template that can't be inlined into {% if %}
    const needsNativeCondition = this.needsNativeConditionCheck(node);

    if (needsNativeCondition) {
      // Use native HA condition check instead of Jinja2 {% if %}
      // This handles templates with {% set %} and other complex Jinja2
      const condition = this.buildNativeCondition(node);

      return {
        conditions: [
          {
            condition: 'template',
            value_template: `{{ current_node == "${currentNodeId}" }}`,
          },
        ],
        sequence: [
          {
            alias: node.data.alias,
            if: [condition],
            then: [
              {
                variables: {
                  current_node: trueTarget,
                },
              },
            ],
            else: [
              {
                variables: {
                  current_node: falseTarget,
                },
              },
            ],
          },
        ],
      };
    }

    // Generate Jinja2 template for condition evaluation (simple case)
    const conditionTemplate = this.buildConditionTemplate(node);

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        {
          alias: node.data.alias,
          variables: {
            current_node: `{% if ${conditionTemplate} %}"${trueTarget}"{% else %}"${falseTarget}"{% endif %}`,
          },
        },
      ],
    };
  }

  /**
   * Check if a condition node needs native HA condition check instead of Jinja2 {% if %}
   */
  private needsNativeConditionCheck(node: ConditionNode): boolean {
    const data = node.data;

    // Template conditions with {% %} statements need native check
    if (data.condition === 'template') {
      const template = data.value_template || '';
      if (template.includes('{%')) {
        return true;
      }
    }

    // Nested conditions (and/or/not) with complex templates
    if (
      (data.condition === 'and' ||
        data.condition === 'or' ||
        data.condition === 'not') &&
      data.conditions
    ) {
      return data.conditions.some((c) => {
        if (c.condition === 'template') {
          const template = c.value_template || '';
          return template.includes('{%');
        }
        return false;
      });
    }

    return false;
  }

  /**
   * Build native HA condition object for use in if/then/else
   */
  private buildNativeCondition(node: ConditionNode): Record<string, unknown> {
    const data = node.data;
    const condition: Record<string, unknown> = {
      condition: data.condition,
    };

    // Copy relevant fields based on condition type
    if (data.entity_id) condition.entity_id = data.entity_id;
    if (data.state !== undefined) condition.state = data.state;
    if (data.above !== undefined) condition.above = data.above;
    if (data.below !== undefined) condition.below = data.below;
    if (data.attribute) condition.attribute = data.attribute;
    if (data.value_template) condition.value_template = data.value_template;
    if (data.after) condition.after = data.after;
    if (data.before) condition.before = data.before;
    if (data.after_offset) condition.after_offset = data.after_offset;
    if (data.before_offset) condition.before_offset = data.before_offset;
    if (data.zone) condition.zone = data.zone;
    if (data.weekday) condition.weekday = data.weekday;
    if (data.id) condition.id = data.id;

    // Handle nested conditions
    if (data.conditions && data.conditions.length > 0) {
      condition.conditions = data.conditions.map((c) => {
        const nested: Record<string, unknown> = {
          condition: c.condition,
        };
        if (c.entity_id) nested.entity_id = c.entity_id;
        if (c.state !== undefined) nested.state = c.state;
        if (c.above !== undefined) nested.above = c.above;
        if (c.below !== undefined) nested.below = c.below;
        if (c.attribute) nested.attribute = c.attribute;
        if (c.value_template) nested.value_template = c.value_template;
        if (c.template) nested.value_template = c.template;
        if (c.after) nested.after = c.after;
        if (c.before) nested.before = c.before;
        if (c.after_offset) nested.after_offset = c.after_offset;
        if (c.before_offset) nested.before_offset = c.before_offset;
        if (c.zone) nested.zone = c.zone;
        if (c.weekday) nested.weekday = c.weekday;
        if (c.id) nested.id = c.id;
        return Object.fromEntries(Object.entries(nested).filter(([, v]) => v !== undefined));
      });
    }

    return Object.fromEntries(Object.entries(condition).filter(([, v]) => v !== undefined));
  }

  /**
   * Generate block for delay node
   */
  private generateDelayBlock(node: DelayNode, edges: FlowEdge[]): Record<string, unknown> {
    const nextNodeId = edges[0]?.target ?? 'END';
    const nextNode = nextNodeId === 'END' ? 'END' : nextNodeId;
    const currentNodeId = node.id;

    // Use spread pattern to preserve unknown properties from custom integrations
    const { alias, delay, id, ...extraProps } = node.data;
    const delayAction: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      alias,
      delay,
    };

    if (id) {
      delayAction.id = id;
    }

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        delayAction,
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
    const nextNode = nextNodeId === 'END' ? 'END' : nextNodeId;
    const currentNodeId = node.id;

    // Use spread pattern to preserve unknown properties from custom integrations
    const {
      alias,
      id,
      wait_template,
      wait_for_trigger,
      timeout,
      continue_on_timeout,
      ...extraProps
    } = node.data;
    const waitAction: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      alias,
    };

    if (id) {
      waitAction.id = id;
    }

    if (wait_template) {
      waitAction.wait_template = wait_template;
    } else if (wait_for_trigger) {
      waitAction.wait_for_trigger = wait_for_trigger.map((triggerData) => {
        const trigger = { ...triggerData };
        // Don't include alias in the trigger definition itself
        delete trigger.alias;
        return Object.fromEntries(
          Object.entries(trigger).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
      });
    }

    if (timeout) {
      waitAction.timeout = timeout;
    }

    if (continue_on_timeout !== undefined) {
      waitAction.continue_on_timeout = continue_on_timeout;
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
   * Generate block for set_variables node
   */
  private generateSetVariablesBlock(
    node: SetVariablesNode,
    edges: FlowEdge[]
  ): Record<string, unknown> {
    const nextNodeId = edges[0]?.target ?? 'END';
    const nextNode = nextNodeId === 'END' ? 'END' : nextNodeId;
    const currentNodeId = node.id;

    // Use spread pattern to preserve unknown properties from custom integrations
    const { alias, id, variables, ...extraProps } = node.data;
    const setVarsAction: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      variables,
    };

    if (alias) {
      setVarsAction.alias = alias;
    }

    if (id) {
      setVarsAction.id = id;
    }

    return {
      conditions: [
        {
          condition: 'template',
          value_template: `{{ current_node == "${currentNodeId}" }}`,
        },
      ],
      sequence: [
        setVarsAction,
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
    const nextNode = nextNodeId === 'END' ? 'END' : nextNodeId;
    const currentNodeId = node.id;

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

    switch (data.condition) {
      case 'state':
        if (data.attribute) {
          // Use state_attr for attribute checks
          if (Array.isArray(data.state)) {
            const states = data.state.map((s) => `'${s}'`).join(', ');
            return `state_attr('${data.entity_id}', '${data.attribute}') in [${states}]`;
          }
          return `state_attr('${data.entity_id}', '${data.attribute}') == '${data.state}'`;
        } else {
          // Use states() for regular state checks
          if (Array.isArray(data.state)) {
            const states = data.state.map((s) => `'${s}'`).join(', ');
            return `states('${data.entity_id}') in [${states}]`;
          }
          return `is_state('${data.entity_id}', '${data.state}')`;
        }

      case 'numeric_state':
        return this.buildNumericCondition(data);

      case 'template': {
        // Strip outer {{ }} if present - check both template and value_template
        // Note: Complex templates with {% %} are handled via needsNativeConditionCheck
        // and won't use this method
        let template = data.value_template || 'true';
        if (template.startsWith('{{') && template.endsWith('}}')) {
          template = template.slice(2, -2).trim();
        }
        return template;
      }

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
      : data.attribute
        ? `state_attr('${data.entity_id}', '${data.attribute}') | float`
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
