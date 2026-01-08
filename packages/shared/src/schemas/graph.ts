import { z } from 'zod';
import { AutomationModeSchema, MaxExceededSchema } from './base';
import { NodeSchema } from './nodes';
import { EdgeSchema } from './edges';

/**
 * Metadata for the flow graph
 */
export const FlowMetadataSchema = z.object({
  /**
   * Automation mode - controls behavior when triggered while running
   */
  mode: AutomationModeSchema.default('single'),
  /**
   * Behavior when max runs exceeded (for queued/parallel modes)
   */
  max_exceeded: MaxExceededSchema.optional(),
  /**
   * Maximum concurrent runs (for queued/parallel modes)
   */
  max: z.number().positive().optional(),
  /**
   * Initial state of the automation (enabled/disabled)
   */
  initial_state: z.boolean().default(true),
  /**
   * Hide from UI
   */
  hide_entity: z.boolean().optional(),
  /**
   * Trace configuration
   */
  trace: z.object({
    stored_traces: z.number().optional(),
  }).optional(),
});
export type FlowMetadata = z.infer<typeof FlowMetadataSchema>;

/**
 * Complete flow graph schema
 * Represents the entire automation as a graph of nodes and edges
 */
export const FlowGraphSchema = z.object({
  /**
   * Unique identifier for this flow
   */
  id: z.string().uuid(),
  /**
   * Human-readable name (becomes the automation alias)
   */
  name: z.string().min(1),
  /**
   * Optional description
   */
  description: z.string().optional(),
  /**
   * Array of nodes (triggers, conditions, actions)
   */
  nodes: z.array(NodeSchema),
  /**
   * Array of edges connecting nodes
   */
  edges: z.array(EdgeSchema),
  /**
   * Optional metadata for automation configuration
   */
  metadata: FlowMetadataSchema.optional(),
  /**
   * Version for schema migrations
   */
  version: z.literal(1).default(1),
});
export type FlowGraph = z.infer<typeof FlowGraphSchema>;

/**
 * Validate graph structure beyond schema validation
 * - All edge sources/targets must reference existing nodes
 * - Trigger nodes should have no incoming edges
 * - Graph must have at least one trigger node
 */
export function validateGraphStructure(graph: FlowGraph): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // Check for duplicate node IDs
  if (nodeIds.size !== graph.nodes.length) {
    errors.push('Duplicate node IDs detected');
  }

  // Check that all edge references are valid
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`);
    }
  }

  // Check for at least one trigger node
  const triggerNodes = graph.nodes.filter((n) => n.type === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push('Graph must have at least one trigger node');
  }

  // Check that trigger nodes have no incoming edges
  const nodesWithIncoming = new Set(graph.edges.map((e) => e.target));
  for (const trigger of triggerNodes) {
    if (nodesWithIncoming.has(trigger.id)) {
      errors.push(`Trigger node ${trigger.id} should not have incoming edges`);
    }
  }

  // Check condition node edges have valid handles
  const conditionNodes = new Set(
    graph.nodes.filter((n) => n.type === 'condition').map((n) => n.id)
  );
  for (const edge of graph.edges) {
    if (conditionNodes.has(edge.source)) {
      if (edge.sourceHandle !== 'true' && edge.sourceHandle !== 'false') {
        errors.push(
          `Edge ${edge.id} from condition node must have sourceHandle 'true' or 'false', got: ${edge.sourceHandle}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
