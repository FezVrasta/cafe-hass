import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { getNodeDataString } from '@/utils/nodeData';

interface DelayFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Delay node field component.
 * Simple component for configuring delay duration.
 */
export function DelayFields({ node, onChange }: DelayFieldsProps) {
  const delay = getNodeDataString(node, 'delay', '00:00:05');

  return (
    <FormField
      label="Delay (HH:MM:SS)"
      description="Duration to wait before continuing to the next action"
    >
      <Input
        type="text"
        value={delay}
        onChange={(e) => onChange('delay', e.target.value)}
        placeholder="00:00:05"
      />
    </FormField>
  );
}
