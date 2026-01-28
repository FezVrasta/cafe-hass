import { z } from 'zod';

/**
 * List of valid Home Assistant weekday strings.
 * Used for time-based conditions and triggers.
 */
export const VALID_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof VALID_WEEKDAYS)[number];

/**
 * Zod schema for Home Assistant condition objects.
 * Supports recursive conditions for and/or/not groups.
 */
export const HAConditionSchema: z.ZodType<
  {
    [x: string]: unknown;
    condition?: string;
    alias?: string;
    enabled?: boolean;
    entity_id?: string | string[];
    state?: string | string[];
    value_template?: string;
    after?: string;
    before?: string;
    weekday?: Weekday[];
    after_offset?: string;
    before_offset?: string;
    zone?: string;
    conditions?: z.infer<typeof HAConditionSchema>[];
    above?: string | number;
    below?: string | number;
    attribute?: string;
    id?: string | string[];
  },
  Record<string, unknown>
> = z.looseObject({
  alias: z.string().optional(),
  condition: z.string().optional(),
  enabled: z.boolean().optional(),
  entity_id: z.union([z.string(), z.array(z.string())]).optional(),
  state: z.union([z.string(), z.array(z.string())]).optional(),
  value_template: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  weekday: z.array(z.enum(VALID_WEEKDAYS)).optional(),
  after_offset: z.string().optional(),
  before_offset: z.string().optional(),
  zone: z.string().optional(),
  conditions: z.array(z.lazy(() => HAConditionSchema)).optional(),
  above: z.union([z.string(), z.number()]).optional(),
  below: z.union([z.string(), z.number()]).optional(),
  attribute: z.string().optional(),
  // Support both string and array for trigger conditions
  id: z.union([z.string(), z.array(z.string())]).optional(),
});

export type HACondition = z.infer<typeof HAConditionSchema>;

/**
 * Enum of valid Home Assistant trigger platforms.
 */
export const HAPlatformEnum = z.enum([
  'event',
  'template',
  'zone',
  'state',
  'time',
  'time_pattern',
  'mqtt',
  'webhook',
  'sun',
  'numeric_state',
  'homeassistant',
  'device',
]);
export type HAPlatform = z.infer<typeof HAPlatformEnum>;

/**
 * Zod schema for Home Assistant trigger objects.
 * Normalizes both legacy 'platform' and modern 'trigger' fields to a single 'trigger' property.
 * Supports both legacy format (platform: state) and modern format (trigger: state).
 */
export const HATriggerSchema = z
  .looseObject({
    alias: z.string().optional(),
    platform: z.string().optional(),
    trigger: z.string().optional(),
    target: z.looseObject({ entity_id: z.union([z.string(), z.array(z.string())]) }).optional(),
    options: z.looseObject({}).optional(),
    entity_id: z.union([z.string(), z.array(z.string())]).optional(),
    // Home Assistant supports both string, array, and null for from/to fields
    from: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
    to: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
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
    at: z.union([z.string(), z.array(z.string())]).optional(),
    event_type: z.string().optional(),
    event_data: z.record(z.string(), z.unknown()).optional(),
    above: z.union([z.string(), z.number()]).optional(),
    below: z.union([z.string(), z.number()]).optional(),
    value_template: z.string().optional(),
    template: z.string().optional(),
    webhook_id: z.string().optional(),
    zone: z.string().optional(),
    topic: z.string().optional(),
    payload: z.string().optional(),
    // Conversation trigger fields
    command: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .transform((input) => {
    // Normalize to modern 'trigger' property (HA 2024.1+)
    const trigger = input.trigger ?? input.platform ?? 'state';
    // Remove the legacy 'platform' key
    const { platform: _platform, ...rest } = input;
    return {
      ...rest,
      trigger,
    };
  });

export type HATrigger = z.infer<typeof HATriggerSchema>;

/**
 * Home Assistant Trigger interface (for type annotations without schema parsing)
 */
export interface HATriggerInput {
  alias?: string;
  platform?: string;
  trigger?: string;
  target?: { entity_id?: string | string[] };
  options?: Record<string, unknown>;
  entity_id?: string | string[];
  from?: string | string[] | null;
  to?: string | string[] | null;
  for?: string | { hours?: number; minutes?: number; seconds?: number };
  at?: string | string[];
  event_type?: string;
  event_data?: Record<string, unknown>;
  above?: string | number;
  below?: string | number;
  value_template?: string;
  template?: string;
  webhook_id?: string;
  zone?: string;
  topic?: string;
  payload?: string;
  command?: string | string[];
}

/**
 * Home Assistant Action interface (for type annotations)
 */
export interface HAAction {
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
  delay?: string | number | { hours?: number; minutes?: number; seconds?: number };
  wait_template?: string | Record<string, unknown>;
  timeout?: string | number | Record<string, number>;
  continue_on_timeout?: boolean;
  wait_for_trigger?: HATrigger | HATrigger[];
  choose?: HAChooseOption | HAChooseOption[];
  default?: HAAction[];
  if?: HACondition[];
  then?: HAAction[];
  else?: HAAction[];
  variables?: Record<string, unknown>;
  repeat?: {
    count?: string | number;
    while?: HACondition[];
    until?: string | string[] | HACondition[];
    sequence: HAAction[];
  };
  [key: string]: unknown;
}

// Forward declaration for HAChooseOption (defined below)
export interface HAChooseOption {
  conditions: HACondition | HACondition[];
  sequence: HAAction | HAAction[];
  alias?: string;
}

/**
 * Zod schema for FlowGraph metadata block (automation-level settings)
 */
export const FlowGraphMetadataSchema = z.object({
  mode: z.enum(['single', 'restart', 'queued', 'parallel']).default('single'),
  max: z.number().optional(),
  max_exceeded: z.enum(['silent', 'warning', 'critical']).optional(),
  initial_state: z.boolean().default(false),
  hide_entity: z.boolean().optional(),
  trace: z.object({ stored_traces: z.number().optional() }).optional(),
});

export type FlowGraphMetadata = z.infer<typeof FlowGraphMetadataSchema>;

/**
 * Type guard for Home Assistant trigger objects.
 * Returns true if the object matches the HATrigger shape.
 */
export function isHATrigger(obj: unknown): obj is HATriggerInput {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('platform' in obj || 'trigger' in obj || 'entity_id' in obj)
  );
}

/**
 * Type guard for Home Assistant condition objects.
 * Returns true if the object matches the HACondition shape.
 */
export function isHACondition(obj: unknown): obj is HACondition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('condition' in obj || 'entity_id' in obj || 'state' in obj)
  );
}

/**
 * Type guard for Home Assistant device actions.
 * Returns true if the object has type, device_id, and domain fields.
 */
export function isDeviceAction(obj: unknown): obj is Record<string, unknown> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'device_id' in obj &&
    'domain' in obj
  );
}

/**
 * C.A.F.E. metadata stored in automation YAML to preserve flow layout.
 */
export const CafeMetadataSchema = z.object({
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
export type CafeMetadata = z.infer<typeof CafeMetadataSchema>;

/**
 * Type guard for C.A.F.E. metadata.
 */
export function isCafeMetadata(obj: unknown): obj is CafeMetadata {
  return CafeMetadataSchema.safeParse(obj).success;
}

/**
 * Zod schema for choose option in HA actions.
 */
export const HAChooseOptionSchema: z.ZodType<HAChooseOption> = z.lazy(() =>
  z.object({
    conditions: z.union([HAConditionSchema, z.array(HAConditionSchema)]),
    sequence: z.union([HAActionSchema, z.array(HAActionSchema)]),
    alias: z.string().optional(),
  })
);

/**
 * Zod schema for Home Assistant action objects.
 */
export const HAActionSchema: z.ZodType<HAAction> = z.lazy(() =>
  z.looseObject({
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
    wait_for_trigger: z.union([HATriggerSchema, z.array(HATriggerSchema)]).optional(),
    choose: z.union([HAChooseOptionSchema, z.array(HAChooseOptionSchema)]).optional(),
    default: z.array(HAActionSchema).optional(),
    if: z.array(HAConditionSchema).optional(),
    then: z.array(HAActionSchema).optional(),
    else: z.array(HAActionSchema).optional(),
    variables: z.record(z.string(), z.unknown()).optional(),
    repeat: z
      .object({
        count: z.union([z.string(), z.number()]).optional(),
        while: z.array(HAConditionSchema).optional(),
        until: z.union([z.string(), z.array(z.string()), z.array(HAConditionSchema)]).optional(),
        sequence: z.array(HAActionSchema),
      })
      .optional(),
  })
);

/**
 * Zod schema for a full Home Assistant automation.
 */
export const HAAutomationSchema = z.object({
  id: z.string().optional(),
  alias: z.string().optional(),
  description: z.string().optional(),
  trigger_variables: z.record(z.string(), z.unknown()).optional(),
  trigger: z.union([HATriggerSchema, z.array(HATriggerSchema)]).optional(),
  condition: z.union([HAConditionSchema, z.array(HAConditionSchema)]).optional(),
  action: z.union([HAActionSchema, z.array(HAActionSchema)]),
  mode: z.enum(['single', 'restart', 'queued', 'parallel']).optional().default('single'),
  max: z.number().optional(),
  max_exceeded: z.enum(['silent', 'warning']).optional(),
  initial_state: z.boolean().optional(),
  hide_entity: z.boolean().optional(),
  trace: z.record(z.string(), z.unknown()).optional(),
  variables: z
    .object({
      _cafe_metadata: CafeMetadataSchema.optional(),
    })
    .catchall(z.unknown())
    .optional(),
});
export type HAAutomation = z.infer<typeof HAAutomationSchema>;

/**
 * Zod schema for a Home Assistant script.
 */
export const HAScriptSchema = HAAutomationSchema.omit({ action: true }).extend({
  action: z.union([HAActionSchema, z.array(HAActionSchema)]).optional(),
  sequence: z.union([HAActionSchema, z.array(HAActionSchema)]),
});
export type HAScript = z.infer<typeof HAScriptSchema>;

/**
 * Zod schema for Home Assistant delay action.
 */
export const HADelaySchema = z.looseObject({
  id: z.string().optional(),
  alias: z.string().optional(),
  delay: z.union([
    z.string(),
    z.looseObject({
      hours: z.number().optional(),
      minutes: z.number().optional(),
      seconds: z.number().optional(),
      milliseconds: z.number().optional(),
    }),
  ]),
});
export type HADelay = z.infer<typeof HADelaySchema>;

/**
 * Zod schema for Home Assistant wait action (wait_template or wait_for_trigger).
 */
export const HAWaitSchema = z
  .looseObject({
    id: z.string().optional(),
    alias: z.string().optional(),
    wait_template: z.string().optional(),
    wait_for_trigger: z.array(HATriggerSchema).optional(),
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
export type HAWait = z.infer<typeof HAWaitSchema>;

/**
 * Zod schema for Home Assistant variables action.
 */
export const HAVariablesSchema = z.looseObject({
  id: z.string().optional(),
  alias: z.string().optional(),
  variables: z.record(z.string(), z.unknown()),
});
export type HAVariables = z.infer<typeof HAVariablesSchema>;
