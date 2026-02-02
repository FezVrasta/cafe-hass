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
import { findBackEdges } from '../analyzer/topology';
import { BaseStrategy, type HAYamlOutput } from './base';

/**
 * Describes a detected repeat pattern in the flow graph
 */
interface RepeatPattern {
  type: 'while' | 'until' | 'count';
  /** The node ID that serves as the entry point to this repeat pattern */
  entryNodeId: string;
  /** Condition node IDs in the repeat (for while/until) */
  conditionNodeIds: string[];
  /** Body node IDs (the sequence inside the loop) */
  bodyNodeIds: string[];
  /** The source node of the back-edge */
  backEdgeSourceId: string;
  /** For count: the init set_vars node ID */
  initNodeId?: string;
  /** For count: the increment set_vars node ID */
  incrementNodeId?: string;
  /** For count: the count value */
  count?: number | string;
  /** The node ID where flow continues after the loop */
  exitNodeId: string | null;
}

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

  /** Repeat patterns detected in the current flow */
  private repeatPatterns: Map<string, RepeatPattern> = new Map();
  /** Set of all node IDs that are internal to a repeat pattern */
  private repeatInternalNodeIds: Set<string> = new Set();
  /** Set of back-edge IDs detected via DFS */
  private backEdgeIds: Set<string> = new Set();

  generate(flow: FlowGraph, analysis: TopologyAnalysis): HAYamlOutput {
    const warnings: string[] = [];

    // Structurally detect back-edges using DFS
    this.backEdgeIds = findBackEdges(flow);

    // Pre-detect repeat patterns from structural back-edges
    this.repeatPatterns = this.detectRepeatPatterns(flow);
    this.repeatInternalNodeIds = new Set();
    for (const pattern of this.repeatPatterns.values()) {
      for (const id of pattern.bodyNodeIds) this.repeatInternalNodeIds.add(id);
      for (const id of pattern.conditionNodeIds) this.repeatInternalNodeIds.add(id);
      if (pattern.initNodeId) this.repeatInternalNodeIds.add(pattern.initNodeId);
      if (pattern.incrementNodeId) this.repeatInternalNodeIds.add(pattern.incrementNodeId);
    }

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

    // Check if leading conditions can be promoted to root conditions block.
    // Conditions directly after triggers with no else/false paths can be placed
    // in the root "conditions:" block so HA properly tracks "Last triggered at".
    let rootConditions: unknown[] | null = null;
    let actionsStartNodeId: string | null = null;
    let promotedVisited: Set<string> | null = null;

    if (uniqueFirstActions.length === 1) {
      const promoted = this.extractLeadingConditions(flow, uniqueFirstActions[0]);
      if (promoted.conditions.length > 0) {
        rootConditions = promoted.conditions;
        actionsStartNodeId = promoted.nextNodeId;
        promotedVisited = promoted.visitedIds;
      }
    }

    // Build the action sequence
    let actions: unknown[];
    if (rootConditions) {
      // Leading conditions promoted to root - build actions from continuation point
      if (actionsStartNodeId) {
        actions = this.buildSequenceFromNode(flow, actionsStartNodeId, promotedVisited!);
      } else {
        actions = [];
      }
    } else if (uniqueFirstActions.length === 1) {
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
      triggers: triggers,
    };

    if (rootConditions && rootConditions.length > 0) {
      automation.conditions = rootConditions;
    }

    automation.actions = actions;
    automation.mode = flow.metadata?.mode ?? 'single';

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
   * Detect repeat patterns by structurally analyzing back-edges in the graph.
   * Classification rules:
   * - Back-edge target is a condition, source is NOT a condition → while
   * - Back-edge source is a condition with sourceHandle='false' → until
   * - Back-edge source is a condition with sourceHandle='true' → count
   */
  private detectRepeatPatterns(flow: FlowGraph): Map<string, RepeatPattern> {
    const patterns = new Map<string, RepeatPattern>();

    for (const edge of flow.edges) {
      if (!this.backEdgeIds.has(edge.id)) continue;

      const sourceNode = this.getNode(flow, edge.source);
      const targetNode = this.getNode(flow, edge.target);
      if (!sourceNode || !targetNode) continue;

      if (targetNode.type === 'condition' && sourceNode.type !== 'condition') {
        // ── while pattern ──
        // Back-edge: last body node → first condition node
        const firstCondId = edge.target;
        const backEdgeSourceId = edge.source;

        // Collect condition chain: follow true edges from condition to condition
        const conditionNodeIds: string[] = [];
        let currentId = firstCondId;
        while (currentId) {
          const node = this.getNode(flow, currentId);
          if (node?.type !== 'condition') break;
          conditionNodeIds.push(currentId);
          const trueEdge = flow.edges.find(
            (e) => e.source === currentId && e.sourceHandle === 'true' && !this.backEdgeIds.has(e.id)
          );
          if (!trueEdge) break;
          const nextNode = this.getNode(flow, trueEdge.target);
          if (nextNode?.type === 'condition' && conditionNodeIds.indexOf(trueEdge.target) === -1) {
            currentId = trueEdge.target;
          } else {
            break;
          }
        }

        // Body nodes: everything between last condition's true target and back-edge source
        const lastCondId = conditionNodeIds[conditionNodeIds.length - 1];
        const bodyNodeIds = this.collectBodyNodes(
          flow,
          lastCondId,
          'true',
          new Set(conditionNodeIds),
          backEdgeSourceId
        );

        // Exit: first condition's false path
        const falseEdge = flow.edges.find(
          (e) => e.source === firstCondId && e.sourceHandle === 'false' && !this.backEdgeIds.has(e.id)
        );

        patterns.set(firstCondId, {
          type: 'while',
          entryNodeId: firstCondId,
          conditionNodeIds,
          bodyNodeIds,
          backEdgeSourceId,
          exitNodeId: falseEdge?.target ?? null,
        });
      } else if (sourceNode.type === 'condition' && edge.sourceHandle === 'false') {
        // ── until pattern ──
        // Back-edge: condition →(false)→ first body node
        const firstBodyId = edge.target;
        const firstCondId = edge.source;

        const conditionNodeIds: string[] = [];
        let condId: string | null = firstCondId;
        while (condId) {
          const node = this.getNode(flow, condId);
          if (node?.type !== 'condition') break;
          conditionNodeIds.push(condId);
          const trueEdge = flow.edges.find(
            (e) => e.source === condId && e.sourceHandle === 'true' && !this.backEdgeIds.has(e.id)
          );
          if (!trueEdge) break;
          const nextNode = this.getNode(flow, trueEdge.target);
          if (nextNode?.type === 'condition' && conditionNodeIds.indexOf(trueEdge.target) === -1) {
            condId = trueEdge.target;
          } else {
            break;
          }
        }

        // Body nodes: traverse forward from firstBodyId until we hit the condition
        const bodyNodeIds = this.collectNodesUntil(
          flow,
          firstBodyId,
          new Set(conditionNodeIds)
        );

        // Exit: last condition's true path
        const lastCondId = conditionNodeIds[conditionNodeIds.length - 1];
        const trueEdge = flow.edges.find(
          (e) => e.source === lastCondId && e.sourceHandle === 'true' && !this.backEdgeIds.has(e.id)
        );

        patterns.set(firstBodyId, {
          type: 'until',
          entryNodeId: firstBodyId,
          conditionNodeIds,
          bodyNodeIds,
          backEdgeSourceId: firstCondId,
          exitNodeId: trueEdge?.target ?? null,
        });
      } else if (sourceNode.type === 'condition' && edge.sourceHandle === 'true') {
        // ── count pattern ──
        // Back-edge: condition →(true)→ first body node
        const loopTargetId = edge.target;
        const condId = edge.source;

        const conditionNodeIds = [condId];

        // Find the increment node: it's a set_variables predecessor of the condition
        const condPredEdges = flow.edges.filter(
          (e) => e.target === condId && !this.backEdgeIds.has(e.id)
        );
        const incrementNodeId = condPredEdges.length > 0 ? condPredEdges[0].source : undefined;

        // Body nodes: from loopTargetId to incrementNodeId
        const stopSet = new Set<string>([condId]);
        if (incrementNodeId) stopSet.add(incrementNodeId);
        const bodyNodeIds = this.collectNodesUntil(flow, loopTargetId, stopSet);

        // Find the init node: predecessor of the first body node that is set_variables
        const initCandidates = flow.edges
          .filter((e) => e.target === loopTargetId && !this.backEdgeIds.has(e.id))
          .map((e) => e.source);
        const initNodeId = initCandidates.find((id) => {
          const n = this.getNode(flow, id);
          return n?.type === 'set_variables';
        });

        // Extract count from the condition's value_template
        const condNode = this.getNode(flow, condId);
        let countValue: number | string | undefined;
        if (condNode?.type === 'condition' && condNode.data.condition === 'template') {
          const tmpl = condNode.data.value_template;
          if (typeof tmpl === 'string') {
            // Extract N from "{{ _repeat_counter_xxx < N }}"
            const match = tmpl.match(/<\s*(\d+)\s*\}\}/);
            if (match) {
              countValue = Number.parseInt(match[1], 10);
            }
          }
        }

        // Exit: condition's false path
        const falseEdge = flow.edges.find(
          (e) => e.source === condId && e.sourceHandle === 'false' && !this.backEdgeIds.has(e.id)
        );

        // Entry is the init node if it exists, otherwise the first body node
        const entryNodeId = initNodeId ?? loopTargetId;

        patterns.set(entryNodeId, {
          type: 'count',
          entryNodeId,
          conditionNodeIds,
          bodyNodeIds,
          backEdgeSourceId: condId,
          initNodeId,
          incrementNodeId,
          count: countValue,
          exitNodeId: falseEdge?.target ?? null,
        });
      }
    }

    return patterns;
  }

  /**
   * Collect body node IDs starting from a condition's specified handle path
   * until reaching the backEdgeSource (inclusive)
   */
  private collectBodyNodes(
    flow: FlowGraph,
    condNodeId: string,
    handle: 'true' | 'false',
    excludeIds: Set<string>,
    backEdgeSourceId: string
  ): string[] {
    const startEdge = flow.edges.find(
      (e) => e.source === condNodeId && e.sourceHandle === handle && !this.backEdgeIds.has(e.id)
    );
    if (!startEdge) return [];

    const bodyIds: string[] = [];
    const queue = [startEdge.target];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id) || excludeIds.has(id)) continue;
      visited.add(id);
      bodyIds.push(id);

      if (id === backEdgeSourceId) continue; // Don't traverse beyond back-edge source

      const outgoing = flow.edges.filter((e) => e.source === id && !this.backEdgeIds.has(e.id));
      for (const e of outgoing) {
        if (!visited.has(e.target) && !excludeIds.has(e.target)) {
          queue.push(e.target);
        }
      }
    }

    return bodyIds;
  }

  /**
   * Collect node IDs by traversing forward until hitting any node in stopIds
   */
  private collectNodesUntil(
    flow: FlowGraph,
    startId: string,
    stopIds: Set<string>
  ): string[] {
    const bodyIds: string[] = [];
    const queue = [startId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id) || stopIds.has(id)) continue;
      visited.add(id);
      bodyIds.push(id);

      const outgoing = flow.edges.filter((e) => e.source === id && !this.backEdgeIds.has(e.id));
      for (const e of outgoing) {
        if (!visited.has(e.target) && !stopIds.has(e.target)) {
          queue.push(e.target);
        }
      }
    }

    return bodyIds;
  }

  /**
   * Build a repeat: YAML block from a detected repeat pattern
   */
  private buildRepeatBlock(
    flow: FlowGraph,
    pattern: RepeatPattern,
    visited: Set<string>
  ): Record<string, unknown> | null {
    // Mark all pattern nodes as visited
    for (const id of pattern.conditionNodeIds) visited.add(id);
    for (const id of pattern.bodyNodeIds) visited.add(id);
    if (pattern.initNodeId) visited.add(pattern.initNodeId);
    if (pattern.incrementNodeId) visited.add(pattern.incrementNodeId);
    visited.add(pattern.entryNodeId);

    // Build the body sequence
    const bodySequence: unknown[] = [];
    for (const bodyNodeId of pattern.bodyNodeIds) {
      const bodyNode = this.getNode(flow, bodyNodeId);
      if (!bodyNode) continue;

      if (bodyNode.type === 'condition') {
        // Check if this condition has branching within the loop body
        const outgoing = flow.edges.filter(
          (e) => e.source === bodyNodeId && !this.backEdgeIds.has(e.id)
        );
        const truePath = outgoing.find((e) => e.sourceHandle === 'true');
        const falsePath = outgoing.find((e) => e.sourceHandle === 'false');

        if (truePath || falsePath) {
          // Build as if/then/else within the loop body
          const condAction: Record<string, unknown> = {
            if: [this.buildCondition(bodyNode as ConditionNode)],
            then: [],
            else: [],
          };
          if (truePath && pattern.bodyNodeIds.includes(truePath.target)) {
            condAction.then = this.buildBodySubsequence(flow, truePath.target, pattern, visited);
          }
          if (falsePath && pattern.bodyNodeIds.includes(falsePath.target)) {
            condAction.else = this.buildBodySubsequence(flow, falsePath.target, pattern, visited);
          }
          bodySequence.push(condAction);
        } else {
          // Inline condition guard
          bodySequence.push(this.buildCondition(bodyNode as ConditionNode));
        }
      } else {
        const action = this.buildNodeAction(bodyNode);
        if (action) {
          bodySequence.push(action);
        }
      }
    }

    // Get alias from the first condition (while) or from the init node (count)
    let alias: string | undefined;

    if (pattern.type === 'while') {
      // Build while conditions
      const whileConditions = pattern.conditionNodeIds.map((id) => {
        const node = this.getNode(flow, id) as ConditionNode;
        if (!alias && node?.data?.alias) alias = node.data.alias;
        return this.buildCondition(node);
      });

      const result: Record<string, unknown> = {
        repeat: {
          while: whileConditions,
          sequence: bodySequence,
        },
      };
      if (alias) result.alias = alias;
      return result;
    }

    if (pattern.type === 'until') {
      const untilConditions = pattern.conditionNodeIds.map((id) => {
        const node = this.getNode(flow, id) as ConditionNode;
        return this.buildCondition(node);
      });

      const result: Record<string, unknown> = {
        repeat: {
          until: untilConditions,
          sequence: bodySequence,
        },
      };
      if (alias) result.alias = alias;
      return result;
    }

    if (pattern.type === 'count') {
      if (pattern.initNodeId) {
        const initNode = this.getNode(flow, pattern.initNodeId);
        if (initNode?.data && 'alias' in initNode.data) {
          alias = initNode.data.alias as string | undefined;
        }
      }

      const result: Record<string, unknown> = {
        repeat: {
          count: pattern.count,
          sequence: bodySequence,
        },
      };
      if (alias) result.alias = alias;
      return result;
    }

    return null;
  }

  /**
   * Build a sub-sequence within a repeat body for branching paths
   */
  private buildBodySubsequence(
    flow: FlowGraph,
    startId: string,
    pattern: RepeatPattern,
    visited: Set<string>
  ): unknown[] {
    const sequence: unknown[] = [];
    let currentId: string | null = startId;

    while (currentId && pattern.bodyNodeIds.includes(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const node = this.getNode(flow, currentId);
      if (!node) break;

      const action = this.buildNodeAction(node);
      if (action) {
        sequence.push(action);
      }

      const outgoing = flow.edges.filter(
        (e) => e.source === currentId && !this.backEdgeIds.has(e.id)
      );
      currentId = outgoing.length === 1 ? outgoing[0].target : null;
    }

    return sequence;
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
   * Extract leading condition nodes that can be promoted to the root conditions block.
   * Only conditions with no false/else path are promotable, forming a straight chain
   * from triggers to actions via true paths only.
   */
  private extractLeadingConditions(
    flow: FlowGraph,
    startNodeId: string
  ): { conditions: unknown[]; nextNodeId: string | null; visitedIds: Set<string> } {
    const conditions: unknown[] = [];
    const visitedIds = new Set<string>();
    let currentId: string | null = startNodeId;

    while (currentId) {
      const node = this.getNode(flow, currentId);
      if (!node || node.type !== 'condition') break;

      // Don't promote conditions that are part of a repeat pattern
      if (this.repeatPatterns.has(currentId) || this.repeatInternalNodeIds.has(currentId)) break;

      const allOutgoing = this.getOutgoingEdges(flow, currentId);
      const outgoing = allOutgoing.filter((e) => !this.backEdgeIds.has(e.id));
      const truePath = outgoing.find((edge) => edge.sourceHandle === 'true');
      const falsePath = outgoing.find((edge) => edge.sourceHandle === 'false');

      // Can only promote if the condition has a single path (no branching)
      if (truePath && falsePath) break;
      // Must have at least one path
      if (!truePath && !falsePath) break;

      // Build the condition object with alias preserved
      const condition = this.buildCondition(node as ConditionNode);
      if ((node as ConditionNode).data.alias) {
        condition.alias = (node as ConditionNode).data.alias;
      }

      if (falsePath) {
        // Connected via false handle only → inverted condition, wrap in "not"
        conditions.push({
          condition: 'not',
          conditions: [condition],
        });
        visitedIds.add(currentId);
        currentId = falsePath.target;
      } else {
        // Connected via true handle only → promote as-is
        conditions.push(condition);
        visitedIds.add(currentId);
        currentId = truePath!.target;
      }
    }

    return { conditions, nextNodeId: currentId, visitedIds };
  }

  /**
   * Build a single trigger configuration
   */
  private buildTrigger(node: TriggerNode): Record<string, unknown> {
    const trigger: Record<string, unknown> = { ...node.data };

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
      .filter((e) => e.target === targetNodeId && e.sourceHandle === handleType && !this.backEdgeIds.has(e.id))
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

    // Check if this node is the entry point of a repeat pattern
    const repeatPattern = this.repeatPatterns.get(nodeId);
    if (repeatPattern) {
      const repeatBlock = this.buildRepeatBlock(flow, repeatPattern, visited);
      if (repeatBlock) {
        sequence.push(repeatBlock);
        // Continue from the exit node
        if (repeatPattern.exitNodeId) {
          const afterRepeat = this.buildSequenceFromNode(
            flow,
            repeatPattern.exitNodeId,
            new Set(visited)
          );
          sequence.push(...afterRepeat);
        }
        return sequence;
      }
    }

    // Normal processing - add to visited now
    visited.add(nodeId);

    // Get outgoing edges (excluding repeat back-edges)
    const outgoing = this.getOutgoingEdges(flow, nodeId).filter(
      (e) => !this.backEdgeIds.has(e.id)
    );

    if (node.type === 'condition') {
      // ===== Condition Chain Logic =====
      // This logic identifies chains of conditions and merges them into a single 'choose'

      const conditions: unknown[] = [];
      let currentNode: FlowNode = node;
      let thenNodeId: string | null = null;
      let elseNodeId: string | null = null;

      // The 'else' path is taken from the very first condition in the chain
      const originalElsePath = this.getOutgoingEdges(flow, node.id).find(
        (edge) => edge.sourceHandle === 'false' && !this.backEdgeIds.has(edge.id)
      );
      if (originalElsePath) {
        elseNodeId = originalElsePath.target;
      }

      // Start traversing the 'true' path to find all sequential conditions
      // Only chain conditions that share the same "else" behavior (no else, or same else target)
      while (currentNode?.type === 'condition') {
        conditions.push(this.buildCondition(currentNode as ConditionNode));

        const truePath = this.getOutgoingEdges(flow, currentNode.id).find(
          (edge) => edge.sourceHandle === 'true' && !this.backEdgeIds.has(edge.id)
        );

        if (!truePath) {
          thenNodeId = null;
          break;
        }

        const nextNode = this.getNode(flow, truePath.target);

        // If the next node is a condition and not visited, check if we should continue chaining
        // Never chain conditions that are part of a repeat pattern
        if (
          nextNode?.type === 'condition' &&
          !visited.has(nextNode.id) &&
          !this.repeatPatterns.has(nextNode.id) &&
          !this.repeatInternalNodeIds.has(nextNode.id)
        ) {
          // Check if the next condition has a false path
          const nextFalsePath = this.getOutgoingEdges(flow, nextNode.id).find(
            (edge) => edge.sourceHandle === 'false' && !this.backEdgeIds.has(edge.id)
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

    // Get outgoing edges (excluding repeat back-edges)
    const outgoing = this.getOutgoingEdges(flow, nodeId).filter(
      (e) => !this.backEdgeIds.has(e.id)
    );

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

    // Check if this is a fallback repeat action (opaque repeat block)
    if (node.data.repeat) {
      const repeatData = node.data.repeat;
      const action: Record<string, unknown> = {
        repeat: {
          ...(repeatData.count !== undefined ? { count: repeatData.count } : {}),
          ...(repeatData.while ? { while: repeatData.while } : {}),
          ...(repeatData.until ? { until: repeatData.until } : {}),
          sequence: repeatData.sequence ?? [],
        },
      };
      if (node.data.alias) action.alias = node.data.alias;
      if (node.data.enabled === false) action.enabled = false;
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
      repeat: _repeat,
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
        const trigger: Record<string, unknown> = { ...triggerData };
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
