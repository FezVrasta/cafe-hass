import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { getNodeDataString } from '@/utils/nodeData';

interface TimeConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Time condition field component.
 * Handles time-based condition configuration.
 */
export function TimeConditionFields({ node, onChange }: TimeConditionFieldsProps) {
  const after = getNodeDataString(node, 'after');
  const before = getNodeDataString(node, 'before');
  const weekday = getNodeDataString(node, 'weekday');

  return (
    <>
      <FormField label="After (optional)" description="Condition is true after this time">
        <Input type="time" value={after} onChange={(e) => onChange('after', e.target.value)} />
      </FormField>

      <FormField label="Before (optional)" description="Condition is true before this time">
        <Input type="time" value={before} onChange={(e) => onChange('before', e.target.value)} />
      </FormField>

      <FormField label="Weekday (optional)" description="Comma-separated list of days">
        <Input
          type="text"
          value={weekday}
          onChange={(e) => onChange('weekday', e.target.value)}
          placeholder="mon,tue,wed,thu,fri,sat,sun"
        />
      </FormField>
    </>
  );
}
