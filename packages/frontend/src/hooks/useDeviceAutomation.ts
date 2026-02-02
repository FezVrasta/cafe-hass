import { useCallback } from 'react';
import { useHass } from '../contexts/HassContext';

/**
 * Device trigger definition from HA API
 */
export interface DeviceTrigger {
  platform: string;
  domain: string;
  device_id: string;
  type: string;
  subtype?: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
}

/**
 * Selector types supported by Home Assistant
 */
export type SelectorType =
  | 'text'
  | 'boolean'
  | 'number'
  | 'select'
  | 'entity'
  | 'device'
  | 'area'
  | 'time'
  | 'date'
  | 'datetime'
  | 'duration'
  | 'object'
  | 'template'
  | 'color_rgb'
  | 'color_temp'
  | 'icon'
  | 'media'
  | 'target'
  | 'action'
  | 'condition';

/**
 * Field configuration returned by trigger/capabilities API
 * HA returns fields with either 'type' (older format) or 'selector' (newer format)
 */
export interface TriggerField {
  name: string;
  required?: boolean;
  optional?: boolean;
  default?: unknown;
  // Newer selector format
  selector?: Partial<Record<SelectorType, Record<string, unknown>>>;
  // Older type format (e.g., "select", "number", etc.)
  type?: string;
  options?: [string, string][];
}

/**
 * Trigger capabilities response
 */
export interface TriggerCapabilities {
  extra_fields?: TriggerField[];
}

/**
 * Hook to interact with Home Assistant Device Automation API
 */
export function useDeviceAutomation() {
  const { hass } = useHass();

  /**
   * Fetch available triggers for a specific device
   */
  const getDeviceTriggers = useCallback(
    async (deviceId: string): Promise<DeviceTrigger[]> => {
      if (!hass?.callWS) {
        console.warn('callWS not available');
        return [];
      }
      try {
        const response = (await hass.callWS({
          type: 'device_automation/trigger/list',
          device_id: deviceId,
        })) as DeviceTrigger[] | undefined;

        return response || [];
      } catch (error) {
        console.error('Failed to fetch device triggers:', error);
        throw error;
      }
    },
    [hass]
  );

  /**
   * Fetch trigger capabilities (field schema) for a specific trigger
   */
  const getTriggerCapabilities = useCallback(
    async (trigger: Partial<DeviceTrigger>): Promise<TriggerCapabilities> => {
      if (!hass?.callWS) {
        console.warn('callWS not available');
        return { extra_fields: [] };
      }
      try {
        const response = await hass.callWS({
          type: 'device_automation/trigger/capabilities',
          trigger,
        });
        return (response as TriggerCapabilities) || { extra_fields: [] };
      } catch (error) {
        console.error('Failed to fetch trigger capabilities:', error);
        throw error;
      }
    },
    [hass]
  );

  return {
    getDeviceTriggers,
    getTriggerCapabilities,
  };
}
