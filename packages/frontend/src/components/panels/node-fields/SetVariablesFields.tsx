import type { SetVariablesNode } from '@cafe/shared';
import { Plus, Trash2 } from 'lucide-react';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getNodeDataObject } from '@/utils/nodeData';

interface SetVariablesFieldsProps {
  node: SetVariablesNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Set Variables node field component.
 * Allows defining one or more variable names and their values.
 */
export function SetVariablesFields({ node, onChange }: SetVariablesFieldsProps) {
  const variables = getNodeDataObject<Record<string, unknown>>(node, 'variables', {});
  const variableEntries = Object.entries(variables);

  const handleAddVariable = () => {
    // Generate a unique key for the new variable
    const existingKeys = Object.keys(variables);
    let newKey = 'variable';
    let counter = 1;
    while (existingKeys.includes(newKey)) {
      newKey = `variable_${counter}`;
      counter++;
    }
    onChange('variables', { ...variables, [newKey]: '' });
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;

    // Build new variables object preserving order but with renamed key
    const newVariables: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (key === oldKey) {
        newVariables[newKey] = value;
      } else {
        newVariables[key] = value;
      }
    }
    onChange('variables', newVariables);
  };

  const handleValueChange = (key: string, value: string) => {
    onChange('variables', { ...variables, [key]: value });
  };

  const handleDeleteVariable = (keyToDelete: string) => {
    const newVariables = { ...variables };
    delete newVariables[keyToDelete];
    onChange('variables', newVariables);
  };

  return (
    <div className="space-y-4">
      {variableEntries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No variables defined. Click the button below to add one.
        </p>
      ) : (
        variableEntries.map(([key, value], index) => (
          <div key={`${key}-${index}`} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-muted-foreground text-xs">
                Variable {index + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteVariable(key)}
                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-3">
              <FormField label="Name">
                <Input
                  value={key}
                  onChange={(e) => handleKeyChange(key, e.target.value)}
                  placeholder="variable_name"
                  className="font-mono text-sm"
                />
              </FormField>

              <FormField label="Value" description="Value or Jinja2 template expression">
                <Textarea
                  value={String(value ?? '')}
                  onChange={(e) => handleValueChange(key, e.target.value)}
                  placeholder="value or {{ template }}"
                  className="font-mono text-sm"
                />
              </FormField>
            </div>
          </div>
        ))
      )}

      <Button variant="outline" onClick={handleAddVariable} className="w-full gap-2" size="sm">
        <Plus className="h-4 w-4" />
        Add Variable
      </Button>
    </div>
  );
}
