import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ServiceField {
  name?: string;
  description?: string;
  example?: unknown;
  required?: boolean;
  selector?: Record<string, unknown>;
}

interface ServiceDataFieldsProps {
  serviceFields: Record<string, ServiceField>;
  currentData: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}

/**
 * Renders dynamic service data fields based on service definition.
 * Replaces the duplicated service field rendering logic.
 */
export function ServiceDataFields({
  serviceFields,
  currentData,
  onChange,
}: ServiceDataFieldsProps) {
  if (Object.keys(serviceFields).length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3">
      <h4 className="mb-3 font-semibold text-muted-foreground text-xs">Service Data</h4>
      {Object.entries(serviceFields).map(([fieldName, field]) => {
        const selector = field.selector || {};
        const selectorType = Object.keys(selector)[0];
        const selectorConfig = selector[selectorType] || {};
        const currentValue = currentData[fieldName] as string | number | boolean | undefined;

        // Use field.name if available, otherwise format fieldName as label
        const fieldLabel =
          field.name || fieldName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        // Render input based on selector type
        if (selectorType === 'number') {
          const config = selectorConfig as {
            min?: number;
            max?: number;
            unit_of_measurement?: string;
          };

          return (
            <FormField
              key={fieldName}
              label={`${fieldLabel}${config.unit_of_measurement ? ` (${config.unit_of_measurement})` : ''}`}
              required={field.required}
              description={field.description}
            >
              <Input
                type="number"
                value={(currentValue as number) ?? ''}
                onChange={(e) => onChange(fieldName, e.target.value ? Number(e.target.value) : '')}
                min={config.min}
                max={config.max}
                placeholder={field.example !== undefined ? String(field.example) : ''}
              />
            </FormField>
          );
        }

        if (selectorType === 'select') {
          const config = selectorConfig as { options?: string[] };

          return (
            <FormField
              key={fieldName}
              label={fieldLabel}
              required={field.required}
              description={field.description}
            >
              <Select
                value={String(currentValue === '' ? '__NONE__' : (currentValue ?? '__NONE__'))}
                onValueChange={(value) => onChange(fieldName, value === '__NONE__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">None</SelectItem>
                  {config.options?.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          );
        }

        if (selectorType === 'boolean') {
          return (
            <div key={fieldName} className="mb-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={(currentValue as boolean) ?? false}
                onChange={(e) => onChange(fieldName, e.target.checked)}
                className="rounded"
              />
              <Label className="font-medium text-muted-foreground text-xs">
                {fieldLabel}
                {field.required && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
              {field.description && (
                <p className="text-muted-foreground text-xs">{field.description}</p>
              )}
            </div>
          );
        }

        // Default: text input (for text, color_rgb, etc.)
        return (
          <FormField
            key={fieldName}
            label={fieldLabel}
            required={field.required}
            description={field.description}
          >
            <Input
              type="text"
              value={(currentValue as string) ?? ''}
              onChange={(e) => onChange(fieldName, e.target.value)}
              placeholder={field.example !== undefined ? String(field.example) : ''}
            />
          </FormField>
        );
      })}
    </div>
  );
}
