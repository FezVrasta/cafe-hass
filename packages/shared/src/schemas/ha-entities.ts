import { z } from 'zod';
import { EntityIdSchema } from './base';

/**
 * Trigger platform types supported by Home Assistant
 */
export const TriggerPlatformSchema = z.enum([
  'state',
  'time',
  'time_pattern',
  'event',
  'mqtt',
  'webhook',
  'sun',
  'zone',
  'numeric_state',
  'template',
  'homeassistant',
  'device',
]);
export type TriggerPlatform = z.infer<typeof TriggerPlatformSchema>;

/**
 * Condition types supported by Home Assistant
 */
export const ConditionTypeSchema = z.enum([
  'state',
  'numeric_state',
  'template',
  'time',
  'zone',
  'and',
  'or',
  'not',
  'sun',
  'device',
]);
export type ConditionType = z.infer<typeof ConditionTypeSchema>;

/**
 * Target specification for service calls
 */
export const TargetSchema = z.object({
  entity_id: z.union([EntityIdSchema, z.array(EntityIdSchema)]).optional(),
  area_id: z.union([z.string(), z.array(z.string())]).optional(),
  device_id: z.union([z.string(), z.array(z.string())]).optional(),
}).refine(
  (data) => data.entity_id || data.area_id || data.device_id,
  { message: 'At least one target (entity_id, area_id, or device_id) must be specified' }
);
export type Target = z.infer<typeof TargetSchema>;

/**
 * Optional target (for service calls that don't require a target)
 */
export const OptionalTargetSchema = z.object({
  entity_id: z.union([z.string(), z.array(z.string())]).optional(),
  area_id: z.union([z.string(), z.array(z.string())]).optional(),
  device_id: z.union([z.string(), z.array(z.string())]).optional(),
}).optional();

/**
 * Service call data - arbitrary key-value pairs
 */
export const ServiceDataSchema = z.record(z.unknown());
export type ServiceData = z.infer<typeof ServiceDataSchema>;

/**
 * Service call data template - Jinja2 templates as values
 */
export const ServiceDataTemplateSchema = z.record(z.string());
export type ServiceDataTemplate = z.infer<typeof ServiceDataTemplateSchema>;
