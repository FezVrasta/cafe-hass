import type { FlowNode } from '@cafe/shared';
import { FormField } from '@/components/forms/FormField';
import { ConditionGroupEditor } from '@/components/panels/node-fields/ConditionGroupEditor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConditionNodeData } from '@/store/flow-store';
import type { HassEntity } from '@/types/hass';
import { getNodeDataString } from '@/utils/nodeData';
import { DeviceConditionFields } from './DeviceConditionFields';
import { NumericStateConditionFields } from './NumericStateConditionFields';
import { StateConditionFields } from './StateConditionFields';
import { TemplateConditionFields } from './TemplateConditionFields';
import { TimeConditionFields } from './TimeConditionFields';
import { TriggerConditionFields } from './TriggerConditionFields';
import { ZoneConditionFields } from './ZoneConditionFields';

interface ConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

// Logical group types that use the ConditionGroupEditor
const GROUP_TYPES = ['and', 'or', 'not'];

/**
 * Condition node field component.
 * Router component that dispatches to specific condition type components.
 * Extracts the 258-line condition rendering block from PropertyPanel.
 */
export function ConditionFields({ node, onChange, entities }: ConditionFieldsProps) {
  const conditionType = getNodeDataString(node, 'condition_type', 'state');
  const nodeData = node.data as Record<string, unknown>;
  const hasNestedConditions = Array.isArray(nodeData.conditions) && nodeData.conditions.length > 0;
  const isGroupType = GROUP_TYPES.includes(conditionType);

  const renderConditionFields = () => {
    switch (conditionType) {
      case 'state':
        return <StateConditionFields node={node} onChange={onChange} entities={entities} />;
      case 'numeric_state':
        return <NumericStateConditionFields node={node} onChange={onChange} entities={entities} />;
      case 'template':
        return <TemplateConditionFields node={node} onChange={onChange} />;
      case 'time':
        return <TimeConditionFields node={node} onChange={onChange} />;
      case 'zone':
        return <ZoneConditionFields node={node} onChange={onChange} entities={entities} />;
      case 'device':
        return <DeviceConditionFields node={node} onChange={onChange} />;
      case 'trigger':
        return <TriggerConditionFields node={node} onChange={onChange} />;
      case 'and':
      case 'or':
      case 'not':
        // For group types, only render the group editor (no type-specific fields)
        return null;
      default:
        return null;
    }
  };

  return (
    <>
      <FormField label="Condition Type" required>
        <Select value={conditionType} onValueChange={(value) => onChange('condition_type', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="state">State</SelectItem>
            <SelectItem value="numeric_state">Numeric State</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="time">Time</SelectItem>
            <SelectItem value="sun">Sun</SelectItem>
            <SelectItem value="zone">Zone</SelectItem>
            <SelectItem value="device">Device</SelectItem>
            <SelectItem value="trigger">Trigger</SelectItem>
            <SelectItem value="and">AND (All)</SelectItem>
            <SelectItem value="or">OR (Any)</SelectItem>
            <SelectItem value="not">NOT</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {renderConditionFields()}

      {/* Render nested conditions if they exist (for group types or when parsed from YAML with multiple conditions) */}
      {(isGroupType || hasNestedConditions) && (
        <FormField label="Nested Conditions">
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
