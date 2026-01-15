import type { FlowGraph } from '@cafe/shared';
import graphlib from 'graphlib';

const { Graph, alg } = graphlib;

type GraphInstance = InstanceType<typeof Graph>;

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

  // Build the graph
  for (const node of flow.nodes) {
    g.setNode(node.id, node);
  }
  for (const edge of flow.edges) {
    g.setEdge(edge.source, edge.target, edge);
  }

  // Detect cycles using graphlib's isAcyclic
  const hasCycles = !alg.isAcyclic(g);

  // Find entry points (nodes with no incoming edges)
  const entryNodes = flow.nodes.filter((n) => g.predecessors(n.id)?.length === 0).map((n) => n.id);

  // Find exit points (nodes with no outgoing edges)
  const exitNodes = flow.nodes.filter((n) => g.successors(n.id)?.length === 0).map((n) => n.id);

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

  // Check for cross-links (edges that skip levels)
  const hasCrossLinks = detectCrossLinks(g, flow, topologicalOrder);

  // Check for converging paths (multiple edges pointing to same node)
  const hasConvergingPaths = detectConvergingPaths(flow);

  // Check for divergent trigger paths (different triggers → different actions)
  const hasDivergentTriggerPaths = detectDivergentTriggerPaths(g, flow);

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
        return true;
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
 */
function detectConvergingPaths(flow: FlowGraph): boolean {
  const incomingCount = new Map<string, number>();

  for (const edge of flow.edges) {
    const count = incomingCount.get(edge.target) || 0;
    incomingCount.set(edge.target, count + 1);
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

        if (!allSourcesAreTriggers) {
          return true; // It's a true convergence that requires state-machine
        }
      }
    }
  }

  return false;
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
