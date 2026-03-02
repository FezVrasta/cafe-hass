import type { FlowNode } from '@cafe/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/forms/FormField';
import { DeviceSelector } from '@/components/ui/DeviceSelector';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import { EntitySelector } from '@/components/ui/EntitySelector';
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
  const { t } = useTranslation(['common', 'nodes', 'errors']);
  const { getDeviceTriggers, getTriggerCapabilities } = useDeviceAutomation();
  // DeviceSelector handles device registry internally
  const { translations } = useTranslations();

  const [availableDeviceTriggers, setAvailableDeviceTriggers] = useState<DeviceTrigger[]>([]);
  const [triggerCapabilities, setTriggerCapabilities] = useState<TriggerField[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(false);

  const deviceId = getNodeDataString(node, 'device_id');
  const selectedTriggerType = getNodeDataString(node, 'type');
  const domain = getNodeDataString(node, 'domain');
  const entityId = getNodeDataString(node, 'entity_id');

  const selectedSubtype = getNodeDataString(node, 'subtype');
  const selectedCompositeValue =
    selectedTriggerType && selectedSubtype
      ? `${selectedTriggerType}::${selectedSubtype}`
      : selectedTriggerType ?? '';

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
        console.error(t('errors:api.loadDeviceTriggersFailed'), error);
        setAvailableDeviceTriggers([]);
      })
      .finally(() => {
        setLoadingTriggers(false);
      });
  }, [deviceId, getDeviceTriggers, t]);

  // Fetch capabilities when trigger type is selected
  useEffect(() => {
    if (!deviceId || !selectedTriggerType) {
      setTriggerCapabilities([]);
      return;
    }

    // Find the full trigger object from the list - HA API needs the complete trigger
    const trigger = availableDeviceTriggers.find(
      (t) => t.type === selectedTriggerType && t.domain === domain && (t.subtype ?? '') === (selectedSubtype ?? '')
    );

    if (!trigger) {
      setTriggerCapabilities([]);
      return;
    }

    getTriggerCapabilities(trigger)
      .then((capabilities) => {
        setTriggerCapabilities(capabilities.extra_fields || []);
      })
      .catch((error) => {
        console.error(t('errors:api.loadTriggerCapabilitiesFailed'), error);
        setTriggerCapabilities([]);
      });
  }, [deviceId, selectedTriggerType, selectedSubtype, domain, availableDeviceTriggers, getTriggerCapabilities, t]);

  return (
    <>
      {/* Device selector */}
      <DeviceSelector
        value={deviceId}
        onChange={(val) => onChange('device_id', val)}
        label={t('labels.device')}
        required
        placeholder={t('placeholders.selectDevice')}
      />

      {/* Trigger type selector - show dropdown if API data available, otherwise show as text */}
      {deviceId && availableDeviceTriggers.length > 0 ? (
        <FormField label={t('labels.triggerType')} required>
          <Select
            // value={selectedTriggerType}
            value={selectedCompositeValue}
            onValueChange={(value) => {
              const [type, subtype] = value.split('::');
              // Find the selected trigger to get its domain
              const trigger = availableDeviceTriggers.find((t) => t.type === type && (t.subtype ?? '') === (subtype ?? ''));
              if (trigger) {
                onChange('type', type);
                onChange('domain', trigger.domain);
                onChange('subtype', subtype ?? undefined);

              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('placeholders.selectTriggerType')} />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                new Map(
                  availableDeviceTriggers.map((t) => [
                    `${t.domain}-${t.type}-${t.subtype ?? ''}`,
                    t,
                  ])
                ).values()
              ).map((trigger) => {
                const compositeValue = trigger.subtype
                  ? `${trigger.type}::${trigger.subtype}`
                  : trigger.type;
                const label = trigger.subtype
                  ? `${trigger.type}: ${trigger.subtype} (${trigger.domain})`
                  : `${trigger.type} (${trigger.domain})`;
                return (
                  <SelectItem
                    key={`${trigger.domain}-${trigger.type}-${trigger.subtype ?? ''}`}
                    value={compositeValue}
                  >
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FormField>
      ) : (
        /* Show existing type/domain as read-only when API not available */
        deviceId &&
        selectedTriggerType && (
          <FormField label="Trigger Type">
            <div className="truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {selectedTriggerType}
                {selectedSubtype && (
                          <span className="text-muted-foreground"> · {selectedSubtype}</span>
                        )}
              {domain && <span className="text-muted-foreground"> {`(${domain})`}</span>}
            </div>
          </FormField>
        )
      )}

      {/* Entity ID - always required for device triggers when device is selected */}
      {deviceId && (
        <FormField label={t('labels.entityId')} required>
          <EntitySelector
            value={entityId || ''}
            onChange={(value) => onChange('entity_id', value)}
            entities={entities}
            placeholder={t('placeholders.selectEntity')}
          />
        </FormField>
      )}

      {/* Loading state */}
      {loadingTriggers && (
        <div className="text-muted-foreground text-sm">{t('status.loadingTriggers')}</div>
      )}

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
