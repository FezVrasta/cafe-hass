import type { FlowNode } from '@hflow/shared';
import { FormField } from '@/components/forms/FormField';
import { EntitySelector } from '@/components/ui/EntitySelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HassEntity } from '@/hooks/useHass';
import { useHass } from '@/hooks/useHass';
import { getNodeDataObject, getNodeDataString } from '@/utils/nodeData';
import { ServiceDataFields } from './ServiceDataFields';

interface ActionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Action node field component.
 * Handles service selection and dynamic service data fields.
 * Replaces the 119-line inline action field rendering.
 */
export function ActionFields({ node, onChange, entities }: ActionFieldsProps) {
  const { getAllServices, getServiceDefinition } = useHass();
  const serviceName = getNodeDataString(node, 'service');
  const serviceDefinition = getServiceDefinition(serviceName);
  const serviceFields = serviceDefinition?.fields || {};
  const currentData = getNodeDataObject(node, 'data', {});

  const handleServiceChange = (value: string) => {
    onChange('service', value);
    // Clear data when service changes
    onChange('data', undefined);
  };

  const handleTargetChange = (value: string) => {
    const currentTarget = getNodeDataObject(node, 'target', {});
    onChange('target', { ...currentTarget, entity_id: value });
  };

  const handleDataFieldChange = (fieldName: string, value: unknown) => {
    const newData = { ...currentData, [fieldName]: value === '' ? undefined : value };
    // Clean up undefined values
    const cleanedData = Object.fromEntries(
      Object.entries(newData).filter(([, v]) => v !== undefined && v !== '')
    );
    onChange('data', Object.keys(cleanedData).length > 0 ? cleanedData : undefined);
  };

  const targetEntityId =
    (getNodeDataObject(node, 'target', {}) as { entity_id?: string })?.entity_id || '';

  return (
    <>
      <FormField label="Service" required>
        <Select value={serviceName} onValueChange={handleServiceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select service..." />
          </SelectTrigger>
          <SelectContent>
            {getAllServices().map(({ domain, service }) => (
              <SelectItem key={`${domain}.${service}`} value={`${domain}.${service}`}>
                {domain}.{service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Target Entity */}
      {serviceDefinition?.target && (
        <FormField label="Target Entity">
          <EntitySelector
            value={targetEntityId}
            onChange={handleTargetChange}
            entities={entities}
            placeholder="Select target entity..."
          />
        </FormField>
      )}

      {/* Dynamic service fields */}
      <ServiceDataFields
        serviceFields={serviceFields}
        currentData={currentData}
        onChange={handleDataFieldChange}
      />
    </>
  );
}
