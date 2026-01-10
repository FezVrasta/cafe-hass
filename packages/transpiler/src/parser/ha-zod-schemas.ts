import { z } from 'zod';

// Basic reusable schemas
const entityIdSchema = z.union([z.string(), z.array(z.string())]);
const stringOrNumberSchema = z.union([z.string(), z.number()]);

/**
 * Metadata injected into the automation YAML to store flow layout and other info.
 */
export const FlowAutomatorMetadataSchema = z.object({
  version: z.number(),
  nodes: z.record(
    z.string(),
    z.object({
      x: z.number(),
      y: z.number(),
    })
  ),
  graph_id: z.string(),
  graph_version: z.number(),
  strategy: z.enum(['native', 'state-machine']),
});
export type FlowAutomatorMetadata = z.infer<typeof FlowAutomatorMetadataSchema>;

/**
 * Zod schema for a Home Assistant trigger.
 * Uses passthrough() to allow additional properties not explicitly defined.
 */
export const HaTriggerSchema = z
  .object({
    platform: z.string().optional(),
    id: z.string().optional(), // Used for trace debugging
    alias: z.string().optional(),
    entity_id: entityIdSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    for: z.unknown().optional(),
    at: z.union([z.string(), z.array(z.string())]).optional(),
    event_type: z.string().optional(),
    event_data: z.record(z.string(), z.unknown()).optional(),
    above: stringOrNumberSchema.optional(),
    below: stringOrNumberSchema.optional(),
    value_template: z.string().optional(),
    template: z.string().optional(),
    webhook_id: z.string().optional(),
    zone: entityIdSchema.optional(),
    topic: z.string().optional(),
    payload: z.string().optional(),
    // Device trigger fields
    device_id: z.string().optional(),
    domain: z.string().optional(),
    type: z.string().optional(),
    subtype: z.string().optional(),
  })
  .passthrough();
export type HaTrigger = z.infer<typeof HaTriggerSchema>;

//
// Schemas with circular references
// We define interfaces first to break the circular dependency for TypeScript
//

export interface HaCondition {
  condition?: string;
  id?: string;
  alias?: string;
  entity_id?: string | string[];
  state?: string | string[];
  template?: string;
  value_template?: string;
  after?: string;
  before?: string;
  weekday?: string | string[];
  after_offset?: string;
  before_offset?: string;
  zone?: string;
  above?: string | number;
  below?: string | number;
  attribute?: string;
  conditions?: HaCondition[];
  // Allow additional properties
  [key: string]: unknown;
}

export const HaConditionSchema: z.ZodType<HaCondition> = z.lazy(() =>
  z
    .object({
      condition: z.string().optional(),
      id: z.string().optional(),
      alias: z.string().optional(),
      entity_id: entityIdSchema.optional(),
      state: z.union([z.string(), z.array(z.string())]).optional(),
      template: z.string().optional(),
      value_template: z.string().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      weekday: z.union([z.string(), z.array(z.string())]).optional(),
      after_offset: z.string().optional(),
      before_offset: z.string().optional(),
      zone: z.string().optional(),
      above: stringOrNumberSchema.optional(),
      below: stringOrNumberSchema.optional(),
      attribute: z.string().optional(),
      conditions: z.array(HaConditionSchema).optional(),
    })
    .passthrough()
);

export interface HaAction {
  service?: string;
  action?: string;
  id?: string;
  alias?: string;
  target?: Record<string, unknown>;
  data?: Record<string, unknown>;
  data_template?: Record<string, unknown>;
  response_variable?: string;
  continue_on_error?: boolean;
  enabled?: boolean;
  delay?: unknown;
  wait_template?: unknown;
  timeout?: unknown;
  continue_on_timeout?: boolean;
  wait_for_trigger?: HaTrigger | HaTrigger[];
  choose?: HaChooseOption | HaChooseOption[];
  default?: HaAction[];
  if?: HaCondition[];
  then?: HaAction[];
  else?: HaAction[];
  variables?: Record<string, unknown>;
  repeat?: {
    count?: string | number;
    while?: HaCondition[];
    until?: string | string[] | HaCondition[];
    sequence: HaAction[];
  };
  // Allow additional properties
  [key: string]: unknown;
}

export interface HaChooseOption {
  conditions: HaCondition | HaCondition[];
  sequence: HaAction | HaAction[];
  alias?: string;
}

export const HaChooseOptionSchema: z.ZodType<HaChooseOption> = z.lazy(() =>
  z.object({
    conditions: z.union([HaConditionSchema, z.array(HaConditionSchema)]),
    sequence: z.union([HaActionSchema, z.array(HaActionSchema)]),
    alias: z.string().optional(),
  })
);

export const HaActionSchema: z.ZodType<HaAction> = z.lazy(() =>
  z
    .object({
      service: z.string().optional(),
      action: z.string().optional(),
      id: z.string().optional(),
      alias: z.string().optional(),
      target: z.record(z.string(), z.unknown()).optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      data_template: z.record(z.string(), z.unknown()).optional(),
      response_variable: z.string().optional(),
      continue_on_error: z.boolean().optional(),
      enabled: z.boolean().optional(),
      delay: z.union([z.string(), z.number(), z.record(z.string(), z.number())]).optional(),
      wait_template: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
      timeout: z.union([z.string(), z.number(), z.record(z.string(), z.number())]).optional(),
      continue_on_timeout: z.boolean().optional(),
      wait_for_trigger: z.union([HaTriggerSchema, z.array(HaTriggerSchema)]).optional(),
      choose: z.union([HaChooseOptionSchema, z.array(HaChooseOptionSchema)]).optional(),
      default: z.array(HaActionSchema).optional(),
      if: z.array(HaConditionSchema).optional(),
      then: z.array(HaActionSchema).optional(),
      else: z.array(HaActionSchema).optional(),
      variables: z.record(z.string(), z.unknown()).optional(),
      repeat: z
        .object({
          count: z.union([z.string(), z.number()]).optional(),
          while: z.array(HaConditionSchema).optional(),
          until: z.union([z.string(), z.array(z.string()), z.array(HaConditionSchema)]).optional(),
          sequence: z.array(HaActionSchema),
        })
        .optional(),
    })
    .passthrough()
);

/**
 * Zod schema for a full Home Assistant automation.
 */
export const HaAutomationSchema = z.object({
  id: z.string().optional(), // Automation ID
  alias: z.string().optional(),
  description: z.string().optional(),
  trigger_variables: z.record(z.string(), z.unknown()).optional(),
  trigger: z.union([HaTriggerSchema, z.array(HaTriggerSchema)]).optional(),
  condition: z.union([HaConditionSchema, z.array(HaConditionSchema)]).optional(),
  action: z.union([HaActionSchema, z.array(HaActionSchema)]),
  mode: z.enum(['single', 'restart', 'queued', 'parallel']).optional().default('single'),
  max: z.number().optional(),
  max_exceeded: z.enum(['silent', 'warning']).optional(),
  initial_state: z.boolean().optional(),
  hide_entity: z.boolean().optional(),
  trace: z.record(z.string(), z.unknown()).optional(),
  variables: z
    .object({
      _cafe_metadata: FlowAutomatorMetadataSchema.optional(),
    })
    .catchall(z.unknown())
    .optional(),
});
export type HaAutomation = z.infer<typeof HaAutomationSchema>;

/**
 * Zod schema for a Home Assistant script.
 * Scripts have `sequence` instead of `action`.
 */
export const HaScriptSchema = HaAutomationSchema.omit({ action: true }).extend({
  action: z.union([HaActionSchema, z.array(HaActionSchema)]).optional(),
  sequence: z.union([HaActionSchema, z.array(HaActionSchema)]),
});
export type HaScript = z.infer<typeof HaScriptSchema>;

/**
 * Type guard for our metadata.
 */
export const isFlowAutomatorMetadata = (obj: unknown): obj is FlowAutomatorMetadata => {
  return FlowAutomatorMetadataSchema.safeParse(obj).success;
};
