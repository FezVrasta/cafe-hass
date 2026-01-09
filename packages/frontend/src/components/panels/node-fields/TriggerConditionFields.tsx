import type { FlowNode } from '@cafe/shared';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { getNodeDataString } from '@/utils/nodeData';

interface TriggerConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Trigger condition field component.
 * Handles trigger-based condition configuration (checking which trigger fired).
 */
export function TriggerConditionFields({ node, onChange }: TriggerConditionFieldsProps) {
  const triggerId = getNodeDataString(node, 'id');

  return (
    <FormField
      label="Trigger ID"
      required
      description="The ID of the trigger to match"
    >
      <Input
        value={triggerId}
        onChange={(e) => onChange('id', e.target.value)}
        placeholder="e.g., arriving, leaving"
      />
    </FormField>
  );
}
