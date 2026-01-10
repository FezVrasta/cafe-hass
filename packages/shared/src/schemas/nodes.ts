import { z } from 'zod';
import { PositionSchema } from './base';
import {
  ConditionTypeSchema,
  OptionalTargetSchema,
  ServiceDataSchema,
  ServiceDataTemplateSchema,
  TriggerPlatformSchema,
} from './ha-entities';

// ============================================
// TRIGGER NODE
// ============================================

/**
 * Data schema for trigger nodes
 * Contains HA-specific trigger configuration
 */
export const TriggerDataSchema = z
  .object({
    alias: z.string().optional(),
    platform: TriggerPlatformSchema,
    // State trigger
    entity_id: z.union([z.string(), z.array(z.string())]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    for: z
      .union([
        z.string(),
        z.object({
          hours: z.number().optional(),
          minutes: z.number().optional(),
          seconds: z.number().optional(),
        }),
      ])
      .optional(),
    // Time trigger
    at: z.string().optional(),
    // Time pattern trigger
    hours: z.string().optional(),
    minutes: z.string().optional(),
    seconds: z.string().optional(),
    // Event trigger
    event_type: z.string().optional(),
    event_data: z.record(z.unknown()).optional(),
    // Sun trigger (sunrise/sunset) or Zone trigger (enter/leave)
    event: z.enum(['sunrise', 'sunset', 'enter', 'leave']).optional(),
    offset: z.string().optional(),
    // Numeric state trigger
    above: z.union([z.number(), z.string()]).optional(),
    below: z.union([z.number(), z.string()]).optional(),
    value_template: z.string().optional(),
    // Template trigger
    template: z.string().optional(),
    // Webhook trigger
    webhook_id: z.string().optional(),
    // Zone trigger
    zone: z.string().optional(),
    // MQTT trigger
    topic: z.string().optional(),
    payload: z.string().optional(),
    // Device trigger fields
    device_id: z.string().optional(),
    domain: z.string().optional(),
    type: z.string().optional(), // Not to be confused with node type
    subtype: z.string().optional(),
  })
  .passthrough(); // Allow additional properties to be preserved
export type TriggerData = z.infer<typeof TriggerDataSchema>;

export const TriggerNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('trigger'),
  position: PositionSchema,
  data: TriggerDataSchema,
});
export type TriggerNode = z.infer<typeof TriggerNodeSchema>;

// ============================================
// CONDITION NODE
// ============================================

/**
 * Base condition data schema (non-recursive fields)
 */
const BaseConditionDataSchema = z.object({
  alias: z.string().optional(),
  condition_type: ConditionTypeSchema,
  // Common fields
  attribute: z.string().optional(),
  for: z
    .union([
      z.string(),
      z.object({
        hours: z.number().optional(),
        minutes: z.number().optional(),
        seconds: z.number().optional(),
      }),
    ])
    .optional(),
  // State condition
  entity_id: z.union([z.string(), z.array(z.string())]).optional(),
  state: z.union([z.string(), z.array(z.string())]).optional(),
  // Numeric state condition
  above: z.union([z.number(), z.string()]).optional(),
  below: z.union([z.number(), z.string()]).optional(),
  value_template: z.string().optional(),
  // Template condition
  template: z.string().optional(),
  // Time condition
  after: z.string().optional(),
  before: z.string().optional(),
  weekday: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
  // Sun condition
  after_offset: z.string().optional(),
  before_offset: z.string().optional(),
  // Zone condition
  zone: z.string().optional(),
  // Device condition
  device_id: z.string().optional(),
  domain: z.string().optional(),
  type: z.string().optional(),
  subtype: z.string().optional(),
});

/**
 * Nested condition data schema for and/or/not conditions
 * Limited to one level of nesting for simplicity
 */
const NestedConditionSchema = BaseConditionDataSchema;

/**
 * Data schema for condition nodes
 * Contains HA-specific condition configuration
 */
export const ConditionDataSchema = BaseConditionDataSchema.extend({
  // Nested conditions (for and/or/not) - limited to one level
  conditions: z.array(NestedConditionSchema).optional(),
});
export type ConditionData = z.infer<typeof ConditionDataSchema>;

export const ConditionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('condition'),
  position: PositionSchema,
  data: ConditionDataSchema,
});
export type ConditionNode = z.infer<typeof ConditionNodeSchema>;

// ============================================
// ACTION NODE
// ============================================

/**
 * Data schema for action nodes
 * Contains HA service call configuration
 */
export const ActionDataSchema = z.object({
  alias: z.string().optional(),
  service: z.string().min(1).optional(), // e.g., "light.turn_on"
  target: OptionalTargetSchema.optional(),
  data: ServiceDataSchema.optional(),
  data_template: ServiceDataTemplateSchema.optional(),
  // Response variable for service calls that return data
  response_variable: z.string().optional(),
  // Continue on error
  continue_on_error: z.boolean().optional(),
  // Enabled flag
  enabled: z.boolean().optional(),
  // Conditional actions (if/then/else)
  if: z.any().optional(),
  then: z.any().optional(),
  else: z.any().optional(),
});
export type ActionData = z.infer<typeof ActionDataSchema>;

export const ActionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('action'),
  position: PositionSchema,
  data: ActionDataSchema,
});
export type ActionNode = z.infer<typeof ActionNodeSchema>;

// ============================================
// DELAY NODE
// ============================================

/**
 * Data schema for delay nodes
 */
export const DelayDataSchema = z.object({
  alias: z.string().optional(),
  delay: z.union([
    z.string(), // Template or HH:MM:SS format
    z.object({
      hours: z.number().optional(),
      minutes: z.number().optional(),
      seconds: z.number().optional(),
      milliseconds: z.number().optional(),
    }),
  ]),
});
export type DelayData = z.infer<typeof DelayDataSchema>;

export const DelayNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('delay'),
  position: PositionSchema,
  data: DelayDataSchema,
});
export type DelayNode = z.infer<typeof DelayNodeSchema>;

// ============================================
// WAIT NODE
// ============================================

/**
 * Data schema for wait nodes (wait_template)
 */
export const WaitDataSchema = z.object({
  alias: z.string().optional(),
  wait_template: z.string().optional(),
  timeout: z.string().optional(),
  continue_on_timeout: z.boolean().optional(),
});
export type WaitData = z.infer<typeof WaitDataSchema>;

export const WaitNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('wait'),
  position: PositionSchema,
  data: WaitDataSchema,
});
export type WaitNode = z.infer<typeof WaitNodeSchema>;

// ============================================
// DISCRIMINATED UNION
// ============================================

/**
 * Discriminated union of all node types
 * The 'type' field determines which schema is used for validation
 */
export const NodeSchema = z.discriminatedUnion('type', [
  TriggerNodeSchema,
  ConditionNodeSchema,
  ActionNodeSchema,
  DelayNodeSchema,
  WaitNodeSchema,
]);
export type FlowNode = z.infer<typeof NodeSchema>;

/**
 * Type guard functions for narrowing node types
 */
export function isTriggerNode(node: FlowNode): node is TriggerNode {
  return node.type === 'trigger';
}

export function isConditionNode(node: FlowNode): node is ConditionNode {
  return node.type === 'condition';
}

export function isActionNode(node: FlowNode): node is ActionNode {
  return node.type === 'action';
}

export function isDelayNode(node: FlowNode): node is DelayNode {
  return node.type === 'delay';
}

export function isWaitNode(node: FlowNode): node is WaitNode {
  return node.type === 'wait';
}
