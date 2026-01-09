import type { FlowNode } from '@cafe/shared';
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
import { TriggerConditionFields } from './TriggerConditionFields';
import { ZoneConditionFields } from './ZoneConditionFields';
import { ConditionGroupEditor } from '@/components/nodes/ConditionGroupEditor';

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
      case 'trigger':
        return <TriggerConditionFields node={node} onChange={onChange} />;
      case 'and':
      case 'or':
      case 'not':
        // Render the group editor for logical group conditions
        // Only pass conditions if node.data is a group condition
        // Type guard for condition node
        const isConditionNode =
          node.type === 'condition' &&
          typeof (node.data as any).condition_type === 'string';
        const groupConditions =
          isConditionNode && ['and', 'or', 'not'].includes((node.data as any).condition_type) &&
          Array.isArray((node.data as any).conditions)
            ? (node.data as any).conditions
            : [];
        return (
          <ConditionGroupEditor
            conditions={groupConditions}
            onChange={conds => onChange('conditions', conds)}
            parentType={conditionType as 'and' | 'or' | 'not'}
          />
        );
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
