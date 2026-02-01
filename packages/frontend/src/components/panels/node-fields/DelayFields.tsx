import type { DelayNode } from '@cafe/shared';
import { FieldError } from '@/components/forms/FieldError';
import { useNodeErrors } from '@/hooks/useNodeErrors';
import { DurationField } from './DurationField';

interface DelayFieldsProps {
  node: DelayNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Delay node field component.
 * Simple component for configuring delay duration.
 */
export function DelayFields({ node, onChange }: DelayFieldsProps) {
  const { getFieldError } = useNodeErrors(node.id);

  return (
    <>
      <DurationField
        label="Delay"
        value={node.data.delay}
        onChange={(val) => onChange('delay', val)}
      />
      <FieldError message={getFieldError('delay')} />
    </>
  );
}
