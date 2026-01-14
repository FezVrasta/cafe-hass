/**
 * Centralized configuration for handled properties by node type.
 * Eliminates magic strings scattered throughout the codebase.
 * Provides single source of truth for which properties are handled by specific UI sections.
 */

export const HANDLED_PROPERTIES = {
  // Common properties handled by all nodes
  common: [
    'alias', // Always handled by common alias field
    '_conditionId', // Internal property
  ],

  // Trigger properties handled by TriggerFields component
  trigger: [
    // Platform and common trigger properties
    'platform',
    'entity_id',
    'to',
    'from',
    'for',
    'at',
    'event_type',
    'event_data',
    'event',
    'offset',
    'above',
    'below',
    'value_template',
    'template',
    'webhook_id',
    'zone',
    'topic',
    'payload',
    'hours',
    'minutes',
    'seconds',
    // Device trigger properties (handled by DeviceTriggerFields)
    'device_id',
    'domain',
    'type',
    'subtype',
  ],

  // Condition properties handled by ConditionFields component
  condition: [
    'condition_type',
    'entity_id',
    'state',
    'attribute',
    'above',
    'below',
    'value_template',
    'template', // Template condition field
    'after',
    'before',
    'weekday',
    'device_id',
    'domain',
    'type',
    'subtype',
    'zone',
    'condition',
    'for', // Duration field
    'conditions', // Nested conditions for and/or/not and multi-condition blocks
    'id', // Trigger condition ID field
  ],

  // Action properties handled by ActionFields component
  action: [
    'service',
    'data',
    'target',
    // Legacy/alternative action formats
    'entity_id', // Legacy: often shows up instead of target.entity_id
    'action', // Alternative field name for service
    'metadata', // HA metadata field
  ],

  // Delay properties handled by DelayFields component
  delay: ['delay'],

  // Wait properties handled by WaitFields component
  wait: ['wait_template', 'timeout', 'wait_for_trigger'],

  // Set Variables properties handled by SetVariablesFields component
  set_variables: ['variables'],
} as const;

/**
 * Get all handled properties for a specific node type.
 *
 * @param nodeType - The type of node ('trigger', 'condition', 'action', 'delay', 'wait')
 * @param additionalFields - Additional fields to mark as handled (e.g., dynamic device fields)
 * @returns Set of property names that are handled by UI components
 */
export function getHandledProperties(
  nodeType: string,
  additionalFields: string[] = []
): Set<string> {
  const base = [
    ...HANDLED_PROPERTIES.common,
    ...(HANDLED_PROPERTIES[nodeType as keyof typeof HANDLED_PROPERTIES] || []),
  ];

  return new Set([...base, ...additionalFields]);
}

/**
 * Get additional handled fields for device triggers.
 * These are dynamically determined based on the trigger capabilities.
 *
 * @param triggerCapabilities - Array of trigger capability fields
 * @returns Array of field names to mark as handled
 */
export function getDeviceTriggerHandledFields(
  triggerCapabilities: Array<{ name: string }> = []
): string[] {
  return triggerCapabilities.map((field) => field.name);
}

/**
 * Check if a property is handled by UI components for a given node type.
 *
 * @param nodeType - The type of node
 * @param propertyName - The property name to check
 * @param additionalFields - Additional fields to consider as handled
 * @returns True if the property is handled by UI components
 */
export function isPropertyHandled(
  nodeType: string,
  propertyName: string,
  additionalFields: string[] = []
): boolean {
  const handledProperties = getHandledProperties(nodeType, additionalFields);
  return handledProperties.has(propertyName);
}
