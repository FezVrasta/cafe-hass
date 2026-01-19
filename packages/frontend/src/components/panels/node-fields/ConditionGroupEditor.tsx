import type { ConditionType } from '@cafe/shared';
import { Plus, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getConditionDefaults,
  getConditionFields,
  isLogicalGroupType,
} from '@/config/conditionFields';
import { useHass } from '@/contexts/HassContext';
import { cn } from '@/lib/utils';
import type { ConditionNodeData } from '@/store/flow-store';
import type { HassEntity } from '@/types/hass';

interface ConditionGroupEditorProps {
  conditions: ConditionNodeData[];
  onChange: (newConditions: ConditionNodeData[]) => void;
  parentType: 'and' | 'or' | 'not';
  depth?: number;
}

const CONDITION_TYPES = [
  { value: 'state', label: 'State' },
  { value: 'numeric_state', label: 'Numeric State' },
  { value: 'template', label: 'Template' },
  { value: 'trigger', label: 'Trigger' },
  { value: 'zone', label: 'Zone' },
  { value: 'time', label: 'Time' },
  { value: 'sun', label: 'Sun' },
  { value: 'and', label: 'AND (All)' },
  { value: 'or', label: 'OR (Any)' },
  { value: 'not', label: 'NOT' },
];

/**
 * Renders fields for a condition type using the shared config from conditionFields.ts
 */
function ConditionTypeFields({
  cond,
  onUpdate,
  entities,
}: {
  cond: ConditionNodeData;
  onUpdate: (newCond: ConditionNodeData) => void;
  entities: HassEntity[];
}) {
  const condType = (cond.condition || 'state') as ConditionType;
  const fields = getConditionFields(condType);

  // No fields for this condition type (e.g., device handled elsewhere)
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <DynamicFieldRenderer
          key={field.name}
          field={field}
          value={(cond as Record<string, unknown>)[field.name]}
          onChange={(value) => onUpdate({ ...cond, [field.name]: value })}
          entities={entities}
        />
      ))}
    </div>
  );
}

/**
 * Single condition item card
 */
function ConditionCard({
  cond,
  onUpdate,
  onRemove,
  entities,
  depth,
}: {
  cond: ConditionNodeData;
  onUpdate: (newCond: ConditionNodeData) => void;
  onRemove: () => void;
  entities: HassEntity[];
  depth: number;
}) {
  const condType = (cond.condition || 'state') as ConditionType;
  const isGroup = isLogicalGroupType(condType);

  const handleTypeChange = (val: string) => {
    onUpdate(getConditionDefaults(val as ConditionType) as ConditionNodeData);
  };

  return (
    <div className={cn('space-y-3 rounded-md border bg-card p-3', depth > 0 && 'bg-muted/30')}>
      {/* Header row: type selector and delete button */}
      <div className="flex items-center justify-between gap-2">
        <Select value={cond.condition || 'state'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full max-w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_TYPES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Condition-specific fields */}
      {isGroup ? (
        <ConditionGroupEditor
          conditions={(cond.conditions as ConditionNodeData[]) || []}
          onChange={(newConds) => onUpdate({ ...cond, conditions: newConds })}
          parentType={cond.condition as 'and' | 'or' | 'not'}
          depth={depth + 1}
        />
      ) : (
        <ConditionTypeFields cond={cond} onUpdate={onUpdate} entities={entities} />
      )}
    </div>
  );
}

export const ConditionGroupEditor = memo(function ConditionGroupEditor({
  conditions,
  onChange,
  depth = 0,
}: ConditionGroupEditorProps) {
  const { hass } = useHass();
  const entities = hass ? Object.values(hass.states) : [];

  const handleAdd = () => {
    onChange([...conditions, { condition: 'state', entity_id: '', state: '' }]);
  };

  const handleRemove = (idx: number) => {
    onChange(conditions.filter((_, i) => i !== idx));
  };

  const handleUpdate = (idx: number, newCond: ConditionNodeData) => {
    onChange(conditions.map((c, i) => (i === idx ? newCond : c)));
  };

  return (
    <div className={cn('space-y-2', depth > 0 && 'border-muted border-l-2 pl-2')}>
      {conditions.length === 0 ? (
        <p className="py-2 text-muted-foreground text-xs italic">No conditions added yet</p>
      ) : (
        conditions.map((cond, idx) => (
          <ConditionCard
            key={idx}
            cond={cond}
            onUpdate={(newCond) => handleUpdate(idx, newCond)}
            onRemove={() => handleRemove(idx)}
            entities={entities}
            depth={depth}
          />
        ))
      )}
      <Button size="sm" variant="outline" onClick={handleAdd} className="w-full">
        <Plus className="mr-1 h-4 w-4" />
        Add Condition
      </Button>
    </div>
  );
});
