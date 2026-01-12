import type { FlowGraph } from '@cafe/shared';
import type { TopologyAnalysis } from '../analyzer/topology';

/**
 * Output format from a transpiler strategy
 */
export interface HAYamlOutput {
  /**
   * Generated automation config (for native strategy)
   */
  automation?: Record<string, unknown>;
  /**
   * Generated script config (for state machine strategy)
   */
  script?: Record<string, unknown>;
  /**
   * Warnings generated during transpilation
   */
  warnings: string[];
  /**
   * The strategy used for transpilation
   */
  strategy: string;
}

/**
 * Base interface for transpiler strategies
 */
export interface TranspilerStrategy {
  /**
   * Unique name for this strategy
   */
  readonly name: string;

  /**
   * Description of when this strategy should be used
   */
  readonly description: string;

  /**
   * Check if this strategy can handle the given topology
   */
  canHandle(analysis: TopologyAnalysis): boolean;

  /**
   * Generate Home Assistant YAML from a flow graph
   */
  generate(flow: FlowGraph, analysis: TopologyAnalysis): HAYamlOutput;
}

/**
 * Base class with common utility methods for strategies
 */
export abstract class BaseStrategy implements TranspilerStrategy {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract canHandle(analysis: TopologyAnalysis): boolean;
  abstract generate(flow: FlowGraph, analysis: TopologyAnalysis): HAYamlOutput;

  /**
   * Find the entry node(s) of a flow
   */
  protected findEntryNodes(flow: FlowGraph): string[] {
    const targetNodes = new Set(flow.edges.map((e) => e.target));
    return flow.nodes.filter((n) => !targetNodes.has(n.id)).map((n) => n.id);
  }

  /**
   * Get outgoing edges from a node
   */
  protected getOutgoingEdges(flow: FlowGraph, nodeId: string) {
    return flow.edges.filter((e) => e.source === nodeId);
  }

  /**
   * Get incoming edges to a node
   */
  protected getIncomingEdges(flow: FlowGraph, nodeId: string) {
    return flow.edges.filter((e) => e.target === nodeId);
  }

  /**
   * Get a node by ID
   */
  protected getNode(flow: FlowGraph, nodeId: string) {
    return flow.nodes.find((n) => n.id === nodeId);
  }

}
