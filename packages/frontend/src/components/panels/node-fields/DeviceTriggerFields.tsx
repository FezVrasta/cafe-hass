import type { FlowNode } from '@hflow/shared';
import { useEffect, useState } from 'react';
import { FormField } from '@/components/forms/FormField';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DeviceTrigger, TriggerField } from '@/hooks/useDeviceAutomation';
import { useDeviceAutomation } from '@/hooks/useDeviceAutomation';
import { useDeviceRegistry } from '@/hooks/useDeviceRegistry';
import type { HassEntity } from '@/hooks/useHass';
import { useTranslations } from '@/hooks/useTranslations';
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
  const { devices, isLoading: loadingDevices } = useDeviceRegistry();
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
      <FormField label="Device" required>
        {loadingDevices ? (
          <div className="text-muted-foreground text-sm">Loading devices...</div>
        ) : devices.length > 0 ? (
          <Select value={deviceId} onValueChange={(value) => onChange('device_id', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select device..." />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            type="text"
            value={deviceId}
            onChange={(e) => onChange('device_id', e.target.value)}
            placeholder="Enter device ID manually"
          />
        )}
        {!loadingDevices && devices.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No devices found. Enter device ID manually or check your Home Assistant connection.
          </p>
        )}
      </FormField>

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
              {availableDeviceTriggers.map((trigger, idx) => (
                <SelectItem key={idx} value={trigger.type}>
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
