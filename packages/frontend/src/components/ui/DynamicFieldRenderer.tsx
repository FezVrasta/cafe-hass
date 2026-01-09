import { EntitySelector } from '@/components/ui/EntitySelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { FieldConfig } from '@/config/triggerFields';
import type { TriggerField } from '@/hooks/useDeviceAutomation';
import type { HassEntity } from '@/hooks/useHass';

interface DynamicFieldRendererProps {
  /**
   * Field configuration (from static config or API)
   */
  field: FieldConfig | TriggerField;

  /**
   * Current value of the field
   */
  value: unknown;

  /**
   * Callback when value changes
   */
  onChange: (value: unknown) => void;

  /**
   * Available entities (for entity selector)
   */
  entities?: HassEntity[];

  /**
   * Domain for translation lookups (e.g., 'knx', 'zwave')
   */
  domain?: string;

  /**
   * Translation resources from Home Assistant
   */
  translations?: Record<string, string>;
}

/**
 * Renders a form field based on configuration
 * Supports both static field configs and dynamic API schemas
 */
export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  entities = [],
  domain,
  translations = {},
}: DynamicFieldRendererProps) {
  // Extract common properties
  const name = field.name;
  const required = field.required ?? false;

  // Get label and description
  let label = name;
  let description = '';
  let placeholder = '';

  if ('label' in field) {
    // Static FieldConfig
    label = field.label;
    description = field.description || '';
    placeholder = field.placeholder || '';
  } else {
    // Dynamic TriggerField from API
    // Try to get label from translations first
    if (domain) {
      const labelKey = `component.${domain}.device_automation.extra_fields.${name}`;
      const descKey = `component.${domain}.device_automation.extra_fields_descriptions.${name}`;

      label =
        translations[labelKey] ||
        name
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

      description = translations[descKey] || '';

      console.log(`Field "${name}" in domain "${domain}":`);
      console.log(`  Label key: ${labelKey} = ${translations[labelKey] || '(not found)'}`);
      console.log(`  Desc key: ${descKey} = ${translations[descKey] || '(not found)'}`);
      console.log(`  Final label: ${label}`);
      console.log(`  Final description: ${description}`);
    } else {
      // Fallback: format the name nicely
      label = name
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      console.log(`Field "${name}" with no domain - using formatted name: ${label}`);
    }
  }

  // Determine selector type
  let selectorType: string | null = null;
  let selectorConfig: Record<string, unknown> = {};

  if ('type' in field) {
    // Static FieldConfig
    selectorType = field.type;
  } else if ('selector' in field && field.selector) {
    // Dynamic TriggerField from API
    const selectorKeys = Object.keys(field.selector);
    if (selectorKeys.length > 0) {
      selectorType = selectorKeys[0];
      const selector = field.selector as Record<string, unknown>;
      selectorConfig = (selector[selectorType] as Record<string, unknown>) || {};
    }
  }

  // Helper to get string value safely
  const stringValue = typeof value === 'string' ? value : String(value ?? '');
  const numberValue = typeof value === 'number' ? value : Number(value) || undefined;
  const booleanValue = typeof value === 'boolean' ? value : Boolean(value);

  // Render based on selector type
  const renderField = () => {
    switch (selectorType) {
      // Text input
      case 'text':
        return (
          <Input
            type="text"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
          />
        );

      // Number input
      case 'number':
        return (
          <Input
            type="number"
            value={numberValue ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={placeholder}
            required={required}
          />
        );

      // Boolean toggle
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch checked={booleanValue} onCheckedChange={onChange} />
            <span className="text-muted-foreground text-sm">
              {booleanValue ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );

      // Select dropdown
      case 'select': {
        // Get options from static config or API config
        let options: Array<{ value: string; label: string }> = [];

        if ('options' in field && field.options) {
          // Static config options
          options = field.options;
        } else if (selectorConfig.options && Array.isArray(selectorConfig.options)) {
          // API config options
          options = selectorConfig.options as Array<{ value: string; label: string }>;
        }

        const multiple = selectorConfig.multiple === true;

        if (multiple) {
          // Multi-select dropdown
          const values = Array.isArray(value) ? value : value ? [value] : [];

          return (
            <div className="space-y-2">
              <Select
                value={values.length > 0 ? values[0] : ''}
                onValueChange={(selectedValue) => {
                  // Toggle the value in the array
                  if (values.includes(selectedValue)) {
                    onChange(values.filter((v) => v !== selectedValue));
                  } else {
                    onChange([...values, selectedValue]);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {values.length === 0 ? (
                      <span className="text-muted-foreground">
                        {placeholder || 'Select items...'}
                      </span>
                    ) : values.length === 1 ? (
                      options.find((o) => o.value === values[0])?.label || values[0]
                    ) : (
                      `${values.length} items selected`
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                  {options.map((option) => {
                    const isSelected = values.includes(option.value);
                    return (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className={isSelected ? 'bg-accent' : ''}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              // Handle multi-select toggle
                              const currentValues = Array.isArray(value) ? value : [];
                              const newValues = e.target.checked 
                                ? [...currentValues, option.value]
                                : currentValues.filter(v => v !== option.value);
                              onChange(newValues);
                            }}
                            className="h-4 w-4"
                          />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {values.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {values.map((val) => {
                    const option = options.find((o) => o.value === val);
                    return (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
                      >
                        {option?.label || val}
                        <button
                          type="button"
                          onClick={() => onChange(values.filter((v) => v !== val))}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <Select value={stringValue} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      // Entity picker
      case 'entity':
        return (
          <EntitySelector
            value={stringValue}
            onChange={onChange}
            entities={entities}
            placeholder={placeholder || 'Select entity...'}
          />
        );

      // Template editor
      case 'template':
        return (
          <Textarea
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Enter Jinja2 template...'}
            className="font-mono text-sm"
            rows={4}
            required={required}
          />
        );

      // Duration input (HH:MM:SS format)
      case 'duration':
        return (
          <Input
            type="text"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || '00:05:00'}
            pattern="^\d{2}:\d{2}:\d{2}$"
            title="Format: HH:MM:SS"
            required={required}
          />
        );

      // Object/JSON input
      case 'object':
        return (
          <Textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : stringValue}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value);
              }
            }}
            placeholder={placeholder || '{ "key": "value" }'}
            className="font-mono text-sm"
            rows={4}
            required={required}
          />
        );

      // Time input
      case 'time':
        return (
          <Input
            type="time"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            required={required}
          />
        );

      // Date input
      case 'date':
        return (
          <Input
            type="date"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            required={required}
          />
        );

      // Fallback: text input
      default:
        return (
          <Input
            type="text"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || `Enter ${name}...`}
            required={required}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <Label className="font-medium text-muted-foreground text-xs">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {renderField()}
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
    </div>
  );
}
