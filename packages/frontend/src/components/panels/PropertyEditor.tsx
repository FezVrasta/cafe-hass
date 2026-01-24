import type { FlowNode } from '@cafe/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
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
import { type PropertyType, usePropertyEditor } from '@/hooks/usePropertyEditor';

interface PropertyEditorProps {
  node: FlowNode;
  handledProperties: Set<string>;
  onChange: (key: string, value: unknown) => void;
  onDelete: (key: string) => void;
}

/**
 * Property editor component for managing additional/unhandled properties.
 * Extracts the 150-line "Additional Properties" section from PropertyPanel.
 */
export function PropertyEditor({
  node,
  handledProperties,
  onChange,
  onDelete,
}: PropertyEditorProps) {
  const { t } = useTranslation(['common', 'nodes', 'errors']);
  const handlePropertyAdd = (key: string, value: unknown) => {
    onChange(key, value);
  };

  const editor = usePropertyEditor(handlePropertyAdd);

  const data = node.data as Record<string, unknown>;

  // Get unhandled properties
  const unhandledProperties = Object.entries(data).filter(
    ([key, value]) =>
      !handledProperties.has(key) && value !== undefined && value !== null && value !== ''
  );

  // Don't render if no properties and not adding
  if (unhandledProperties.length === 0 && !editor.state.isAdding) {
    return null;
  }

  const handleAdd = () => {
    try {
      editor.handleAdd();
    } catch (error) {
      alert(error instanceof Error ? error.message : t('errors:properties.addFailed'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium text-muted-foreground text-xs">
            {t('nodes:panel.additionalProperties')}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={editor.startAdding}
            className="h-6 px-2 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('buttons.add')}
          </Button>
        </div>
      </div>

      {/* Add new property form */}
      {editor.state.isAdding && (
        <div className="space-y-2 rounded border p-3">
          <FormField label={t('nodes:panel.propertyName')} required>
            <Input
              type="text"
              value={editor.state.key}
              onChange={(e) => editor.setKey(e.target.value)}
              placeholder={t('nodes:placeholders.customProperty')}
            />
          </FormField>

          <FormField label={t('nodes:panel.type')}>
            <Select
              value={editor.state.type}
              onValueChange={(value: PropertyType) => editor.setType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">{t('nodes:triggers.dataTypes.string')}</SelectItem>
                <SelectItem value="number">{t('nodes:triggers.dataTypes.number')}</SelectItem>
                <SelectItem value="boolean">{t('nodes:triggers.dataTypes.boolean')}</SelectItem>
                <SelectItem value="array">{t('nodes:triggers.dataTypes.json')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t('nodes:panel.value')}>
            {editor.state.type === 'boolean' ? (
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editor.state.value === 'true'}
                  onCheckedChange={(checked) => editor.setValue(checked ? 'true' : 'false')}
                />
                <Label className="text-sm">
                  {editor.state.value === 'true' ? t('boolean.true') : t('boolean.false')}
                </Label>
              </div>
            ) : editor.state.type === 'array' ? (
              <Textarea
                value={editor.state.value}
                onChange={(e) => editor.setValue(e.target.value)}
                placeholder={t('nodes:placeholders.jsonArray')}
                className="font-mono"
                rows={2}
              />
            ) : (
              <Input
                type={editor.state.type === 'number' ? 'number' : 'text'}
                value={editor.state.value}
                onChange={(e) => editor.setValue(e.target.value)}
                placeholder={
                  editor.state.type === 'number'
                    ? t('nodes:placeholders.number')
                    : t('nodes:placeholders.enterValue')
                }
              />
            )}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={editor.cancelAdding}>
              {t('buttons.cancel')}
            </Button>
            <Button size="sm" onClick={handleAdd}>
              {t('nodes:panel.addProperty')}
            </Button>
          </div>
        </div>
      )}

      {/* Display existing unhandled properties */}
      {unhandledProperties.map(([key, value]) => (
        <PropertyDisplay
          key={key}
          name={key}
          value={value}
          onChange={(newValue) => onChange(key, newValue)}
          onDelete={() => onDelete(key)}
        />
      ))}
    </div>
  );
}

interface PropertyDisplayProps {
  name: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onDelete: () => void;
}

/**
 * Component for displaying and editing a single property.
 */
function PropertyDisplay({ name, value, onChange, onDelete }: PropertyDisplayProps) {
  const { t } = useTranslation(['common', 'nodes']);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="font-medium text-muted-foreground text-xs capitalize">
          {name.replace(/_/g, ' ')}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {typeof value === 'boolean' ? (
        <div className="flex items-center space-x-2">
          <Switch checked={value} onCheckedChange={(checked) => onChange(checked)} />
          <Label className="text-sm">{value ? t('boolean.true') : t('boolean.false')}</Label>
        </div>
      ) : Array.isArray(value) ? (
        <Textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              // Invalid JSON, don't update
            }
          }}
          className="font-mono"
          rows={Math.min(value.length + 1, 4)}
          placeholder={t('nodes:placeholders.jsonArray')}
        />
      ) : typeof value === 'object' ? (
        <Textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              // Invalid JSON, don't update
            }
          }}
          className="font-mono"
          rows={4}
          placeholder={t('nodes:placeholders.jsonObject')}
        />
      ) : (
        <Input
          type="text"
          value={String(value)}
          onChange={(e) => {
            // Try to preserve the original type
            const newValue = e.target.value;
            if (typeof value === 'number') {
              const num = Number(newValue);
              if (!Number.isNaN(num)) {
                onChange(num);
              }
            } else {
              onChange(newValue);
            }
          }}
          placeholder={t('nodes:placeholders.enterType', {
            type: typeof value,
          })}
        />
      )}
    </div>
  );
}
