import type { FlowEdge, FlowGraph } from '@cafe/shared';
import graphlib from 'graphlib';

const { Graph, alg } = graphlib;

type GraphInstance = InstanceType<typeof Graph>;

/**
 * Find back-edges in the flow graph using DFS.
 * A back-edge is an edge that goes from a node to one of its ancestors
 * in the DFS tree, creating a cycle. Removing all back-edges makes the
 * graph acyclic.
 *
 * This is used to identify repeat/loop patterns structurally without
 * requiring any edge metadata.
 */
export function findBackEdges(flow: FlowGraph): Set<string> {
  const backEdgeIds = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  // Build adjacency map
  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of flow.edges) {
    const existing = outgoing.get(edge.source) || [];
    existing.push(edge);
    outgoing.set(edge.source, existing);
  }

  // Find entry nodes (no incoming edges)
  const incomingTargets = new Set(flow.edges.map((e) => e.target));
  const entryNodes = flow.nodes.filter((n) => !incomingTargets.has(n.id)).map((n) => n.id);

  function dfs(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);

    for (const edge of outgoing.get(nodeId) || []) {
      if (inStack.has(edge.target)) {
        backEdgeIds.add(edge.id);
      } else if (!visited.has(edge.target)) {
        dfs(edge.target);
      }
    }

    inStack.delete(nodeId);
  }

  for (const entry of entryNodes) {
    dfs(entry);
  }

  // Handle disconnected components
  for (const node of flow.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return backEdgeIds;
}

/**
 * Result of topology analysis
 */
export interface TopologyAnalysis {
  /**
   * True if the graph is a simple tree (can use native HA YAML)
   */
  isTree: boolean;
  /**
   * True if the graph contains cycles (requires state machine)
   */
  hasCycles: boolean;
  /**
   * True if there are multiple entry points (multiple triggers)
   */
  hasMultipleEntryPoints: boolean;
  /**
   * True if there are cross-links that skip levels or go backward
   */
  hasCrossLinks: boolean;
  /**
   * True if paths merge back together (diamond patterns)
   */
  hasConvergingPaths: boolean;
  /**
   * True if different triggers lead to different action paths
   * (e.g., trigger A → action 1, trigger B → action 2)
   * This requires state machine to route based on which trigger fired
   */
  hasDivergentTriggerPaths: boolean;
  /**
   * Node IDs that serve as entry points (triggers)
   */
  entryNodes: string[];
  /**
   * Node IDs that have no outgoing edges (terminal nodes)
   */
  exitNodes: string[];
  /**
   * Topologically sorted node IDs (if acyclic)
   */
  topologicalOrder: string[] | null;
  /**
   * Recommended transpilation strategy
   */
  recommendedStrategy: 'native' | 'state-machine';
}

/**
 * Analyze the topology of a flow graph
 * Determines whether the graph can be transpiled to native HA YAML
 * or requires the state machine approach
 */
export function analyzeTopology(flow: FlowGraph): TopologyAnalysis {
  const g = new Graph({ directed: true });

  // Structurally detect back-edges (loop edges) using DFS
  const backEdgeIds = findBackEdges(flow);

  // Build a node type lookup for classifying back-edges
  const nodeTypeMap = new Map(flow.nodes.map((n) => [n.id, n.type]));

  // Only exclude back-edges that form repeat patterns (involve a condition node).
  // True cycles (action→action loops) should still be detected as cycles.
  const repeatBackEdgeIds = new Set<string>();
  for (const edge of flow.edges) {
    if (!backEdgeIds.has(edge.id)) continue;
    const sourceType = nodeTypeMap.get(edge.source);
    const targetType = nodeTypeMap.get(edge.target);
    // Repeat patterns always involve a condition node at one end
    if (sourceType === 'condition' || targetType === 'condition') {
      repeatBackEdgeIds.add(edge.id);
    }
  }

  // Filter out repeat back-edges for acyclic structural analysis
  const forwardEdges = flow.edges.filter((e) => !repeatBackEdgeIds.has(e.id));
  // Create a filtered flow view for analysis functions that operate on flow.edges
  const filteredFlow: FlowGraph = { ...flow, edges: forwardEdges };

  // Build the graph (excluding back-edges)
  for (const node of flow.nodes) {
    g.setNode(node.id, node);
  }
  for (const edge of forwardEdges) {
    g.setEdge(edge.source, edge.target, edge);
  }

  // Detect cycles using graphlib's isAcyclic (back-edges excluded)
  const hasCycles = !alg.isAcyclic(g);

  // Find entry points (nodes with no incoming forward edges)
  const entryNodes = flow.nodes.filter((n) => g.predecessors(n.id)?.length === 0).map((n) => n.id);

  // Find exit points (nodes with no outgoing forward edges)
  const exitNodes = flow.nodes
    .filter((n) => {
      const forwardOutgoing = forwardEdges.filter((e) => e.source === n.id);
      return forwardOutgoing.length === 0;
    })
    .map((n) => n.id);

  // Get topological order if acyclic
  let topologicalOrder: string[] | null = null;
  if (!hasCycles) {
    try {
      topologicalOrder = alg.topsort(g);
    } catch {
      // Should not happen if isAcyclic is true
      topologicalOrder = null;
    }
  }

  // Check for cross-links (edges that skip levels) - use filtered flow
  const hasCrossLinks = detectCrossLinks(g, filteredFlow, topologicalOrder);

  // Check for converging paths (multiple edges pointing to same node) - use filtered flow
  const hasConvergingPaths = detectConvergingPaths(filteredFlow);

  // Check for divergent trigger paths (different triggers → different actions)
  const hasDivergentTriggerPaths = detectDivergentTriggerPaths(g, filteredFlow);

  // A tree structure has:
  // - No cycles
  // - Single entry point
  // - No cross-links
  // - No converging paths (except for condition branches that merge)
  // - No divergent trigger paths (all triggers lead to same actions)
  const isTree = !hasCycles && !hasCrossLinks && !hasConvergingPaths && !hasDivergentTriggerPaths;

  // Determine recommended strategy
  const recommendedStrategy = isTree ? 'native' : 'state-machine';

  return {
    isTree,
    hasCycles,
    hasMultipleEntryPoints: entryNodes.length > 1,
    hasCrossLinks,
    hasConvergingPaths,
    hasDivergentTriggerPaths,
    entryNodes,
    exitNodes,
    topologicalOrder,
    recommendedStrategy,
  };
}

/**
 * Detect cross-links: edges that skip levels in the graph hierarchy
 * or create backward references (but not full cycles)
 *
 * Exception: parallel branches of different lengths that converge to a common
 * target are NOT cross-links - they're valid parallel patterns.
 */
function detectCrossLinks(
  g: GraphInstance,
  flow: FlowGraph,
  topologicalOrder: string[] | null
): boolean {
  if (!topologicalOrder || topologicalOrder.length === 0) {
    return false; // Can't detect cross-links in cyclic graphs
  }

  // Create a level map based on topological order
  const levelMap = new Map<string, number>();

  // BFS from entry nodes to assign levels
  const entryNodes = flow.nodes.filter((n) => g.predecessors(n.id)?.length === 0).map((n) => n.id);

  const queue: Array<{ nodeId: string; level: number }> = entryNodes.map((id) => ({
    nodeId: id,
    level: 0,
  }));

  while (queue.length > 0) {
    const { nodeId, level } = queue.shift()!;

    if (levelMap.has(nodeId)) {
      continue; // Already visited
    }

    levelMap.set(nodeId, level);

    const successors = g.successors(nodeId) || [];
    for (const succ of successors) {
      if (!levelMap.has(succ)) {
        queue.push({ nodeId: succ, level: level + 1 });
      }
    }
  }

  // Build map of nodes with multiple outgoing edges (potential parallel sources)
  const parallelSources = new Set<string>();
  const outgoingEdgeCount = new Map<string, number>();
  for (const edge of flow.edges) {
    const count = (outgoingEdgeCount.get(edge.source) || 0) + 1;
    outgoingEdgeCount.set(edge.source, count);
  }
  for (const [nodeId, count] of outgoingEdgeCount) {
    if (count > 1) {
      const node = flow.nodes.find((n) => n.id === nodeId);
      // Only non-condition nodes with multiple edges are parallel sources
      // (condition nodes have true/false branching)
      if (node?.type !== 'condition') {
        const nodeEdges = flow.edges.filter((e) => e.source === nodeId);
        const hasConditionLabels = nodeEdges.some(
          (e) => e.sourceHandle === 'true' || e.sourceHandle === 'false'
        );
        if (!hasConditionLabels) {
          parallelSources.add(nodeId);
        }
      }
    }
  }

  // Build map of nodes with multiple incoming edges (potential convergence points)
  const convergencePoints = new Set<string>();
  const incomingEdgeCount = new Map<string, number>();
  for (const edge of flow.edges) {
    const count = (incomingEdgeCount.get(edge.target) || 0) + 1;
    incomingEdgeCount.set(edge.target, count);
  }
  for (const [nodeId, count] of incomingEdgeCount) {
    if (count > 1) {
      convergencePoints.add(nodeId);
    }
  }

  // Check for edges that skip more than one level
  for (const edge of flow.edges) {
    const sourceLevel = levelMap.get(edge.source);
    const targetLevel = levelMap.get(edge.target);

    if (sourceLevel !== undefined && targetLevel !== undefined) {
      // Forward edge that skips a level
      if (targetLevel > sourceLevel + 1) {
        return true;
      }
      // Backward edge (not a full cycle, but goes to earlier level)
      if (targetLevel < sourceLevel) {
        // Check if this is a parallel branch convergence pattern:
        // The target is a convergence point AND there's a parallel source
        // somewhere upstream that created these parallel branches
        if (convergencePoints.has(edge.target) && parallelSources.size > 0) {
          // This might be a valid parallel pattern - check if the source
          // can trace back to a parallel source
          const canReachParallelSource = traceToParallelSourceBFS(
            flow,
            edge.source,
            parallelSources
          );
          if (canReachParallelSource) {
            // This is a parallel branch of different length converging - OK
            continue;
          }
        }
        return true;
      }
    }
  }

  return false;
}

/**
 * Trace backwards from a node to see if it can reach any parallel source
 */
function traceToParallelSourceBFS(
  flow: FlowGraph,
  startNodeId: string,
  parallelSources: Set<string>
): boolean {
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    if (parallelSources.has(nodeId)) {
      return true;
    }

    // Find predecessors
    const predecessors = flow.edges.filter((e) => e.target === nodeId).map((e) => e.source);

    for (const pred of predecessors) {
      if (!visited.has(pred)) {
        queue.push(pred);
      }
    }
  }

  return false;
}

/**
 * Detect divergent trigger paths: different triggers lead to different action chains
 * In native HA, all triggers run the same action sequence, so if triggers have
 * different targets, we need the state machine to route based on which trigger fired.
 */
function detectDivergentTriggerPaths(g: GraphInstance, flow: FlowGraph): boolean {
  // Find all trigger nodes
  const triggerNodes = flow.nodes.filter((n) => n.type === 'trigger');

  // If 0 or 1 trigger, no divergence possible
  if (triggerNodes.length <= 1) {
    return false;
  }

  // Get the immediate targets of each trigger
  const triggerTargets = triggerNodes.map((trigger) => {
    const successors = g.successors(trigger.id) || [];
    return new Set(successors);
  });

  // Check if all triggers have the same targets
  const firstTargets = triggerTargets[0];
  for (let i = 1; i < triggerTargets.length; i++) {
    const currentTargets = triggerTargets[i];

    // Check if sets are equal
    if (firstTargets.size !== currentTargets.size) {
      return true; // Different number of targets = divergent
    }

    for (const target of firstTargets) {
      if (!currentTargets.has(target)) {
        return true; // Different targets = divergent
      }
    }
  }

  return false;
}

/**
 * Detect converging paths: multiple edges pointing to the same node
 * This creates a DAG pattern that can't be represented as a simple tree
 *
 * Exception: parallel block convergence (multiple branches from a common source
 * that all converge to the same target) can be represented natively
 */
function detectConvergingPaths(flow: FlowGraph): boolean {
  const incomingCount = new Map<string, number>();

  for (const edge of flow.edges) {
    const count = incomingCount.get(edge.target) || 0;
    incomingCount.set(edge.target, count + 1);
  }

  // Build a map of outgoing edges for each node
  const outgoingEdges = new Map<string, string[]>();
  for (const edge of flow.edges) {
    const existing = outgoingEdges.get(edge.source) || [];
    existing.push(edge.target);
    outgoingEdges.set(edge.source, existing);
  }

  for (const [nodeId, count] of incomingCount) {
    if (count > 1) {
      const incomingEdges = flow.edges.filter((e) => e.target === nodeId);
      const uniqueSources = new Set(incomingEdges.map((e) => e.source));

      if (uniqueSources.size > 1) {
        // It's a convergence. But is it from multiple triggers?
        const sourceNodes = [...uniqueSources].map((sourceId) =>
          flow.nodes.find((n) => n.id === sourceId)
        );
        const allSourcesAreTriggers = sourceNodes.every((n) => n?.type === 'trigger');

        if (allSourcesAreTriggers) {
          continue; // Multiple triggers converging - OK for native
        }

        // Check if this is a parallel block convergence pattern:
        // All converging sources must share a common predecessor that has
        // multiple outgoing edges (parallel branches)
        const isParallelConvergence = checkParallelConvergence(
          flow,
          [...uniqueSources],
          outgoingEdges,
          nodeId
        );

        if (!isParallelConvergence) {
          return true; // It's a true convergence that requires state-machine
        }
      }
    }
  }

  return false;
}

/**
 * Check if the converging sources form a parallel block pattern
 * A parallel block pattern is when:
 * 1. All converging branches originate from the same source node
 * 2. That source node is NOT a condition node (which would be branching, not parallel)
 * 3. The outgoing edges from that source are NOT labeled with sourceHandle (true/false)
 * 4. The incoming edges to the convergence point are NOT all from condition true paths
 *
 * This handles parallel blocks like: source → [A, B, C] → target
 * But NOT condition branching: condition → (true)A / (false)B → target
 */
function checkParallelConvergence(
  flow: FlowGraph,
  convergingSources: string[],
  _outgoingEdges: Map<string, string[]>,
  convergenceTargetId: string
): boolean {
  // Check: if all converging sources are conditions and all incoming edges
  // to the convergence point have the same sourceHandle (all 'true' OR all 'false'),
  // this is an OR condition pattern that CAN be handled by native strategy.
  const incomingEdgesToTarget = flow.edges.filter((e) => e.target === convergenceTargetId);
  const allSourcesAreConditions = convergingSources.every((sourceId) => {
    const node = flow.nodes.find((n) => n.id === sourceId);
    return node?.type === 'condition';
  });
  const allIncomingFromTruePath = incomingEdgesToTarget.every((e) => e.sourceHandle === 'true');
  const allIncomingFromFalsePath = incomingEdgesToTarget.every((e) => e.sourceHandle === 'false');

  if (allSourcesAreConditions && (allIncomingFromTruePath || allIncomingFromFalsePath)) {
    // This is an OR condition pattern (multiple conditions' true/false paths converging)
    // This CAN be represented as native "condition: or" in Home Assistant YAML
    return true;
  }

  // Find predecessors of each converging source
  const predecessorsOf = (nodeId: string): string[] => {
    return flow.edges.filter((e) => e.target === nodeId).map((e) => e.source);
  };

  // Check if edges from a node are parallel (not condition branching)
  const isParallelSource = (nodeId: string): boolean => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    // Condition nodes use true/false branching, not parallel
    if (node?.type === 'condition') {
      return false;
    }

    // Check if any outgoing edges have sourceHandle (condition labels)
    const nodeOutgoingEdges = flow.edges.filter((e) => e.source === nodeId);
    const hasConditionLabels = nodeOutgoingEdges.some(
      (e) => e.sourceHandle === 'true' || e.sourceHandle === 'false'
    );
    if (hasConditionLabels) {
      return false;
    }

    // Must have multiple outgoing edges for parallel
    return nodeOutgoingEdges.length > 1;
  };

  // Trace back each converging source to find the "parallel source" - the node
  // where parallel branches diverge
  const traceToParallelSource = (nodeId: string, visited: Set<string>): string | null => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const preds = predecessorsOf(nodeId);
    if (preds.length === 0) return null;
    if (preds.length > 1) return null; // Node has multiple predecessors, not a simple chain

    const pred = preds[0];

    // If predecessor is a parallel source (not condition branching), found it
    if (isParallelSource(pred)) {
      return pred;
    }

    // Otherwise, trace further back
    return traceToParallelSource(pred, visited);
  };

  // Find parallel source for each converging branch
  const parallelSources = new Set<string>();

  for (const sourceId of convergingSources) {
    // First check if this source's immediate predecessor is a parallel source
    const preds = predecessorsOf(sourceId);
    if (preds.length === 1) {
      const pred = preds[0];
      if (isParallelSource(pred)) {
        parallelSources.add(pred);
        continue;
      }
    }

    // Trace back to find parallel source
    const parallelSource = traceToParallelSource(sourceId, new Set());
    if (parallelSource) {
      parallelSources.add(parallelSource);
    } else {
      // No parallel source found for this branch - it's not a parallel pattern
      return false;
    }
  }

  // All converging branches must share the same parallel source
  return parallelSources.size === 1;
}

/**
 * Get the depth of each node from entry points
 */
export function getNodeDepths(flow: FlowGraph): Map<string, number> {
  const g = new Graph({ directed: true });

  for (const node of flow.nodes) {
    g.setNode(node.id, node);
  }
  for (const edge of flow.edges) {
    g.setEdge(edge.source, edge.target);
  }

  const depths = new Map<string, number>();
  const entryNodes = flow.nodes.filter((n) => g.predecessors(n.id)?.length === 0).map((n) => n.id);

  const queue: Array<{ nodeId: string; depth: number }> = entryNodes.map((id) => ({
    nodeId: id,
    depth: 0,
  }));

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;

    if (depths.has(nodeId) && depths.get(nodeId)! <= depth) {
      continue;
    }

    depths.set(nodeId, depth);

    const successors = g.successors(nodeId) || [];
    for (const succ of successors) {
      queue.push({ nodeId: succ, depth: depth + 1 });
    }
  }

  return depths;
}
