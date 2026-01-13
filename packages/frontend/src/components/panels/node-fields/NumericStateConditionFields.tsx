import type { FlowNode } from '@cafe/shared';
import { FormField } from '@/components/forms/FormField';
import { EntitySelector } from '@/components/ui/EntitySelector';
import { Input } from '@/components/ui/input';
import type { HassEntity } from '@/types/hass';
import { getNodeDataNumber, getNodeDataString } from '@/utils/nodeData';

interface NumericStateConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Numeric state condition field component.
 * Handles numeric range condition configuration.
 */
export function NumericStateConditionFields({
  node,
  onChange,
  entities,
}: NumericStateConditionFieldsProps) {
  const entityId = getNodeDataString(node, 'entity_id');
  const above = getNodeDataNumber(node, 'above');
  const below = getNodeDataNumber(node, 'below');
  const attribute = getNodeDataString(node, 'attribute');
  const forDuration = getNodeDataString(node, 'for');

  return (
    <>
      <FormField label="Entity" required>
        <EntitySelector
          value={entityId}
          onChange={(value) => onChange('entity_id', value)}
          entities={entities}
          placeholder="Select entity..."
        />
      </FormField>

      <FormField
        label="Above (optional)"
        description="Minimum value (condition is true when value > this)"
      >
        <Input
          type="number"
          value={above ?? ''}
          onChange={(e) => onChange('above', e.target.value ? Number(e.target.value) : undefined)}
          placeholder="Minimum value"
        />
      </FormField>

      <FormField
        label="Below (optional)"
        description="Maximum value (condition is true when value < this)"
      >
        <Input
          type="number"
          value={below ?? ''}
          onChange={(e) => onChange('below', e.target.value ? Number(e.target.value) : undefined)}
          placeholder="Maximum value"
        />
      </FormField>

      <FormField
        label="Attribute (optional)"
        description="Check a specific attribute instead of the state"
      >
        <Input
          type="text"
          value={attribute}
          onChange={(e) => onChange('attribute', e.target.value)}
          placeholder="e.g., brightness, temperature"
        />
      </FormField>

      <FormField label="For Duration (optional)" description="How long the condition must be true">
        <Input
          type="text"
          value={forDuration}
          onChange={(e) => onChange('for', e.target.value)}
          placeholder="00:05:00 or 5 minutes"
        />
      </FormField>
    </>
  );
}
