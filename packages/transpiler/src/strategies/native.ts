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
import { isDeviceAction } from '@cafe/shared';
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
      // Check if this is an OR pattern: all first actions are conditions
      // whose true/false paths converge to the same target
      const orPattern = this.detectOrPattern(flow, uniqueFirstActions);

      if (orPattern) {
        // Build OR condition block
        const orConditions = orPattern.conditions.map((c) => this.buildCondition(c));
        const visited = new Set(orPattern.conditions.map((c) => c.id));

        const thenSequence = this.buildSequenceFromNode(flow, orPattern.convergenceNode, visited);

        actions = [
          {
            if: [{ condition: 'or', conditions: orConditions }],
            then: thenSequence,
            else: orPattern.isFromFalsePaths ? [] : [], // OR conditions from true paths have empty else
          },
        ];
      } else {
        // Multiple paths from triggers - use parallel
        const parallelBranches = uniqueFirstActions.map((nodeId) =>
          this.buildSequenceFromNode(flow, nodeId, new Set())
        );
        // Flatten single-action branches to avoid double-nesting (- - service:)
        const flattenedBranches = parallelBranches
          .filter((branch) => branch.length > 0)
          .map((branch) => (branch.length === 1 ? branch[0] : branch));
        actions = [
          {
            parallel: flattenedBranches,
          },
        ];
      }
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
   * Detect if multiple first actions form an OR pattern
   * (all are conditions whose true OR false paths converge to the same node)
   */
  private detectOrPattern(
    flow: FlowGraph,
    firstActionIds: string[]
  ): { conditions: ConditionNode[]; convergenceNode: string; isFromFalsePaths: boolean } | null {
    // All first actions must be condition nodes
    const conditions = firstActionIds.map((id) => this.getNode(flow, id));
    if (!conditions.every((n): n is ConditionNode => n?.type === 'condition')) {
      return null;
    }

    // Check if all true paths converge to the same node
    const trueTargets = new Set<string>();
    for (const cond of conditions) {
      const trueEdge = flow.edges.find((e) => e.source === cond.id && e.sourceHandle === 'true');
      if (trueEdge) {
        trueTargets.add(trueEdge.target);
      }
    }

    if (trueTargets.size === 1 && conditions.length === firstActionIds.length) {
      // All conditions have the same true target
      const convergenceNode = [...trueTargets][0];
      return {
        conditions: conditions as ConditionNode[],
        convergenceNode,
        isFromFalsePaths: false,
      };
    }

    // Check if all false paths converge to the same node
    const falseTargets = new Set<string>();
    for (const cond of conditions) {
      const falseEdge = flow.edges.find((e) => e.source === cond.id && e.sourceHandle === 'false');
      if (falseEdge) {
        falseTargets.add(falseEdge.target);
      }
    }

    if (falseTargets.size === 1 && conditions.length === firstActionIds.length) {
      // All conditions have the same false target
      const convergenceNode = [...falseTargets][0];
      return {
        conditions: conditions as ConditionNode[],
        convergenceNode,
        isFromFalsePaths: true,
      };
    }

    return null;
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
   * Find condition nodes whose specified handle (true/false) points to a given target node
   * Returns the condition sources if there are multiple (OR pattern), empty array otherwise
   */
  private findOrConditionSources(
    flow: FlowGraph,
    targetNodeId: string,
    handleType: 'true' | 'false',
    visited: Set<string>
  ): ConditionNode[] {
    const sources = flow.edges
      .filter((e) => e.target === targetNodeId && e.sourceHandle === handleType)
      .map((e) => this.getNode(flow, e.source))
      .filter((n): n is ConditionNode => n?.type === 'condition' && !visited.has(n.id));

    return sources.length > 1 ? sources : [];
  }

  /**
   * Recursively build action sequence from a node
   */
  private buildSequenceFromNode(flow: FlowGraph, nodeId: string, visited: Set<string>): unknown[] {
    if (visited.has(nodeId)) {
      return []; // Avoid infinite loops
    }

    const node = this.getNode(flow, nodeId);
    if (!node) {
      return [];
    }

    const sequence: unknown[] = [];

    // Check if this node is an OR convergence point (multiple conditions' true/false paths converge here)
    const orTrueSources = this.findOrConditionSources(flow, nodeId, 'true', visited);
    const orFalseSources = this.findOrConditionSources(flow, nodeId, 'false', visited);

    if (orTrueSources.length > 1) {
      // Multiple conditions' TRUE paths converge here - build OR block
      const orConditions = orTrueSources.map((c) => this.buildCondition(c));
      // Mark these conditions as visited
      for (const c of orTrueSources) {
        visited.add(c.id);
      }

      // Now add the current node to visited and build the then sequence
      visited.add(nodeId);
      const thenSequence =
        node.type === 'condition'
          ? this.buildSequenceFromNode(flow, nodeId, new Set()) // Process this condition node fresh
          : this.buildSequenceFromNode(flow, nodeId, new Set(visited));

      // For OR conditions, prepend the current node's action to the then sequence if it's not a condition
      let finalThenSequence: unknown[];
      if (node.type !== 'condition') {
        const currentAction = this.buildNodeAction(node);
        finalThenSequence = currentAction ? [currentAction, ...thenSequence] : thenSequence;
      } else {
        finalThenSequence = thenSequence;
      }

      sequence.push({
        if: [{ condition: 'or', conditions: orConditions }],
        then: finalThenSequence,
        else: [], // OR conditions don't have a shared else path
      });
      return sequence;
    }

    if (orFalseSources.length > 1) {
      // Multiple conditions' FALSE paths converge here - build OR block (negated logic)
      // When false paths converge, it means "if NOT cond1 AND NOT cond2" which is equivalent to "if NOT (cond1 OR cond2)"
      const orConditions = orFalseSources.map((c) => this.buildCondition(c));
      // Mark these conditions as visited
      for (const c of orFalseSources) {
        visited.add(c.id);
      }

      // Now add the current node to visited and build the then sequence
      visited.add(nodeId);
      const thenSequence =
        node.type === 'condition'
          ? this.buildSequenceFromNode(flow, nodeId, new Set())
          : this.buildSequenceFromNode(flow, nodeId, new Set(visited));

      // For OR conditions, prepend the current node's action to the then sequence if it's not a condition
      let finalThenSequence: unknown[];
      if (node.type !== 'condition') {
        const currentAction = this.buildNodeAction(node);
        finalThenSequence = currentAction ? [currentAction, ...thenSequence] : thenSequence;
      } else {
        finalThenSequence = thenSequence;
      }

      // Since false paths converge, we negate by swapping then/else
      // "if any condition is false, do this" = "if NOT(all conditions true), do this"
      sequence.push({
        if: [{ condition: 'or', conditions: orConditions }],
        then: [], // When OR is true, we don't execute (this is the "else" in normal terms)
        else: finalThenSequence, // When OR is false (all conditions false), execute
      });
      return sequence;
    }

    // Normal processing - add to visited now
    visited.add(nodeId);

    // Get outgoing edges
    const outgoing = this.getOutgoingEdges(flow, nodeId);

    if (node.type === 'condition') {
      // ===== Condition Chain Logic =====
      // This logic identifies chains of conditions and merges them into a single 'choose'

      const conditions: unknown[] = [];
      let currentNode: FlowNode = node;
      let thenNodeId: string | null = null;
      let elseNodeId: string | null = null;

      // The 'else' path is taken from the very first condition in the chain
      const originalElsePath = this.getOutgoingEdges(flow, node.id).find(
        (edge) => edge.sourceHandle === 'false'
      );
      if (originalElsePath) {
        elseNodeId = originalElsePath.target;
      }

      // Start traversing the 'true' path to find all sequential conditions
      // Only chain conditions that share the same "else" behavior (no else, or same else target)
      while (currentNode?.type === 'condition') {
        conditions.push(this.buildCondition(currentNode as ConditionNode));

        const truePath = this.getOutgoingEdges(flow, currentNode.id).find(
          (edge) => edge.sourceHandle === 'true'
        );

        if (!truePath) {
          thenNodeId = null;
          break;
        }

        const nextNode = this.getNode(flow, truePath.target);

        // If the next node is a condition and not visited, check if we should continue chaining
        if (nextNode?.type === 'condition' && !visited.has(nextNode.id)) {
          // Check if the next condition has a false path
          const nextFalsePath = this.getOutgoingEdges(flow, nextNode.id).find(
            (edge) => edge.sourceHandle === 'false'
          );

          // Only continue chaining if:
          // 1. The next condition has no false path (it can be merged), OR
          // 2. The next condition's false path goes to the same target as the first condition's false path
          const canChain = !nextFalsePath || nextFalsePath.target === elseNodeId;

          if (canChain) {
            currentNode = nextNode;
            visited.add(currentNode.id); // Mark as visited to avoid re-processing
          } else {
            // The next condition has its own else branch - don't merge it
            // Instead, it becomes part of the "then" sequence as a nested if
            thenNodeId = truePath.target;
            break;
          }
        } else {
          // End of chain: the target is not a condition or is already visited
          thenNodeId = truePath.target;
          break;
        }
      }

      // Put conditions directly in the if: array - HA implicitly ANDs them
      const chooseAction: Record<string, unknown> = {
        alias: node.data.alias, // Use alias from the first condition
        if: conditions,
        then: [],
        else: [],
      };

      if (thenNodeId) {
        chooseAction.then = this.buildSequenceFromNode(flow, thenNodeId, new Set(visited));
      }
      if (elseNodeId) {
        chooseAction.else = this.buildSequenceFromNode(flow, elseNodeId, new Set(visited));
      }

      sequence.push(chooseAction);
    } else {
      // ===== Default Logic for Non-Condition Nodes =====
      const action = this.buildNodeAction(node);
      if (action) {
        sequence.push(action);
      }

      if (outgoing.length === 1) {
        // Single outgoing edge - continue the sequence
        const nextActions = this.buildSequenceFromNode(flow, outgoing[0].target, new Set(visited));
        sequence.push(...nextActions);
      } else if (outgoing.length > 1) {
        // Multiple outgoing edges (parallel paths)
        const convergencePoint = this.findConvergencePoint(
          flow,
          outgoing.map((e) => e.target)
        );

        if (convergencePoint) {
          const parallelActions = outgoing.map((edge) =>
            this.buildSequenceUntilNode(flow, edge.target, convergencePoint, new Set(visited))
          );
          const filteredBranches = parallelActions.filter((a) => a.length > 0);
          if (filteredBranches.length > 0) {
            // Flatten single-action branches to avoid double-nesting (- - service:)
            const flattenedBranches = filteredBranches.map((branch) =>
              branch.length === 1 ? branch[0] : branch
            );
            sequence.push({
              parallel: flattenedBranches,
            });
          }
          const afterParallel = this.buildSequenceFromNode(
            flow,
            convergencePoint,
            new Set(visited)
          );
          sequence.push(...afterParallel);
        } else {
          const parallelActions = outgoing.map((edge) =>
            this.buildSequenceFromNode(flow, edge.target, new Set(visited))
          );
          const filteredBranches = parallelActions.filter((a) => a.length > 0);
          if (filteredBranches.length > 0) {
            // Flatten single-action branches to avoid double-nesting (- - service:)
            const flattenedBranches = filteredBranches.map((branch) =>
              branch.length === 1 ? branch[0] : branch
            );
            sequence.push({
              parallel: flattenedBranches,
            });
          }
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
      const filteredBranches = parallelActions.filter((a) => a.length > 0);
      if (filteredBranches.length > 0) {
        // Flatten single-action branches to avoid double-nesting (- - service:)
        const flattenedBranches = filteredBranches.map((branch) =>
          branch.length === 1 ? branch[0] : branch
        );
        sequence.push({
          parallel: flattenedBranches,
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
    if (isDeviceAction(node.data.data)) {
      const deviceData = node.data.data;
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
