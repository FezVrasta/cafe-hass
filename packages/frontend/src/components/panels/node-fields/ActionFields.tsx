import type { FlowNode } from '@cafe/shared';
import { PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/input';
import { MultiEntitySelector } from '@/components/ui/MultiEntitySelector';
import { useHass } from '@/contexts/HassContext';
import { cn } from '@/lib/utils';
import type { HassEntity } from '@/types/hass';
import { getNodeDataObject, getNodeDataString } from '@/utils/nodeData';
import { ResponseVariableField } from './ResponseVariableField';
import { ServiceDataFields } from './ServiceDataFields';

/**
 * Simple component for managing a list of IDs (device_id, area_id)
 */
function TargetIdList({
  values,
  onChange,
  placeholder = 'Add ID...',
  className,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputValue('');
    }
  };

  const handleRemove = (id: string) => {
    onChange(values.filter((v) => v !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-1">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 font-mono text-xs"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((id) => (
            <span
              key={id}
              className="inline-flex items-center rounded border bg-muted px-2 py-0.5 font-mono text-muted-foreground text-xs"
            >
              {id}
              <XIcon
                className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => handleRemove(id)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const handleEntityTargetChange = (value: string[]) => {
    const currentTarget = getNodeDataObject(node, 'target', {});
    const newTarget = { ...currentTarget, entity_id: value.length > 0 ? value : undefined };
    // Clean up empty arrays/undefined values
    if (!newTarget.entity_id) delete newTarget.entity_id;
    onChange('target', Object.keys(newTarget).length > 0 ? newTarget : undefined);
  };

  const handleDeviceTargetChange = (value: string[]) => {
    const currentTarget = getNodeDataObject(node, 'target', {});
    const newTarget = { ...currentTarget, device_id: value.length > 0 ? value : undefined };
    if (!newTarget.device_id) delete newTarget.device_id;
    onChange('target', Object.keys(newTarget).length > 0 ? newTarget : undefined);
  };

  const handleAreaTargetChange = (value: string[]) => {
    const currentTarget = getNodeDataObject(node, 'target', {});
    const newTarget = { ...currentTarget, area_id: value.length > 0 ? value : undefined };
    if (!newTarget.area_id) delete newTarget.area_id;
    onChange('target', Object.keys(newTarget).length > 0 ? newTarget : undefined);
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

  // Extract target values (entity_id, device_id, area_id)
  const target = getNodeDataObject(node, 'target', {}) as {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };

  // Helper to normalize string | string[] to string[]
  const normalizeToArray = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const targetEntityIdArray = normalizeToArray(target.entity_id);
  const targetDeviceIdArray = normalizeToArray(target.device_id);
  const targetAreaIdArray = normalizeToArray(target.area_id);

  // Check if we have any device or area targets (to show those fields)
  const hasDeviceTargets = targetDeviceIdArray.length > 0;
  const hasAreaTargets = targetAreaIdArray.length > 0;

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
      {(serviceDefinition?.target || targetEntityIdArray.length > 0) && (
        <FormField label="Target Entities">
          <MultiEntitySelector
            value={targetEntityIdArray}
            onChange={handleEntityTargetChange}
            entities={entities}
            placeholder="Select target entities..."
          />
        </FormField>
      )}

      {/* Target Devices - show if we have device targets or service supports targets */}
      {(hasDeviceTargets || serviceDefinition?.target) && (
        <FormField label="Target Devices" description="Device IDs to target">
          <TargetIdList
            values={targetDeviceIdArray}
            onChange={handleDeviceTargetChange}
            placeholder="Add device ID..."
          />
        </FormField>
      )}

      {/* Target Areas - show if we have area targets or service supports targets */}
      {(hasAreaTargets || serviceDefinition?.target) && (
        <FormField label="Target Areas" description="Area IDs to target">
          <TargetIdList
            values={targetAreaIdArray}
            onChange={handleAreaTargetChange}
            placeholder="Add area ID..."
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
