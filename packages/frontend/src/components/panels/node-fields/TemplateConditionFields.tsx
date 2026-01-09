import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import { Textarea } from '@/components/ui/textarea';
import { getNodeDataString } from '@/utils/nodeData';

interface TemplateConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Template condition field component.
 * Handles template-based condition configuration.
 */
export function TemplateConditionFields({ node, onChange }: TemplateConditionFieldsProps) {
  const valueTemplate = getNodeDataString(node, 'value_template');

  return (
    <FormField
      label="Value Template"
      required
      description="Template that should evaluate to true/false"
    >
      <Textarea
        value={valueTemplate}
        onChange={(e) => onChange('value_template', e.target.value)}
        placeholder="{{ states('sensor.temperature') | float > 20 }}"
        className="font-mono"
        rows={3}
      />
    </FormField>
  );
}
