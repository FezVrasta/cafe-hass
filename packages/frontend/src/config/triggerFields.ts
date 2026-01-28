import type { TriggerPlatform } from '@cafe/shared';
import type { SelectorType } from '@/hooks/useDeviceAutomation';

/**
 * Configuration for a trigger field
 */
export interface FieldConfig {
  name: string;
  label: string;
  type: SelectorType;
  required: boolean;
  multiple?: boolean;
  placeholder?: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
}

/**
 * Static field configurations for non-device trigger platforms
 * Device triggers use dynamic fields from the API
 */
export const TRIGGER_PLATFORM_FIELDS: Record<TriggerPlatform, FieldConfig[]> = {
  // State trigger: fires when entity changes state
  state: [
    {
      name: 'entity_id',
      label: 'Entity',
      type: 'entity',
      required: true,
      multiple: true,
      description: 'The entity to monitor for state changes',
    },
    {
      name: 'to',
      label: 'To State',
      type: 'text',
      required: false,
      placeholder: 'e.g., on, off, home',
      description: 'The target state to trigger on',
    },
    {
      name: 'from',
      label: 'From State (optional)',
      type: 'text',
      required: false,
      placeholder: 'e.g., off',
      description: 'Only trigger when transitioning from this state',
    },
    {
      name: 'for',
      label: 'For Duration (optional)',
      type: 'duration',
      required: false,
      placeholder: 'e.g., 00:05:00',
      description: 'State must be stable for this duration',
    },
  ],

  // Numeric state trigger: fires when entity numeric value crosses threshold
  numeric_state: [
    {
      name: 'entity_id',
      label: 'Entity',
      type: 'entity',
      required: true,
      multiple: true,
      description: 'The sensor entity to monitor',
    },
    {
      name: 'above',
      label: 'Above',
      type: 'number',
      required: false,
      placeholder: 'e.g., 20',
      description: 'Trigger when value goes above this threshold',
    },
    {
      name: 'below',
      label: 'Below',
      type: 'number',
      required: false,
      placeholder: 'e.g., 30',
      description: 'Trigger when value goes below this threshold',
    },
    {
      name: 'value_template',
      label: 'Value Template (optional)',
      type: 'template',
      required: false,
      placeholder: 'e.g., {{ state.attributes.temperature }}',
      description: 'Template to extract numeric value from entity',
    },
    {
      name: 'for',
      label: 'For Duration (optional)',
      type: 'duration',
      required: false,
      placeholder: 'e.g., 00:05:00',
      description: 'Value must be stable for this duration',
    },
  ],

  // Time trigger: fires at specific time
  time: [
    {
      name: 'at',
      label: 'At (time)',
      type: 'text',
      required: true,
      placeholder: 'e.g., 07:00:00 or input_datetime.wake_up',
      description: 'Time to trigger (HH:MM:SS or entity reference)',
    },
  ],

  // Time pattern trigger: fires at regular intervals
  time_pattern: [
    {
      name: 'hours',
      label: 'Hours',
      type: 'text',
      required: false,
      placeholder: 'e.g., */2 (every 2 hours)',
      description: 'Hour pattern (cron-style)',
    },
    {
      name: 'minutes',
      label: 'Minutes',
      type: 'text',
      required: false,
      placeholder: 'e.g., /5 (every 5 minutes)',
      description: 'Minute pattern (cron-style)',
    },
    {
      name: 'seconds',
      label: 'Seconds',
      type: 'text',
      required: false,
      placeholder: 'e.g., 0',
      description: 'Second pattern (cron-style)',
    },
  ],

  // Event trigger: fires when specific event occurs
  event: [
    {
      name: 'event_type',
      label: 'Event Type',
      type: 'text',
      required: true,
      placeholder: 'e.g., zha_event, call_service',
      description: 'The type of event to listen for',
    },
    {
      name: 'event_data',
      label: 'Event Data (optional)',
      type: 'object',
      required: false,
      description: 'Filter events by data fields (JSON object)',
    },
  ],

  // MQTT trigger: fires when MQTT message received
  mqtt: [
    {
      name: 'topic',
      label: 'Topic',
      type: 'text',
      required: true,
      placeholder: 'e.g., home/bedroom/temperature',
      description: 'MQTT topic to subscribe to',
    },
    {
      name: 'payload',
      label: 'Payload (optional)',
      type: 'text',
      required: false,
      placeholder: 'e.g., ON',
      description: 'Only trigger on this specific payload',
    },
  ],

  // Webhook trigger: fires when webhook is called
  webhook: [
    {
      name: 'webhook_id',
      label: 'Webhook ID',
      type: 'text',
      required: true,
      placeholder: 'e.g., my_webhook',
      description: 'Unique identifier for this webhook',
    },
  ],

  // Sun trigger: fires at sunrise/sunset
  sun: [
    {
      name: 'event',
      label: 'Event',
      type: 'select',
      required: true,
      description: 'Trigger at sunrise or sunset',
      options: [
        { value: 'sunrise', label: 'Sunrise' },
        { value: 'sunset', label: 'Sunset' },
      ],
      default: 'sunset',
    },
    {
      name: 'offset',
      label: 'Offset (optional)',
      type: 'text',
      required: false,
      placeholder: 'e.g., -00:30:00',
      description: 'Time offset before (-) or after (+) the event',
    },
  ],

  // Zone trigger: fires when device enters/leaves zone
  zone: [
    {
      name: 'entity_id',
      label: 'Person/Device',
      type: 'entity',
      required: true,
      multiple: true,
      description: 'The person or device tracker to monitor',
    },
    {
      name: 'zone',
      label: 'Zone',
      type: 'text',
      required: true,
      placeholder: 'e.g., zone.home',
      description: 'The zone entity to monitor',
    },
    {
      name: 'event',
      label: 'Event',
      type: 'select',
      required: true,
      description: 'Trigger on enter or leave',
      options: [
        { value: 'enter', label: 'Enter' },
        { value: 'leave', label: 'Leave' },
      ],
      default: 'enter',
    },
  ],

  // Template trigger: fires when template evaluates to true
  template: [
    {
      name: 'value_template',
      label: 'Value Template',
      type: 'template',
      required: true,
      placeholder: 'e.g., {{ is_state("light.bedroom", "on") }}',
      description: 'Template that evaluates to true/false',
    },
    {
      name: 'for',
      label: 'For Duration (optional)',
      type: 'duration',
      required: false,
      placeholder: 'e.g., 00:05:00',
      description: 'Template must be true for this duration',
    },
  ],

  // Home Assistant trigger: fires on HA events (start/shutdown)
  homeassistant: [
    {
      name: 'event',
      label: 'Event',
      type: 'select',
      required: true,
      description: 'Home Assistant lifecycle event',
      options: [
        { value: 'start', label: 'Start' },
        { value: 'shutdown', label: 'Shutdown' },
      ],
      default: 'start',
    },
  ],

  // Device trigger: uses dynamic fields from API
  // This is handled separately with device automation API
  device: [],
};

/**
 * Get field configuration for a trigger platform
 */
export function getTriggerFields(platform: TriggerPlatform): FieldConfig[] {
  return TRIGGER_PLATFORM_FIELDS[platform] || [];
}

/**
 * Get default values for a trigger platform based on field configurations
 */
export function getTriggerDefaults(platform: TriggerPlatform): Record<string, unknown> {
  const fields = getTriggerFields(platform);
  const defaults: Record<string, unknown> = { trigger: platform };

  for (const field of fields) {
    if (field.default !== undefined) {
      defaults[field.name] = field.default;
    }
  }

  return defaults;
}

/**
 * Check if a trigger platform uses device automation API
 */
export function usesDeviceAutomation(platform: TriggerPlatform): boolean {
  return platform === 'device';
}
