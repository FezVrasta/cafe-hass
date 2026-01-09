import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import { EntitySelector } from '@/components/ui/EntitySelector';
import { Input } from '@/components/ui/input';
import type { HassEntity } from '@/hooks/useHass';
import { getNodeDataString } from '@/utils/nodeData';

interface ZoneConditionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Zone condition field component.
 * Handles zone-based condition configuration.
 */
export function ZoneConditionFields({ node, onChange, entities }: ZoneConditionFieldsProps) {
  const entityId = getNodeDataString(node, 'entity_id');
  const zone = getNodeDataString(node, 'zone');
  const forDuration = getNodeDataString(node, 'for');

  return (
    <>
      <FormField label="Entity" required description="Person or device tracker to monitor">
        <EntitySelector
          value={entityId}
          onChange={(value) => onChange('entity_id', value)}
          entities={entities}
          placeholder="Select person or device tracker..."
        />
      </FormField>

      <FormField label="Zone" required description="Zone entity to check for presence">
        <Input
          type="text"
          value={zone}
          onChange={(e) => onChange('zone', e.target.value)}
          placeholder="zone.home"
        />
      </FormField>

      <FormField
        label="For Duration (optional)"
        description="How long the entity must be in the zone"
      >
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
