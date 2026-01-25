import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntitySelector } from '@/components/ui/EntitySelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiEntitySelector } from '@/components/ui/MultiEntitySelector';
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
import type { HassEntity } from '@/types/hass';

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
   * Available entities (for entity selector).
   * Optional - EntitySelector will auto-fetch from useHass() if not provided.
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
  entities,
  domain,
  translations = {},
}: DynamicFieldRendererProps) {
  const { t } = useTranslation(['common']);
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

  if ('type' in field && field.type) {
    // Static FieldConfig or TriggerField with type
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
              {booleanValue ? t('dynamicField.enabled') : t('dynamicField.disabled')}
            </span>
          </div>
        );

      // Select dropdown
      case 'select': {
        // Get options from static config or API config
        let options: Array<{ value: string; label: string }> = [];

        if ('options' in field && field.options) {
          // Options can be tuple format [value, label][] from HA API or object format from static config
          const rawOptions = field.options;
          if (rawOptions.length > 0) {
            // Check if it's tuple format (HA API returns [["value", "label"], ...])
            if (Array.isArray(rawOptions[0])) {
              options = (rawOptions as [string, string][]).map(([value, label]) => ({
                value,
                label,
              }));
            } else {
              // Object format from static config
              options = rawOptions as Array<{ value: string; label: string }>;
            }
          }
        } else if (selectorConfig.options && Array.isArray(selectorConfig.options)) {
          // API config options
          options = selectorConfig.options as Array<{ value: string; label: string }>;
        }

        const multiple =
          ('multiple' in field && field.multiple) || selectorConfig.multiple === true;

        if (multiple) {
          // Multi-select dropdown with checkboxes
          const values = Array.isArray(value)
            ? (value as string[])
            : value
              ? [value as string]
              : [];

          const getDisplayText = () => {
            if (values.length === 0) {
              return placeholder || t('dynamicField.selectItems');
            }
            if (values.length === 1) {
              return options.find((o) => o.value === values[0])?.label || values[0];
            }
            return t('dynamicField.itemsSelected', { count: values.length });
          };

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className={values.length === 0 ? 'text-muted-foreground' : ''}>
                    {getDisplayText()}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {options.map((option) => {
                  const isSelected = values.includes(option.value);
                  return (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChange([...values, option.value]);
                        } else {
                          onChange(values.filter((v) => v !== option.value));
                        }
                      }}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
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
      case 'entity': {
        // Check for multiple entities support from both static and dynamic configs
        const isMultiple =
          ('multiple' in field && field.multiple) || selectorConfig.multiple === true;

        if (isMultiple) {
          // Coerce value to an array, handling both strings and existing arrays
          const values = Array.isArray(value)
            ? value
            : typeof value === 'string' && value
              ? value.split(',').map((s) => s.trim())
              : [];

          return (
            <MultiEntitySelector
              value={values}
              onChange={onChange}
              entities={entities}
              placeholder={placeholder || t('dynamicField.selectEntities')}
            />
          );
        }

        return (
          <EntitySelector
            value={stringValue}
            onChange={onChange}
            entities={entities}
            placeholder={placeholder || t('dynamicField.selectEntity')}
          />
        );
      }

      // Template editor
      case 'template':
        return (
          <Textarea
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || t('placeholders.enterTemplate')}
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
            placeholder={placeholder || t('placeholders.duration')}
            pattern="^\d{2}:\d{2}:\d{2}$"
            title={t('dynamicField.formatHMS')}
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
            placeholder={placeholder || t('placeholders.jsonExample')}
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
            placeholder={placeholder || t('dynamicField.enterValue', { name })}
            required={required}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <Label className="font-medium text-muted-foreground text-xs">
        {label}
        {required && <span className="ml-1 text-destructive">{t('labels.requiredAsterisk')}</span>}
      </Label>
      {renderField()}
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
    </div>
  );
}
