import type {
  ActionNode,
  ConditionNode,
  DelayNode,
  FlowGraph,
  FlowNode,
  TriggerNode,
  WaitNode,
} from '@cafe/shared';
import type { TopologyAnalysis } from '../analyzer/topology';
import { BaseStrategy, type HAYamlOutput } from './base';

/**
 * Native strategy for simple tree-shaped automations
 * Generates standard nested Home Assistant YAML with choose blocks
 */
export class NativeStrategy extends BaseStrategy {
  readonly name = 'native';
  readonly description = 'Generates nested HA YAML for simple tree-shaped automations';

  canHandle(analysis: TopologyAnalysis): boolean {
    return analysis.isTree;
  }

  generate(flow: FlowGraph, analysis: TopologyAnalysis): HAYamlOutput {
    const warnings: string[] = [];

    // Extract triggers from the flow
    const triggers = this.extractTriggers(flow);

    // Build action sequence starting from first node after triggers
    const entryNodes = analysis.entryNodes;
    const firstActions = entryNodes.flatMap((entryId) => {
      const outgoing = this.getOutgoingEdges(flow, entryId);
      return outgoing.map((e) => e.target);
    });

    // Remove duplicates
    const uniqueFirstActions = [...new Set(firstActions)];

    // Build the action sequence
    let actions: unknown[];
    if (uniqueFirstActions.length === 1) {
      actions = this.buildSequenceFromNode(flow, uniqueFirstActions[0], new Set());
    } else if (uniqueFirstActions.length > 1) {
      // Multiple paths from triggers - use parallel
      actions = [
        {
          parallel: uniqueFirstActions.map((nodeId) =>
            this.buildSequenceFromNode(flow, nodeId, new Set())
          ),
        },
      ];
    } else {
      actions = [];
      warnings.push('No actions found after trigger nodes');
    }

    const automation: Record<string, unknown> = {
      alias: flow.name,
      description: flow.description || '',
      trigger: triggers,
      action: actions,
      mode: flow.metadata?.mode ?? 'single',
    };

    // Add optional metadata
    if (flow.metadata?.max) {
      automation.max = flow.metadata.max;
    }
    if (flow.metadata?.max_exceeded) {
      automation.max_exceeded = flow.metadata.max_exceeded;
    }

    return {
      automation,
      warnings,
      strategy: this.name,
    };
  }

  /**
   * Extract trigger configurations from trigger nodes
   */
  private extractTriggers(flow: FlowGraph): unknown[] {
    return flow.nodes
      .filter((n): n is TriggerNode => n.type === 'trigger')
      .map((node) => this.buildTrigger(node));
  }

  /**
   * Build a single trigger configuration
   */
  private buildTrigger(node: TriggerNode): Record<string, unknown> {
    // Start with all the original data
    const trigger: Record<string, unknown> = { ...node.data };

    // Ensure platform is set (this might have been derived during import)
    if (!trigger.platform && trigger.trigger) {
      trigger.platform = trigger.trigger as string;
    } else if (!trigger.platform && trigger.domain) {
      trigger.platform = trigger.domain as string;
    } else if (!trigger.platform) {
      trigger.platform = 'device';
    }

    // Clean up undefined/empty values
    return Object.fromEntries(
      Object.entries(trigger).filter(([, v]) => v !== undefined && v !== '' && v !== null)
    );
  }

  /**
   * Recursively build action sequence from a node
   */
  private buildSequenceFromNode(flow: FlowGraph, nodeId: string, visited: Set<string>): unknown[] {
    if (visited.has(nodeId)) {
      return []; // Avoid infinite loops
    }
    visited.add(nodeId);

    const node = this.getNode(flow, nodeId);
    if (!node) {
      return [];
    }

    const sequence: unknown[] = [];

    // Build the current node's action
    const action = this.buildNodeAction(node);
    if (action) {
      sequence.push(action);
    }

    // Get outgoing edges
    const outgoing = this.getOutgoingEdges(flow, nodeId);

    if (node.type === 'condition') {
      // Condition nodes are handled specially - they become choose blocks
      // We need to fill in the then/else branches from the connected nodes
      const chooseAction = action as Record<string, unknown>;

      // Find then and else paths
      const truePath = outgoing.filter((edge) => edge.sourceHandle === 'true');
      const falsePath = outgoing.filter((edge) => edge.sourceHandle === 'false');

      if (truePath.length > 0) {
        const thenActions = truePath.flatMap((edge) =>
          this.buildSequenceFromNode(flow, edge.target, new Set(visited))
        );
        chooseAction.then = thenActions;
      }

      if (falsePath.length > 0) {
        const elseActions = falsePath.flatMap((edge) =>
          this.buildSequenceFromNode(flow, edge.target, new Set(visited))
        );
        chooseAction.else = elseActions;
      }
    } else if (outgoing.length === 1) {
      // Single outgoing edge - continue the sequence
      const nextActions = this.buildSequenceFromNode(flow, outgoing[0].target, new Set(visited));
      sequence.push(...nextActions);
    } else if (outgoing.length > 1) {
      // Multiple outgoing edges (parallel paths)
      const parallelActions = outgoing.map((edge) =>
        this.buildSequenceFromNode(flow, edge.target, new Set(visited))
      );
      if (parallelActions.some((a) => a.length > 0)) {
        sequence.push({
          parallel: parallelActions.filter((a) => a.length > 0),
        });
      }
    }

    return sequence;
  }

  /**
   * Build action configuration for a single node
   */
  private buildNodeAction(node: FlowNode): Record<string, unknown> | null {
    switch (node.type) {
      case 'trigger':
        return null; // Triggers are handled separately

      case 'condition':
        return this.buildConditionChoose(node);

      case 'action':
        return this.buildActionCall(node);

      case 'delay':
        return this.buildDelay(node);

      case 'wait':
        return this.buildWait(node);

      default:
        return null;
    }
  }

  /**
   * Build a choose block for a condition node
   */
  private buildConditionChoose(node: ConditionNode): Record<string, unknown> {
    const condition = this.buildCondition(node);

    return {
      if: [condition],
      then: [], // Will be filled by the caller
      else: [], // Will be filled by the caller
    };
  }

  /**
   * Build condition configuration
   */
  private buildCondition(node: ConditionNode): Record<string, unknown> {
    // Helper to recursively map condition_type to condition
    function mapCondition(data: Record<string, unknown>): Record<string, unknown> {
      if (!data || typeof data !== 'object') return data;
      const { condition_type, conditions, alias, ...rest } = data;
      const out: Record<string, unknown> = {
        condition: condition_type,
        ...rest,
      };
      if (alias) {
        out.alias = alias;
      }
      // Recursively map nested group conditions
      if (Array.isArray(conditions) && conditions.length > 0) {
        out.conditions = conditions
          .map(mapCondition)
          .filter((c) => c && (!Array.isArray(c.conditions) || c.conditions.length > 0));
      }
      return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ''));
    }
    return mapCondition(node.data);
  }

  /**
   * Build service call action
   */
  private buildActionCall(node: ActionNode): Record<string, unknown> {
    const action: Record<string, unknown> = {
      service: node.data.service,
    };

    if (node.data.target) {
      action.target = node.data.target;
    }

    if (node.data.data) {
      action.data = node.data.data;
    }

    if (node.data.data_template) {
      action.data_template = node.data.data_template;
    }

    if (node.data.response_variable) {
      action.response_variable = node.data.response_variable;
    }

    if (node.data.continue_on_error) {
      action.continue_on_error = node.data.continue_on_error;
    }

    if (node.data.enabled === false) {
      action.enabled = false;
    }

    return action;
  }

  /**
   * Build delay action
   */
  private buildDelay(node: DelayNode): Record<string, unknown> {
    return {
      delay: node.data.delay,
    };
  }

  /**
   * Build wait action
   */
  private buildWait(node: WaitNode): Record<string, unknown> {
    const wait: Record<string, unknown> = {};

    if (node.data.wait_template) {
      wait.wait_template = node.data.wait_template;
    } else if (node.data.wait_for_trigger) {
      wait.wait_for_trigger = node.data.wait_for_trigger.map((triggerData) => {
        const trigger = { ...triggerData };
        // Don't include alias in the trigger definition itself
        // delete trigger.alias;
        return Object.fromEntries(
          Object.entries(trigger).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
      });
    }

    if (node.data.timeout) {
      wait.timeout = node.data.timeout;
    }

    if (node.data.continue_on_timeout !== undefined) {
      wait.continue_on_timeout = node.data.continue_on_timeout;
    }

    return wait;
  }
}
