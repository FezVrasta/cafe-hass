import type { FlowNode, TriggerPlatform } from '@cafe/shared';
import { useEffect } from 'react';
import { FormField } from '@/components/forms/FormField';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTriggerDefaults, getTriggerFields } from '@/config/triggerFields';
import type { HassEntity } from '@/types/hass';
import { getNodeDataString } from '@/utils/nodeData';
import { DeviceTriggerFields } from './DeviceTriggerFields';

interface TriggerFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Trigger node field component.
 * Handles platform selection and renders appropriate field configuration.
 * Extracts trigger rendering logic from PropertyPanel.
 */
export function TriggerFields({ node, onChange, entities }: TriggerFieldsProps) {
  const platform = getNodeDataString(node, 'platform', 'state');
  const deviceId = getNodeDataString(node, 'device_id');

  // If we have a device_id but platform isn't 'device', auto-correct it
  const effectivePlatform = deviceId && platform !== 'device' ? 'device' : platform;

  // Auto-correct platform to 'device' if we detected device_id but platform is wrong
  useEffect(() => {
    if (deviceId && platform !== 'device') {
      onChange('platform', 'device');
    }
  }, [deviceId, platform, onChange]);

  const handlePlatformChange = (newPlatform: string) => {
    // Get defaults for the new platform (includes platform field and any field defaults)
    const defaults = getTriggerDefaults(newPlatform as TriggerPlatform);

    // Apply all defaults
    for (const [key, value] of Object.entries(defaults)) {
      onChange(key, value);
    }

    // If switching away from device, clear device_id
    if (newPlatform !== 'device' && deviceId) {
      onChange('device_id', undefined);
    }
  };

  return (
    <>
      <FormField label="Platform" required>
        <Select value={effectivePlatform} onValueChange={handlePlatformChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="state">State Change</SelectItem>
            <SelectItem value="numeric_state">Numeric State</SelectItem>
            <SelectItem value="time">Time</SelectItem>
            <SelectItem value="time_pattern">Time Pattern</SelectItem>
            <SelectItem value="sun">Sun</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="mqtt">MQTT</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="zone">Zone</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="homeassistant">Home Assistant</SelectItem>
            <SelectItem value="device">Device</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {/* Dynamic fields based on platform */}
      {(() => {
        // Device triggers use API-driven fields
        // Check for both platform === 'device' OR presence of device_id (in case platform gets corrupted)
        if (effectivePlatform === 'device' || deviceId) {
          return <DeviceTriggerFields node={node} onChange={onChange} entities={entities} />;
        }

        // Other platforms use static field configuration
        const fields = getTriggerFields(effectivePlatform as TriggerPlatform);
        return fields.map((field) => (
          <DynamicFieldRenderer
            key={field.name}
            field={field}
            value={(node.data as Record<string, unknown>)[field.name]}
            onChange={(value) => onChange(field.name, value)}
            entities={entities}
          />
        ));
      })()}
    </>
  );
}
