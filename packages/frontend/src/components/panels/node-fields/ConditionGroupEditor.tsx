import { Plus, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { EntitySelector } from '@/components/ui/EntitySelector';
import { Input } from '@/components/ui/input';
import { MultiEntitySelector } from '@/components/ui/MultiEntitySelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useHass } from '@/contexts/HassContext';
import { cn } from '@/lib/utils';
import type { ConditionNodeData } from '@/store/flow-store';
import type { HassEntity } from '@/types/hass';
import { Label } from '../../ui/label';

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
  { value: 'and', label: 'AND (All)' },
  { value: 'or', label: 'OR (Any)' },
  { value: 'not', label: 'NOT' },
];

// Logical group types that can have nested conditions
const GROUP_TYPES = ['and', 'or', 'not'];

/**
 * Renders fields specific to each condition type in a vertical layout
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
  const condType = cond.condition || 'state';

  switch (condType) {
    case 'state':
      return (
        <div className="space-y-2">
          <MultiEntitySelector
            value={
              Array.isArray(cond.entity_id)
                ? cond.entity_id
                : cond.entity_id
                  ? [cond.entity_id]
                  : []
            }
            onChange={(val) => onUpdate({ ...cond, entity_id: val.length === 1 ? val[0] : val })}
            entities={entities}
            placeholder="Select entity..."
            className="w-full"
          />
          <Input
            value={typeof cond.state === 'string' ? cond.state : ''}
            onChange={(e) => onUpdate({ ...cond, state: e.target.value })}
            placeholder="State value (e.g., on, off, home)"
          />
        </div>
      );

    case 'numeric_state':
      return (
        <div className="space-y-2">
          <MultiEntitySelector
            value={
              Array.isArray(cond.entity_id)
                ? cond.entity_id
                : cond.entity_id
                  ? [cond.entity_id]
                  : []
            }
            onChange={(val) => onUpdate({ ...cond, entity_id: val.length === 1 ? val[0] : val })}
            entities={entities}
            placeholder="Select entity..."
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={cond.above !== undefined ? String(cond.above) : ''}
              onChange={(e) =>
                onUpdate({ ...cond, above: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Above"
              type="number"
            />
            <Input
              value={cond.below !== undefined ? String(cond.below) : ''}
              onChange={(e) =>
                onUpdate({ ...cond, below: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Below"
              type="number"
            />
          </div>
        </div>
      );

    case 'template':
      return (
        <Textarea
          className="min-h-[80px] w-full font-mono text-xs"
          value={cond.template || cond.value_template || ''}
          onChange={(e) =>
            onUpdate({ ...cond, template: e.target.value, value_template: e.target.value })
          }
          placeholder="{{ states('sensor.example') == 'on' }}"
        />
      );

    case 'trigger':
      return (
        <Input
          value={((cond as Record<string, unknown>).id as string) || ''}
          onChange={(e) => onUpdate({ ...cond, id: e.target.value } as ConditionNodeData)}
          placeholder="Trigger ID (e.g., arriving, leaving)"
        />
      );

    case 'zone':
      return (
        <div className="space-y-2">
          <MultiEntitySelector
            value={
              Array.isArray(cond.entity_id)
                ? cond.entity_id
                : cond.entity_id
                  ? [cond.entity_id]
                  : []
            }
            onChange={(val) => onUpdate({ ...cond, entity_id: val.length === 1 ? val[0] : val })}
            entities={entities.filter((e) => e.entity_id.startsWith('person.'))}
            placeholder="Select person..."
            className="w-full"
          />
          <EntitySelector
            value={cond.zone || ''}
            onChange={(val) => onUpdate({ ...cond, zone: val })}
            entities={entities.filter((e) => e.entity_id.startsWith('zone.'))}
            placeholder="Select zone..."
            className="w-full"
          />
        </div>
      );

    case 'time': {
      // weekday is stored as an array, convert to/from comma-separated string
      const weekdayArray = Array.isArray(cond.weekday) ? cond.weekday : [];
      const weekdayString = weekdayArray.join(',');

      const handleWeekdayChange = (value: string) => {
        const days = value
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d.length > 0);
        onUpdate({ ...cond, weekday: days.length > 0 ? days : undefined });
      };

      return (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Label>
              <div className="mb-1 block text-muted-foreground text-xs">After</div>
              <Input
                value={cond.after || ''}
                onChange={(e) => onUpdate({ ...cond, after: e.target.value })}
                placeholder="HH:MM"
                type="time"
              />
            </Label>
            <Label>
              <div className="mb-1 block text-muted-foreground text-xs">Before</div>
              <Input
                value={cond.before || ''}
                onChange={(e) => onUpdate({ ...cond, before: e.target.value })}
                placeholder="HH:MM"
                type="time"
              />
            </Label>
          </div>
          <Label>
            <div className="mb-1 block text-muted-foreground text-xs">Weekday</div>
            <Input
              value={weekdayString}
              onChange={(e) => handleWeekdayChange(e.target.value)}
              placeholder="mon,tue,wed,thu,fri,sat,sun"
            />
          </Label>
        </div>
      );
    }

    default:
      return (
        <div className="space-y-2">
          <MultiEntitySelector
            value={
              Array.isArray(cond.entity_id)
                ? cond.entity_id
                : cond.entity_id
                  ? [cond.entity_id]
                  : []
            }
            onChange={(val) => onUpdate({ ...cond, entity_id: val.length === 1 ? val[0] : val })}
            entities={entities}
            placeholder="Select entity..."
            className="w-full"
          />
          <Input
            value={typeof cond.state === 'string' ? cond.state : ''}
            onChange={(e) => onUpdate({ ...cond, state: e.target.value })}
            placeholder="State value"
          />
        </div>
      );
  }
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
  const isGroup = GROUP_TYPES.includes(cond.condition || '');

  const handleTypeChange = (val: string) => {
    if (GROUP_TYPES.includes(val)) {
      onUpdate({ condition: val, conditions: [] });
    } else if (val === 'template') {
      onUpdate({ condition: val, template: '', value_template: '' });
    } else if (val === 'trigger') {
      onUpdate({ condition: val, id: '' } as ConditionNodeData);
    } else if (val === 'numeric_state') {
      onUpdate({ condition: val, entity_id: '' });
    } else {
      onUpdate({ condition: val, entity_id: '', state: '' });
    }
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
