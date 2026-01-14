import type { FlowNode } from '@cafe/shared';
import { useEffect, useState } from 'react';
import { FormField } from '@/components/forms/FormField';
import { Combobox } from '@/components/ui/Combobox';
import { MultiEntitySelector } from '@/components/ui/MultiEntitySelector';
import { useHass } from '@/contexts/HassContext';
import type { HassEntity } from '@/types/hass';
import { getNodeDataObject, getNodeDataString } from '@/utils/nodeData';
import { ResponseVariableField } from './ResponseVariableField';
import { ServiceDataFields } from './ServiceDataFields';

interface ActionFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

export function ActionFields({ node, onChange, entities }: ActionFieldsProps) {
  const { getAllServices, getServiceDefinition } = useHass();
  const serviceName = getNodeDataString(node, 'service');
  const serviceDefinition = getServiceDefinition(serviceName);
  const serviceFields = serviceDefinition?.fields || {};
  const currentData = getNodeDataObject(node, 'data', {});
  const responseVariable = getNodeDataString(node, 'response_variable');
  const [showResponseVariable, setShowResponseVariable] = useState(!!responseVariable);

  // Keep toggle in sync if node changes externally
  useEffect(() => {
    setShowResponseVariable(!!responseVariable);
  }, [responseVariable]);

  const handleServiceChange = (value: string) => {
    onChange('service', value);
    // Clear data when service changes
    onChange('data', undefined);
  };

  const handleTargetChange = (value: string[]) => {
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

  const handleResponseVariableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange('response_variable', e.target.value === '' ? undefined : e.target.value);
  };

  const targetEntityIds =
    (getNodeDataObject(node, 'target', {}) as { entity_id?: string | string[] })?.entity_id || [];
  // Normalize to array
  const targetEntityIdArray = Array.isArray(targetEntityIds)
    ? targetEntityIds
    : targetEntityIds
      ? [targetEntityIds]
      : [];

  return (
    <>
      <FormField label="Service" required>
        <Combobox
          options={getAllServices().map(({ domain, service }) => ({
            value: `${domain}.${service}`,
            label: `${domain}.${service}`,
          }))}
          value={serviceName}
          onChange={handleServiceChange}
          placeholder="Select service..."
        />
      </FormField>

      {/* Target Entities */}
      {serviceDefinition?.target && (
        <FormField label="Target Entities">
          <MultiEntitySelector
            value={targetEntityIdArray}
            onChange={handleTargetChange}
            entities={entities}
            placeholder="Select target entities..."
          />
        </FormField>
      )}

      {/* Dynamic service fields */}
      <ServiceDataFields
        serviceFields={serviceFields}
        currentData={currentData}
        onChange={handleDataFieldChange}
      />

      {/* Response Variable (show if response exists, toggle if optional, always input if not) */}
      {serviceDefinition?.response && (
        <ResponseVariableField
          response={serviceDefinition.response}
          responseVariable={responseVariable}
          showResponseVariable={showResponseVariable}
          setShowResponseVariable={setShowResponseVariable}
          onChange={onChange}
          handleResponseVariableChange={handleResponseVariableChange}
        />
      )}
    </>
  );
}
