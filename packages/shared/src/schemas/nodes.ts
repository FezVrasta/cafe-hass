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
export const TriggerDataSchema = z.looseObject({
  id: z.string().optional(), // User-defined ID for referencing in templates
  alias: z.string().optional(),
  platform: TriggerPlatformSchema,
  // State trigger
  entity_id: z.union([z.string(), z.array(z.string())]).optional(),
  // Home Assistant supports both string and array for from/to fields
  from: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  to: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  for: z
    .union([
      z.string(),
      z.looseObject({
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
  event_data: z.record(z.string(), z.unknown()).optional(),
  // Event field used by multiple trigger types:
  // - homeassistant trigger: start, shutdown
  // - sun trigger: sunrise, sunset
  // - zone trigger: enter, leave
  event: z.enum(['start', 'shutdown', 'sunrise', 'sunset', 'enter', 'leave']).optional(),
  offset: z.union([z.number(), z.string()]).optional(),
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
});
export type TriggerData = z.infer<typeof TriggerDataSchema>;

export const TriggerNodeSchema = z.looseObject({
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
const BaseConditionDataSchema = z.looseObject({
  alias: z.string().optional(),
  condition_type: ConditionTypeSchema,
  // Enabled flag (disabled conditions still exist but are skipped)
  enabled: z.boolean().optional(),
  // Common fields
  attribute: z.string().optional(),
  for: z
    .union([
      z.string(),
      z.looseObject({
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
  // Trigger condition
  id: z.union([z.string(), z.array(z.string())]).optional(),
});

/**
 * Nested condition data schema for and/or/not conditions
 * Supports recursive nesting for complex conditions
 */
export type NestedCondition = z.infer<typeof BaseConditionDataSchema> & {
  conditions?: NestedCondition[];
};

const NestedConditionSchema: z.ZodType<NestedCondition> = BaseConditionDataSchema.extend({
  conditions: z.lazy(() => z.array(NestedConditionSchema)).optional(),
});

/**
 * Data schema for condition nodes
 * Contains HA-specific condition configuration
 */
export const ConditionDataSchema = BaseConditionDataSchema.extend({
  // Nested conditions (for and/or/not) - limited to one level
  conditions: z.array(NestedConditionSchema).optional(),
});
export type ConditionData = z.infer<typeof ConditionDataSchema>;

export const ConditionNodeSchema = z.looseObject({
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
 * Variables block schema for state-machine pattern
 */
export const VariablesSchema = z.record(z.string(), z.unknown());
export type Variables = z.infer<typeof VariablesSchema>;

/**
 * Choose block schema for Home Assistant actions
 */
export const ChooseBlockSchema = z.looseObject({
  conditions: z.array(BaseConditionDataSchema),
  sequence: z.array(z.any()), // Accepts array of actions (will be validated as nodes)
  alias: z.string().optional(),
});
export type ChooseBlock = z.infer<typeof ChooseBlockSchema>;

/**
 * Repeat block schema for Home Assistant actions
 */
export const RepeatBlockSchema = z.looseObject({
  sequence: z.array(z.any()), // Accepts array of actions (will be validated as nodes)
  until: z.string().optional(), // Template string for until condition
  count: z.number().optional(),
  alias: z.string().optional(),
});
export type RepeatBlock = z.infer<typeof RepeatBlockSchema>;

/**
 * Data schema for action nodes
 * Contains HA service call configuration and extended blocks
 */
export const ActionDataSchema = z.looseObject({
  id: z.string().optional(), // User-defined ID for referencing in templates
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
  // Flag to indicate this is a device action (for proper round-trip)
  isDeviceAction: z.boolean().optional(),
  // Conditional actions (if/then/else)
  if: z.array(BaseConditionDataSchema).optional(),
  then: z.array(z.any()).optional(),
  else: z.array(z.any()).optional(),
  // State machine/advanced blocks
  repeat: RepeatBlockSchema.optional(),
  choose: z.array(ChooseBlockSchema).optional(),
  variables: VariablesSchema.optional(),
});
export type ActionData = z.infer<typeof ActionDataSchema>;

export const ActionNodeSchema = z.looseObject({
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
export const DelayDataSchema = z.looseObject({
  id: z.string().optional(), // User-defined ID for referencing in templates
  alias: z.string().optional(),
  delay: z.union([
    z.string(), // Template or HH:MM:SS format
    z.looseObject({
      hours: z.number().optional(),
      minutes: z.number().optional(),
      seconds: z.number().optional(),
      milliseconds: z.number().optional(),
    }),
  ]),
});
export type DelayData = z.infer<typeof DelayDataSchema>;

export const DelayNodeSchema = z.looseObject({
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
 * Data schema for wait nodes (wait_template or wait_for_trigger)
 */
export const WaitDataSchema = z
  .looseObject({
    id: z.string().optional(), // User-defined ID for referencing in templates
    alias: z.string().optional(),
    wait_template: z.string().optional(),
    wait_for_trigger: z.array(TriggerDataSchema).optional(),
    // Home Assistant supports both string and object timeout formats
    timeout: z
      .union([
        z.string(),
        z.looseObject({
          hours: z.number().optional(),
          minutes: z.number().optional(),
          seconds: z.number().optional(),
          milliseconds: z.number().optional(),
        }),
      ])
      .optional(),
    continue_on_timeout: z.boolean().optional(),
  })
  .refine(
    (data) => {
      return data.wait_template === undefined || data.wait_for_trigger === undefined;
    },
    {
      message: 'Provide either `wait_template` or `wait_for_trigger`, but not both.',
      path: ['wait_template'],
    }
  );
export type WaitData = z.infer<typeof WaitDataSchema>;

export const WaitNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('wait'),
  position: PositionSchema,
  data: WaitDataSchema,
});
export type WaitNode = z.infer<typeof WaitNodeSchema>;

// ============================================
// SET VARIABLES NODE
// ============================================

/**
 * Data schema for set variables nodes
 * Allows setting one or more variables in the automation
 */
export const SetVariablesDataSchema = z.looseObject({
  id: z.string().optional(), // User-defined ID for referencing in templates
  alias: z.string().optional(),
  variables: z.record(z.string(), z.unknown()),
});
export type SetVariablesData = z.infer<typeof SetVariablesDataSchema>;

export const SetVariablesNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('set_variables'),
  position: PositionSchema,
  data: SetVariablesDataSchema,
});
export type SetVariablesNode = z.infer<typeof SetVariablesNodeSchema>;

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
  SetVariablesNodeSchema,
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

export function isSetVariablesNode(node: FlowNode): node is SetVariablesNode {
  return node.type === 'set_variables';
}
