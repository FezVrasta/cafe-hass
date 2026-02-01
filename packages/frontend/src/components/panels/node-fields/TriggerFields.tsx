import type { FlowNode, TriggerPlatform } from '@cafe/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useNodeErrors } from '@/hooks/useNodeErrors';
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
  const { t } = useTranslation(['nodes']);
  const { getFieldError } = useNodeErrors(node.id);
  const triggerType = getNodeDataString(node, 'trigger', 'state');
  const deviceId = getNodeDataString(node, 'device_id');

  // If we have a device_id but trigger isn't 'device', auto-correct it
  const effectiveTriggerType = deviceId && triggerType !== 'device' ? 'device' : triggerType;

  // Auto-correct trigger to 'device' if we detected device_id but trigger type is wrong
  useEffect(() => {
    if (deviceId && triggerType !== 'device') {
      onChange('trigger', 'device');
    }
  }, [deviceId, triggerType, onChange]);

  const handleTriggerTypeChange = (newTriggerType: string) => {
    // Get defaults for the new trigger type (includes trigger field and any field defaults)
    const defaults = getTriggerDefaults(newTriggerType as TriggerPlatform);

    // Apply all defaults
    for (const [key, value] of Object.entries(defaults)) {
      onChange(key, value);
    }

    // If switching away from device, clear device_id
    if (newTriggerType !== 'device' && deviceId) {
      onChange('device_id', undefined);
    }
  };

  return (
    <>
      <FormField label={t('nodes:triggers.platformLabel')} required>
        <Select value={effectiveTriggerType} onValueChange={handleTriggerTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="state">{t('nodes:triggers.platforms.state')}</SelectItem>
            <SelectItem value="numeric_state">
              {t('nodes:triggers.platforms.numeric_state')}
            </SelectItem>
            <SelectItem value="time">{t('nodes:triggers.platforms.time')}</SelectItem>
            <SelectItem value="time_pattern">
              {t('nodes:triggers.platforms.time_pattern')}
            </SelectItem>
            <SelectItem value="sun">{t('nodes:triggers.platforms.sun')}</SelectItem>
            <SelectItem value="event">{t('nodes:triggers.platforms.event')}</SelectItem>
            <SelectItem value="mqtt">{t('nodes:triggers.platforms.mqtt')}</SelectItem>
            <SelectItem value="webhook">{t('nodes:triggers.platforms.webhook')}</SelectItem>
            <SelectItem value="zone">{t('nodes:triggers.platforms.zone')}</SelectItem>
            <SelectItem value="template">{t('nodes:triggers.platforms.template')}</SelectItem>
            <SelectItem value="homeassistant">
              {t('nodes:triggers.platforms.homeassistant')}
            </SelectItem>
            <SelectItem value="device">{t('nodes:triggers.platforms.device')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {/* Dynamic fields based on trigger type */}
      <TriggerDynamicFields
        effectiveTriggerType={effectiveTriggerType}
        deviceId={deviceId}
        node={node}
        onChange={onChange}
        entities={entities}
        getFieldError={getFieldError}
      />
    </>
  );
}

function TriggerDynamicFields({
  effectiveTriggerType,
  deviceId,
  node,
  onChange,
  entities,
  getFieldError,
}: {
  effectiveTriggerType: string;
  deviceId: string;
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
  getFieldError: (fieldPath: string) => string | undefined;
}) {
  // Device triggers use API-driven fields
  if (effectiveTriggerType === 'device' || deviceId) {
    return <DeviceTriggerFields node={node} onChange={onChange} entities={entities} />;
  }

  // Other trigger types use static field configuration
  const fields = getTriggerFields(effectiveTriggerType as TriggerPlatform);
  return fields.map((field) => (
    <DynamicFieldRenderer
      key={field.name}
      field={field}
      value={(node.data as Record<string, unknown>)[field.name]}
      onChange={(value) => onChange(field.name, value)}
      entities={entities}
      error={getFieldError(field.name)}
    />
  ));
}
