import type { ConditionType } from '@cafe/shared';
import type { FieldConfig } from './triggerFields';

/**
 * Static field configurations for condition types.
 * Mirrors the structure of triggerFields.ts for consistency.
 * Device conditions use dynamic fields from the API.
 */
export const CONDITION_TYPE_FIELDS: Record<ConditionType, FieldConfig[]> = {
  // State condition: checks if entity is in a specific state
  state: [
    {
      name: 'entity_id',
      label: 'Entity',
      type: 'entity',
      required: true,
      description: 'The entity to check',
    },
    {
      name: 'state',
      label: 'State',
      type: 'text',
      required: true,
      placeholder: 'e.g., on, off, home',
      description: 'The state value to check for',
    },
    {
      name: 'attribute',
      label: 'Attribute (optional)',
      type: 'text',
      required: false,
      placeholder: 'e.g., brightness, temperature',
      description: 'Check a specific attribute instead of the state',
    },
    {
      name: 'for',
      label: 'For Duration (optional)',
      type: 'duration',
      required: false,
      placeholder: '00:05:00',
      description: 'How long the condition must be true',
    },
  ],

  // Numeric state condition: checks if entity value is within range
  numeric_state: [
    {
      name: 'entity_id',
      label: 'Entity',
      type: 'entity',
      required: true,
      description: 'The sensor entity to check',
    },
    {
      name: 'above',
      label: 'Above (optional)',
      type: 'number',
      required: false,
      placeholder: 'Minimum value',
      description: 'Condition is true when value > this',
    },
    {
      name: 'below',
      label: 'Below (optional)',
      type: 'number',
      required: false,
      placeholder: 'Maximum value',
      description: 'Condition is true when value < this',
    },
    {
      name: 'attribute',
      label: 'Attribute (optional)',
      type: 'text',
      required: false,
      placeholder: 'e.g., brightness, temperature',
      description: 'Check a specific attribute instead of the state',
    },
    {
      name: 'for',
      label: 'For Duration (optional)',
      type: 'duration',
      required: false,
      placeholder: '00:05:00',
      description: 'How long the condition must be true',
    },
  ],

  // Template condition: evaluates a Jinja2 template
  template: [
    {
      name: 'value_template',
      label: 'Value Template',
      type: 'template',
      required: true,
      placeholder: '{{ states("sensor.temperature") | float > 20 }}',
      description: 'Template that should evaluate to true/false',
    },
  ],

  // Time condition: checks if current time is within a window
  time: [
    {
      name: 'after',
      label: 'After (optional)',
      type: 'time',
      required: false,
      description: 'Condition is true after this time',
    },
    {
      name: 'before',
      label: 'Before (optional)',
      type: 'time',
      required: false,
      description: 'Condition is true before this time',
    },
    {
      name: 'weekday',
      label: 'Weekday (optional)',
      type: 'select',
      required: false,
      multiple: true,
      description: 'Days of the week when condition is true',
      options: [
        { value: 'mon', label: 'Monday' },
        { value: 'tue', label: 'Tuesday' },
        { value: 'wed', label: 'Wednesday' },
        { value: 'thu', label: 'Thursday' },
        { value: 'fri', label: 'Friday' },
        { value: 'sat', label: 'Saturday' },
        { value: 'sun', label: 'Sunday' },
      ],
    },
  ],

  // Sun condition: checks sun position (above/below horizon)
  sun: [
    {
      name: 'after',
      label: 'After',
      type: 'select',
      required: false,
      description: 'Condition is true after this sun event',
      options: [
        { value: 'sunrise', label: 'Sunrise' },
        { value: 'sunset', label: 'Sunset' },
      ],
    },
    {
      name: 'after_offset',
      label: 'After Offset (optional)',
      type: 'text',
      required: false,
      placeholder: 'e.g., -00:30:00',
      description: 'Time offset for the after event',
    },
    {
      name: 'before',
      label: 'Before',
      type: 'select',
      required: false,
      description: 'Condition is true before this sun event',
      options: [
        { value: 'sunrise', label: 'Sunrise' },
        { value: 'sunset', label: 'Sunset' },
      ],
    },
    {
      name: 'before_offset',
      label: 'Before Offset (optional)',
      type: 'text',
      required: false,
      placeholder: 'e.g., +01:00:00',
      description: 'Time offset for the before event',
    },
  ],

  // Zone condition: checks if entity is in a zone
  zone: [
    {
      name: 'entity_id',
      label: 'Entity',
      type: 'entity',
      required: true,
      description: 'Person or device tracker to monitor',
    },
    {
      name: 'zone',
      label: 'Zone',
      type: 'text',
      required: true,
      placeholder: 'zone.home',
      description: 'Zone entity to check for presence',
    },
    {
      name: 'for',
      label: 'For Duration (optional)',
      type: 'duration',
      required: false,
      placeholder: '00:05:00',
      description: 'How long the entity must be in the zone',
    },
  ],

  // Trigger condition: checks which trigger fired
  trigger: [
    {
      name: 'id',
      label: 'Trigger ID(s)',
      type: 'text',
      required: true,
      multiple: true,
      placeholder: 'e.g., arriving, leaving',
      description: 'The ID(s) of the trigger(s) to match',
    },
  ],

  // Device condition: uses dynamic fields from API
  device: [],

  // Logical group types: handled by ConditionGroupEditor
  and: [],
  or: [],
  not: [],
};

/**
 * Get field configuration for a condition type
 */
export function getConditionFields(conditionType: ConditionType): FieldConfig[] {
  return CONDITION_TYPE_FIELDS[conditionType] || [];
}

/**
 * Get default values for a condition type based on field configurations
 */
export function getConditionDefaults(conditionType: ConditionType): Record<string, unknown> {
  const fields = getConditionFields(conditionType);
  const defaults: Record<string, unknown> = { condition: conditionType };

  for (const field of fields) {
    if (field.default !== undefined) {
      defaults[field.name] = field.default;
    }
  }

  // Logical group types need an empty conditions array
  if (isLogicalGroupType(conditionType)) {
    defaults.conditions = [];
  }

  return defaults;
}

/**
 * Check if a condition type uses device automation API
 */
export function usesDeviceAutomationForCondition(conditionType: ConditionType): boolean {
  return conditionType === 'device';
}

/**
 * Check if a condition type is a logical group type
 */
export function isLogicalGroupType(conditionType: ConditionType): boolean {
  return conditionType === 'and' || conditionType === 'or' || conditionType === 'not';
}
