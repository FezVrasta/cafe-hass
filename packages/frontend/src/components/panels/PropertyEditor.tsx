import type { FlowNode } from '@hflow/shared';
import { Plus, Trash2 } from 'lucide-react';
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
      alert(error instanceof Error ? error.message : 'Failed to add property');
    }
  };

  return (
    <div className="space-y-3">
      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium text-muted-foreground text-xs">Additional Properties</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={editor.startAdding}
            className="h-6 px-2 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {/* Add new property form */}
      {editor.state.isAdding && (
        <div className="space-y-2 rounded border p-3">
          <FormField label="Property Name" required>
            <Input
              type="text"
              value={editor.state.key}
              onChange={(e) => editor.setKey(e.target.value)}
              placeholder="e.g., my_custom_property"
            />
          </FormField>

          <FormField label="Type">
            <Select
              value={editor.state.type}
              onValueChange={(value: PropertyType) => editor.setType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="array">Array (JSON)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Value">
            {editor.state.type === 'boolean' ? (
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editor.state.value === 'true'}
                  onCheckedChange={(checked) => editor.setValue(checked ? 'true' : 'false')}
                />
                <Label className="text-sm">
                  {editor.state.value === 'true' ? 'True' : 'False'}
                </Label>
              </div>
            ) : editor.state.type === 'array' ? (
              <Textarea
                value={editor.state.value}
                onChange={(e) => editor.setValue(e.target.value)}
                placeholder='["item1", "item2"]'
                className="font-mono"
                rows={2}
              />
            ) : (
              <Input
                type={editor.state.type === 'number' ? 'number' : 'text'}
                value={editor.state.value}
                onChange={(e) => editor.setValue(e.target.value)}
                placeholder={editor.state.type === 'number' ? '123' : 'Enter value'}
              />
            )}
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={editor.cancelAdding}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd}>
              Add Property
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
          <Switch checked={value as boolean} onCheckedChange={(checked) => onChange(checked)} />
          <Label className="text-sm">{value ? 'True' : 'False'}</Label>
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
          placeholder="JSON array"
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
          placeholder="JSON object"
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
          placeholder={`Enter ${typeof value}`}
        />
      )}
    </div>
  );
}
