import { XIcon } from 'lucide-react';
import type { HassEntity } from '@/hooks/useHass';
import { cn } from '@/lib/utils';
import { EntitySelector } from './EntitySelector';

interface MultiEntitySelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  entities: HassEntity[];
  placeholder?: string;
  className?: string;
}

export function MultiEntitySelector({
  value,
  onChange,
  entities,
  placeholder = 'Select entities...',
  className,
}: MultiEntitySelectorProps) {
  const handleAdd = (entityId: string) => {
    if (!value.includes(entityId)) {
      onChange([...value, entityId]);
    }
  };
  const handleRemove = (entityId: string) => {
    onChange(value.filter((id) => id !== entityId));
  };

  return (
    <div className={cn('space-y-1', className)}>
      <EntitySelector
        value={''}
        onChange={handleAdd}
        entities={entities}
        placeholder={placeholder}
        className="w-full"
      />
      <div className="flex flex-wrap gap-1">
        {value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground border"
          >
            {id}
            <XIcon
              className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={() => handleRemove(id)}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
