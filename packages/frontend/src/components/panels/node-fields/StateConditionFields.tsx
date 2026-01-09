import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import { EntitySelector } from '@/components/ui/EntitySelector';
import { Input } from '@/components/ui/input';
import type { HassEntity } from '@/hooks/useHass';
import { getNodeDataString } from '@/utils/nodeData';

interface StateConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * State condition field component.
 * Handles entity state condition configuration.
 */
export function StateConditionFields({ node, onChange, entities }: StateConditionFieldsProps) {
  const entityId = getNodeDataString(node, 'entity_id');
  const state = getNodeDataString(node, 'state');
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

      <FormField label="State" required description="The state value to check for">
        <Input
          type="text"
          value={state}
          onChange={(e) => onChange('state', e.target.value)}
          placeholder="e.g., on, below_horizon"
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
