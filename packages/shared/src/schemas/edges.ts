import { z } from 'zod';

/**
 * Edge schema for connections between nodes
 */
export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /**
   * Source handle ID - used for condition nodes to specify 'true' or 'false' branch
   */
  sourceHandle: z.string().nullable().optional(),
  /**
   * Target handle ID - usually 'input' or left unspecified
   */
  targetHandle: z.string().nullable().optional(),
  /**
   * Optional label for the edge (displayed on the canvas)
   */
  label: z.string().optional(),
  /**
   * Whether this edge is animated (useful for highlighting execution paths)
   */
  animated: z.boolean().optional(),
});
export type FlowEdge = z.infer<typeof EdgeSchema>;

/**
 * Validate that an edge connects valid handles
 * For condition nodes: sourceHandle must be 'true' or 'false'
 */
export const ConditionEdgeSchema = EdgeSchema.extend({
  sourceHandle: z.enum(['true', 'false']),
});
export type ConditionEdge = z.infer<typeof ConditionEdgeSchema>;
