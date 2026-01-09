import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HassEntity } from '@/hooks/useHass';
import { getNodeDataString } from '@/utils/nodeData';
import { DeviceConditionFields } from './DeviceConditionFields';
import { NumericStateConditionFields } from './NumericStateConditionFields';
import { StateConditionFields } from './StateConditionFields';
import { TemplateConditionFields } from './TemplateConditionFields';
import { TimeConditionFields } from './TimeConditionFields';
import { ZoneConditionFields } from './ZoneConditionFields';

interface ConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Condition node field component.
 * Router component that dispatches to specific condition type components.
 * Extracts the 258-line condition rendering block from PropertyPanel.
 */
export function ConditionFields({ node, onChange, entities }: ConditionFieldsProps) {
  const conditionType = getNodeDataString(node, 'condition_type', 'state');

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
      case 'and':
      case 'or':
      case 'not':
        // These logical conditions would need additional implementation
        // For now, they don't have specific fields
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
            <SelectItem value="and">AND</SelectItem>
            <SelectItem value="or">OR</SelectItem>
            <SelectItem value="not">NOT</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {renderConditionFields()}
    </>
  );
}
