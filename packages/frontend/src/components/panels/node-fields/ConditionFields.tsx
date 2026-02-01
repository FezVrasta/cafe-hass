import type { ConditionType, FlowNode } from '@cafe/shared';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/forms/FormField';
import { ConditionGroupEditor } from '@/components/panels/node-fields/ConditionGroupEditor';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getConditionDefaults,
  getConditionFields,
  isLogicalGroupType,
} from '@/config/conditionFields';
import { useNodeErrors } from '@/hooks/useNodeErrors';
import type { ConditionNodeData } from '@/store/flow-store';
import type { HassEntity } from '@/types/hass';
import { getNodeDataString } from '@/utils/nodeData';
import { DeviceConditionFields } from './DeviceConditionFields';

interface ConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Condition node field component.
 * Router component that dispatches to specific condition type components.
 * Uses a config-based approach similar to TriggerFields for consistency.
 */
export function ConditionFields({ node, onChange, entities }: ConditionFieldsProps) {
  const { t } = useTranslation(['common', 'nodes']);
  const { getFieldError } = useNodeErrors(node.id);
  const conditionType = getNodeDataString(node, 'condition', 'state') as ConditionType;
  const nodeData = node.data as Record<string, unknown>;
  const hasNestedConditions = Array.isArray(nodeData.conditions) && nodeData.conditions.length > 0;
  const isGroupType = isLogicalGroupType(conditionType);

  const handleConditionTypeChange = (newType: string) => {
    // Get defaults for the new condition type (includes condition field and any field defaults)
    const defaults = getConditionDefaults(newType as ConditionType);

    // Apply all defaults
    for (const [key, value] of Object.entries(defaults)) {
      onChange(key, value);
    }
  };

  const renderConditionFields = () => {
    // Device conditions use a special component with DeviceSelector
    if (conditionType === 'device') {
      return <DeviceConditionFields node={node} onChange={onChange} />;
    }

    // Logical group types don't have their own fields
    if (isGroupType) {
      return null;
    }

    // All other condition types use static field configuration
    const fields = getConditionFields(conditionType);
    return fields.map((field) => {
      // Special handling for weekday: convert array to comma-separated string for display,
      // and convert back to array when saving
      if (field.name === 'weekday') {
        const rawValue = nodeData[field.name];
        const displayValue = Array.isArray(rawValue) ? rawValue.join(',') : rawValue;
        return (
          <DynamicFieldRenderer
            key={field.name}
            field={field}
            value={displayValue}
            error={getFieldError(field.name)}
            onChange={(value) => {
              // Convert comma-separated string to array
              const arrayValue =
                typeof value === 'string' && value.trim()
                  ? value.split(',').map((d) => d.trim())
                  : [];
              onChange(field.name, arrayValue);
            }}
            entities={entities}
          />
        );
      }

      return (
        <DynamicFieldRenderer
          key={field.name}
          field={field}
          value={nodeData[field.name]}
          onChange={(value) => onChange(field.name, value)}
          entities={entities}
          error={getFieldError(field.name)}
        />
      );
    });
  };

  return (
    <>
      <FormField label={t('nodes:conditions.conditionLabel')} required>
        <Select value={conditionType} onValueChange={handleConditionTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="state">{t('nodes:conditions.types.state')}</SelectItem>
            <SelectItem value="numeric_state">
              {t('nodes:conditions.types.numeric_state')}
            </SelectItem>
            <SelectItem value="template">{t('nodes:conditions.types.template')}</SelectItem>
            <SelectItem value="time">{t('nodes:conditions.types.time')}</SelectItem>
            <SelectItem value="sun">{t('nodes:conditions.types.sun')}</SelectItem>
            <SelectItem value="zone">{t('nodes:conditions.types.zone')}</SelectItem>
            <SelectItem value="device">{t('nodes:conditions.types.device')}</SelectItem>
            <SelectItem value="trigger">{t('nodes:conditions.types.trigger')}</SelectItem>
            <SelectItem value="and">{t('nodes:conditions.types.and')}</SelectItem>
            <SelectItem value="or">{t('nodes:conditions.types.or')}</SelectItem>
            <SelectItem value="not">{t('nodes:conditions.types.not')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {renderConditionFields()}

      {/* Render nested conditions if they exist (for group types or when parsed from YAML with multiple conditions) */}
      {(isGroupType || hasNestedConditions) && (
        <FormField label={t('nodes:conditions.nestedConditions')}>
          <ConditionGroupEditor
            conditions={(nodeData.conditions as ConditionNodeData[]) || []}
            onChange={(conds) => onChange('conditions', conds)}
            parentType={isGroupType ? (conditionType as 'and' | 'or' | 'not') : 'and'}
          />
        </FormField>
      )}
    </>
  );
}
