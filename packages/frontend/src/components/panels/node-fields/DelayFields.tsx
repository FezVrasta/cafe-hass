import type { DelayNode } from '@cafe/shared';
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
  return (
    <DurationField
      label="Delay"
      value={node.data.delay}
      onChange={(val) => onChange('delay', val)}
    />
  );
}
