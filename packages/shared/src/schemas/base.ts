import { z } from 'zod';

/**
 * Branded type for Node IDs to ensure type safety
 */
export const NodeIdSchema = z.string().min(1).brand<'NodeId'>();
export type NodeId = z.infer<typeof NodeIdSchema>;

/**
 * Home Assistant entity ID format: domain.entity_name
 */
export const EntityIdSchema = z.string().regex(
  /^[a-z_]+\.[a-z0-9_]+$/,
  'Entity ID must be in format: domain.entity_name (e.g., light.living_room)'
);
export type EntityId = z.infer<typeof EntityIdSchema>;

/**
 * Position in the React Flow canvas
 */
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

/**
 * Handle configuration for node connections
 */
export const HandleSchema = z.object({
  id: z.string(),
  type: z.enum(['source', 'target']),
  position: z.enum(['top', 'bottom', 'left', 'right']),
});
export type Handle = z.infer<typeof HandleSchema>;

/**
 * Common metadata for automation/script configuration
 */
export const AutomationModeSchema = z.enum(['single', 'restart', 'queued', 'parallel']);
export type AutomationMode = z.infer<typeof AutomationModeSchema>;

export const MaxExceededSchema = z.enum(['silent', 'warning', 'critical']);
export type MaxExceeded = z.infer<typeof MaxExceededSchema>;
