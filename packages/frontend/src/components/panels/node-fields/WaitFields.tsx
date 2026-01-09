import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getNodeDataString } from '@/utils/nodeData';

interface WaitFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Wait node field component.
 * Simple component for configuring wait template and timeout.
 */
export function WaitFields({ node, onChange }: WaitFieldsProps) {
  const waitTemplate = getNodeDataString(node, 'wait_template', '');
  const timeout = getNodeDataString(node, 'timeout', '00:01:00');

  return (
    <>
      <FormField
        label="Wait Template"
        required
        description="Template condition that must be true to continue"
      >
        <Textarea
          value={waitTemplate}
          onChange={(e) => onChange('wait_template', e.target.value)}
          className="font-mono"
          rows={3}
          placeholder="{{ is_state('sensor.x', 'on') }}"
        />
      </FormField>

      <FormField label="Timeout" description="Maximum time to wait before continuing (HH:MM:SS)">
        <Input
          type="text"
          value={timeout}
          onChange={(e) => onChange('timeout', e.target.value)}
          placeholder="00:01:00"
        />
      </FormField>
    </>
  );
}
