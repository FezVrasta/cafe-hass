import type {
  ActionNode,
  ConditionNode,
  DelayNode,
  FlowGraph,
  FlowNode,
  SetVariablesNode,
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
      // First, find if branches converge to a common node
      const convergencePoint = this.findConvergencePoint(
        flow,
        outgoing.map((e) => e.target)
      );

      if (convergencePoint) {
        // Build each branch up to (but not including) the convergence point
        const parallelActions = outgoing.map((edge) =>
          this.buildSequenceUntilNode(flow, edge.target, convergencePoint, new Set(visited))
        );
        if (parallelActions.some((a) => a.length > 0)) {
          sequence.push({
            parallel: parallelActions.filter((a) => a.length > 0),
          });
        }
        // Continue from the convergence point
        const afterParallel = this.buildSequenceFromNode(flow, convergencePoint, new Set(visited));
        sequence.push(...afterParallel);
      } else {
        // No convergence - just build all branches
        const parallelActions = outgoing.map((edge) =>
          this.buildSequenceFromNode(flow, edge.target, new Set(visited))
        );
        if (parallelActions.some((a) => a.length > 0)) {
          sequence.push({
            parallel: parallelActions.filter((a) => a.length > 0),
          });
        }
      }
    }

    return sequence;
  }

  /**
   * Find the convergence point where multiple branches meet
   * Returns the node ID if all branches converge, null otherwise
   */
  private findConvergencePoint(flow: FlowGraph, branchStarts: string[]): string | null {
    if (branchStarts.length < 2) return null;

    // For each branch, find all reachable nodes
    const reachableSets = branchStarts.map((startId) => {
      const reachable = new Set<string>();
      const queue = [startId];
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (reachable.has(nodeId)) continue;
        reachable.add(nodeId);
        const outgoing = this.getOutgoingEdges(flow, nodeId);
        for (const edge of outgoing) {
          queue.push(edge.target);
        }
      }
      return reachable;
    });

    // Find nodes that are reachable from ALL branches
    const firstSet = reachableSets[0];
    const commonNodes = [...firstSet].filter((nodeId) =>
      reachableSets.every((set) => set.has(nodeId))
    );

    if (commonNodes.length === 0) return null;

    // Find the earliest common node (closest to the branch starts)
    // by checking which node has the minimum maximum distance from any branch start
    let bestNode: string | null = null;
    let bestMaxDistance = Number.POSITIVE_INFINITY;

    for (const nodeId of commonNodes) {
      const distances = branchStarts.map((startId) =>
        this.getShortestDistance(flow, startId, nodeId)
      );
      const maxDist = Math.max(...distances);
      if (maxDist < bestMaxDistance) {
        bestMaxDistance = maxDist;
        bestNode = nodeId;
      }
    }

    return bestNode;
  }

  /**
   * Get shortest distance from start to target node using BFS
   */
  private getShortestDistance(flow: FlowGraph, startId: string, targetId: string): number {
    if (startId === targetId) return 0;

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId: startId, distance: 0 }];

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const outgoing = this.getOutgoingEdges(flow, nodeId);
      for (const edge of outgoing) {
        if (edge.target === targetId) {
          return distance + 1;
        }
        if (!visited.has(edge.target)) {
          queue.push({ nodeId: edge.target, distance: distance + 1 });
        }
      }
    }

    return Number.POSITIVE_INFINITY;
  }

  /**
   * Build sequence from a node until reaching the stop node (exclusive)
   */
  private buildSequenceUntilNode(
    flow: FlowGraph,
    nodeId: string,
    stopNodeId: string,
    visited: Set<string>
  ): unknown[] {
    if (nodeId === stopNodeId) {
      return []; // Don't include the stop node
    }

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
      // Condition nodes are handled specially
      const chooseAction = action as Record<string, unknown>;
      const truePath = outgoing.filter((edge) => edge.sourceHandle === 'true');
      const falsePath = outgoing.filter((edge) => edge.sourceHandle === 'false');

      if (truePath.length > 0) {
        const thenActions = truePath.flatMap((edge) =>
          this.buildSequenceUntilNode(flow, edge.target, stopNodeId, new Set(visited))
        );
        chooseAction.then = thenActions;
      }

      if (falsePath.length > 0) {
        const elseActions = falsePath.flatMap((edge) =>
          this.buildSequenceUntilNode(flow, edge.target, stopNodeId, new Set(visited))
        );
        chooseAction.else = elseActions;
      }
    } else if (outgoing.length === 1) {
      // Single outgoing edge - continue if not at stop node
      if (outgoing[0].target !== stopNodeId) {
        const nextActions = this.buildSequenceUntilNode(
          flow,
          outgoing[0].target,
          stopNodeId,
          new Set(visited)
        );
        sequence.push(...nextActions);
      }
    } else if (outgoing.length > 1) {
      // Multiple outgoing edges - this is a nested parallel inside a parallel
      // For now, just build all branches until stop node
      const parallelActions = outgoing.map((edge) =>
        this.buildSequenceUntilNode(flow, edge.target, stopNodeId, new Set(visited))
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

      case 'set_variables':
        return this.buildSetVariables(node);

      default:
        return null;
    }
  }

  /**
   * Build a choose block for a condition node
   */
  private buildConditionChoose(node: ConditionNode): Record<string, unknown> {
    // Build the full condition including any nested conditions
    const condition = this.buildCondition(node);

    const choose: Record<string, unknown> = {
      alias: node.data.alias,
      if: [condition],
      then: [], // Will be filled by the caller
      else: [], // Will be filled by the caller
    };

    // Note: 'id' for trigger conditions belongs inside the condition object, not at the if/then/else level
    // The id is already included via buildCondition's ...rest spread

    return choose;
  }

  /**
   * Map a single condition object (used for individual conditions in an array)
   */
  private mapSingleCondition(data: Record<string, unknown>): Record<string, unknown> {
    const { condition, conditions, alias, template, ...rest } = data;
    const out: Record<string, unknown> = {
      condition: condition,
      ...rest,
    };
    // For template conditions, ensure value_template is set from template if needed
    if (condition === 'template' && !rest.value_template && template) {
      out.value_template = template;
    }
    // Recursively map nested group conditions
    if (Array.isArray(conditions) && conditions.length > 0) {
      out.conditions = (conditions as Record<string, unknown>[])
        .map((c) => this.mapSingleCondition(c))
        .filter(
          (c) => c && (!Array.isArray(c.conditions) || (c.conditions as unknown[]).length > 0)
        );
    }
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ''));
  }

  /**
   * Build condition configuration
   */
  private buildCondition(node: ConditionNode): Record<string, unknown> {
    // Helper to recursively map condition to condition
    function mapCondition(data: Record<string, unknown>): Record<string, unknown> {
      if (!data || typeof data !== 'object') return data;
      // Destructure and exclude 'template' - HA uses 'value_template' for template conditions
      const { condition, conditions, alias, template, ...rest } = data;
      const out: Record<string, unknown> = {
        condition: condition,
        ...rest,
      };
      // For template conditions, ensure value_template is set from template if needed
      if (condition === 'template' && !rest.value_template && template) {
        out.value_template = template;
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
    const action: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      alias,
      service,
    };

    if (id) {
      action.id = id;
    }

    if (target) {
      action.target = target;
    }

    if (data) {
      action.data = data;
    }

    if (data_template) {
      action.data_template = data_template;
    }

    if (response_variable) {
      action.response_variable = response_variable;
    }

    if (continue_on_error) {
      action.continue_on_error = continue_on_error;
    }

    if (enabled === false) {
      action.enabled = false;
    }

    return action;
  }

  /**
   * Build delay action
   */
  private buildDelay(node: DelayNode): Record<string, unknown> {
    // Use spread pattern to preserve unknown properties from custom integrations
    const { alias, delay: delayValue, id, ...extraProps } = node.data;
    const delay: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      alias,
      delay: delayValue,
    };

    if (id) {
      delay.id = id;
    }

    return delay;
  }

  /**
   * Build wait action
   */
  private buildWait(node: WaitNode): Record<string, unknown> {
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
    const wait: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      alias,
    };

    if (id) {
      wait.id = id;
    }

    if (wait_template) {
      wait.wait_template = wait_template;
    } else if (wait_for_trigger) {
      wait.wait_for_trigger = wait_for_trigger.map((triggerData) => {
        const trigger = { ...triggerData };
        // Don't include alias in the trigger definition itself
        // delete trigger.alias;
        return Object.fromEntries(
          Object.entries(trigger).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
      });
    }

    if (timeout) {
      wait.timeout = timeout;
    }

    if (continue_on_timeout !== undefined) {
      wait.continue_on_timeout = continue_on_timeout;
    }

    return wait;
  }

  /**
   * Build set variables action
   */
  private buildSetVariables(node: SetVariablesNode): Record<string, unknown> {
    // Use spread pattern to preserve unknown properties from custom integrations
    const { alias, id, variables, ...extraProps } = node.data;
    const setVars: Record<string, unknown> = {
      ...extraProps, // Preserve extra properties
      variables,
    };

    if (alias) {
      setVars.alias = alias;
    }

    if (id) {
      setVars.id = id;
    }

    return setVars;
  }
}
