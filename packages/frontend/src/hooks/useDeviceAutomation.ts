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
  entity_id?: string;
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
 */
export interface TriggerField {
  name: string;
  required?: boolean;
  optional?: boolean;
  default?: unknown;
  selector: Partial<Record<SelectorType, Record<string, unknown>>>;
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
  const { sendMessage } = useHass();

  /**
   * Fetch available triggers for a specific device
   */
  const getDeviceTriggers = useCallback(
    async (deviceId: string): Promise<DeviceTrigger[]> => {
      try {
        const response = await sendMessage<DeviceTrigger[]>({
          type: 'device_automation/trigger/list',
          device_id: deviceId,
        });
        return response || [];
      } catch (error) {
        console.error('Failed to fetch device triggers:', error);
        throw error;
      }
    },
    [sendMessage]
  );

  /**
   * Fetch trigger capabilities (field schema) for a specific trigger
   */
  const getTriggerCapabilities = useCallback(
    async (trigger: Partial<DeviceTrigger>): Promise<TriggerCapabilities> => {
      try {
        const response = await sendMessage<TriggerCapabilities>({
          type: 'device_automation/trigger/capabilities',
          trigger,
        });
        return response || { extra_fields: [] };
      } catch (error) {
        console.error('Failed to fetch trigger capabilities:', error);
        throw error;
      }
    },
    [sendMessage]
  );

  return {
    getDeviceTriggers,
    getTriggerCapabilities,
  };
}
