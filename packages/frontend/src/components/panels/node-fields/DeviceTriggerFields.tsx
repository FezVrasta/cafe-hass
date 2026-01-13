import type { FlowNode } from '@cafe/shared';
import { useEffect, useState } from 'react';
import { FormField } from '@/components/forms/FormField';
import { DeviceSelector } from '@/components/ui/DeviceSelector';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DeviceTrigger, TriggerField } from '@/hooks/useDeviceAutomation';
import { useDeviceAutomation } from '@/hooks/useDeviceAutomation';
import { useTranslations } from '@/hooks/useTranslations';
import type { HassEntity } from '@/types/hass';
import { getNodeDataString } from '@/utils/nodeData';

interface DeviceTriggerFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Component for device trigger fields with dynamic API-based rendering.
 * Moved from PropertyPanel and updated to use new hooks.
 */
export function DeviceTriggerFields({ node, onChange, entities }: DeviceTriggerFieldsProps) {
  const { getDeviceTriggers, getTriggerCapabilities } = useDeviceAutomation();
  // DeviceSelector handles device registry internally
  const { translations } = useTranslations();

  const [availableDeviceTriggers, setAvailableDeviceTriggers] = useState<DeviceTrigger[]>([]);
  const [triggerCapabilities, setTriggerCapabilities] = useState<TriggerField[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(false);

  const deviceId = getNodeDataString(node, 'device_id');
  const selectedTriggerType = getNodeDataString(node, 'type');
  const domain = getNodeDataString(node, 'domain');

  // Fetch triggers when device is selected
  useEffect(() => {
    if (!deviceId) {
      setAvailableDeviceTriggers([]);
      return;
    }

    setLoadingTriggers(true);
    getDeviceTriggers(deviceId)
      .then((triggers) => {
        setAvailableDeviceTriggers(triggers);
      })
      .catch((error) => {
        console.error('Failed to load device triggers:', error);
        setAvailableDeviceTriggers([]);
      })
      .finally(() => {
        setLoadingTriggers(false);
      });
  }, [deviceId, getDeviceTriggers]);

  // Fetch capabilities when trigger type is selected
  useEffect(() => {
    if (!deviceId || !selectedTriggerType) {
      setTriggerCapabilities([]);
      return;
    }

    const triggerConfig: Partial<DeviceTrigger> = {
      device_id: deviceId,
      domain: domain,
      type: selectedTriggerType,
      platform: 'device',
    };

    getTriggerCapabilities(triggerConfig)
      .then((capabilities) => {
        setTriggerCapabilities(capabilities.extra_fields || []);
      })
      .catch((error) => {
        console.error('Failed to load trigger capabilities:', error);
        setTriggerCapabilities([]);
      });
  }, [deviceId, selectedTriggerType, domain, getTriggerCapabilities]);

  return (
    <>
      {/* Device selector */}
      <DeviceSelector
        value={deviceId}
        onChange={(val) => onChange('device_id', val)}
        label="Device"
        required
        placeholder="Select device..."
      />

      {/* Trigger type selector */}
      {deviceId && availableDeviceTriggers.length > 0 && (
        <FormField label="Trigger Type" required>
          <Select
            value={selectedTriggerType}
            onValueChange={(value) => {
              // Find the selected trigger to get its domain
              const trigger = availableDeviceTriggers.find((t) => t.type === value);
              if (trigger) {
                onChange('type', value);
                onChange('domain', trigger.domain);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select trigger type..." />
            </SelectTrigger>
            <SelectContent>
              {availableDeviceTriggers.map((trigger) => (
                <SelectItem key={`${trigger.domain}-${trigger.type}`} value={trigger.type}>
                  {trigger.type} ({trigger.domain})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      {/* Loading state */}
      {loadingTriggers && <div className="text-muted-foreground text-sm">Loading triggers...</div>}

      {/* Dynamic fields from capabilities API */}
      {triggerCapabilities.map((field) => (
        <DynamicFieldRenderer
          key={field.name}
          field={field}
          value={(node.data as Record<string, unknown>)[field.name]}
          onChange={(value) => onChange(field.name, value)}
          entities={entities}
          domain={domain}
          translations={translations}
        />
      ))}
    </>
  );
}
