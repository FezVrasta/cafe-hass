import { memo } from 'react';
import { useHass } from '@/hooks/useHass';
import { EntitySelector } from '@/components/ui/EntitySelector';
import type { ConditionNodeData } from '@/store/flow-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface ConditionGroupEditorProps {
  conditions: ConditionNodeData[];
  onChange: (newConditions: ConditionNodeData[]) => void;
  parentType: 'and' | 'or' | 'not';
  depth?: number;
}

const CONDITION_TYPES = [
  { value: 'state', label: 'State' },
  { value: 'and', label: 'AND' },
  { value: 'or', label: 'OR' },
  { value: 'not', label: 'NOT' },
  // Add more types as needed
];

export const ConditionGroupEditor = memo(function ConditionGroupEditor({
  conditions,
  onChange,
  depth = 0,
}: ConditionGroupEditorProps) {
  // Add a new empty condition
  const handleAdd = () => {
    onChange([...conditions, { condition_type: 'state', entity_id: '', state: '' }]);
  };

  // Remove a condition at index
  const handleRemove = (idx: number) => {
    onChange(conditions.filter((_, i) => i !== idx));
  };

  // Update a nested condition
  const handleUpdate = (idx: number, newCond: ConditionNodeData) => {
    onChange(conditions.map((c, i) => (i === idx ? newCond : c)));
  };

  return (
    <div className={cn('ml-2 border-l pl-2 space-y-2', depth > 0 && 'mt-2')}>
      {conditions.map((cond, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          {/* Recursive: if this is a group, render another ConditionGroupEditor */}
          {typeof cond.condition_type === 'string' &&
          ['and', 'or', 'not'].includes(cond.condition_type) &&
          Array.isArray(cond.conditions) ? (
            <div className="flex-1">
              <div className="font-semibold text-xs mb-1">{cond.condition_type.toUpperCase()}</div>
              <ConditionGroupEditor
                conditions={cond.conditions as ConditionNodeData[]}
                onChange={(newConds) => handleUpdate(idx, { ...cond, conditions: newConds })}
                parentType={cond.condition_type as 'and' | 'or' | 'not'}
                depth={depth + 1}
              />
            </div>
          ) : (
            <div className="flex-1 flex gap-1 items-center">
              <Select
                value={cond.condition_type || 'state'}
                onValueChange={(val) => {
                  if (['and', 'or', 'not'].includes(val)) {
                    handleUpdate(idx, {
                      condition_type: val,
                      conditions: Array.isArray(cond.conditions) ? cond.conditions : [],
                    });
                  } else {
                    handleUpdate(idx, { condition_type: val, entity_id: '', state: '' });
                  }
                }}
              >
                <SelectTrigger className="w-20">
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
              {/* If not a group, show entity_id/state fields */}
              {typeof cond.condition_type !== 'string' ||
              !['and', 'or', 'not'].includes(cond.condition_type) ? (
                <>
                  {/* EntitySelector for entity_id */}
                  <EntitySelector
                    value={cond.entity_id || ''}
                    onChange={(val) => handleUpdate(idx, { ...cond, entity_id: val })}
                    entities={useHass().hass ? Object.values(useHass().hass.states) : []}
                    placeholder="Select entity"
                    className="min-w-36 mr-1 flex-1"
                  />
                  {/* shadcn Input for state */}
                  <Input
                    className="w-24 text-xs"
                    value={cond.state || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleUpdate(idx, { ...cond, state: e.target.value })
                    }
                    placeholder="state"
                  />
                </>
              ) : null}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => handleRemove(idx)}>
            -
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={handleAdd} className="mt-1">
        + Add Condition
      </Button>
    </div>
  );
});
