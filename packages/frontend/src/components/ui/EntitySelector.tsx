import { ChevronDown, X } from 'lucide-react';
import { useMemo, useState, useRef } from 'react';
import type { HassEntity } from '@/hooks/useHass';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { usePortalContainer } from '@/contexts/PortalContainer';

interface EntitySelectorProps {
  value: string;
  onChange: (value: string) => void;
  entities: HassEntity[];
  placeholder?: string;
  className?: string;
}

// Map domain to display name and color
const DOMAIN_INFO: Record<string, { label: string; color: string }> = {
  light: {
    label: 'Light',
    color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200',
  },
  switch: {
    label: 'Switch',
    color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  },
  sensor: {
    label: 'Sensor',
    color: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  },
  binary_sensor: {
    label: 'Binary Sensor',
    color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200',
  },
  climate: {
    label: 'Climate',
    color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
  },
  cover: {
    label: 'Cover',
    color: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200',
  },
  fan: { label: 'Fan', color: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200' },
  media_player: {
    label: 'Media',
    color: 'bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200',
  },
  automation: {
    label: 'Automation',
    color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200',
  },
  script: {
    label: 'Script',
    color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200',
  },
  scene: {
    label: 'Scene',
    color: 'bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200',
  },
  input_boolean: {
    label: 'Input Bool',
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
  },
  input_number: {
    label: 'Input Num',
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
  },
  input_select: {
    label: 'Input Select',
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
  },
  input_text: {
    label: 'Input Text',
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
  },
  input_datetime: {
    label: 'Input Time',
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
  },
  person: {
    label: 'Person',
    color: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  },
  device_tracker: {
    label: 'Tracker',
    color: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  },
  zone: {
    label: 'Zone',
    color: 'bg-lime-100 dark:bg-lime-900/50 text-lime-800 dark:text-lime-200',
  },
  sun: {
    label: 'Sun',
    color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
  },
  weather: {
    label: 'Weather',
    color: 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200',
  },
  camera: {
    label: 'Camera',
    color: 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200',
  },
  remote: {
    label: 'Remote',
    color: 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200',
  },
  vacuum: {
    label: 'Vacuum',
    color: 'bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200',
  },
  lock: { label: 'Lock', color: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200' },
  alarm_control_panel: {
    label: 'Alarm',
    color: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
  },
  water_heater: {
    label: 'Water Heater',
    color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  },
  humidifier: {
    label: 'Humidifier',
    color: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200',
  },
  button: {
    label: 'Button',
    color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200',
  },
  number: {
    label: 'Number',
    color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200',
  },
  select: {
    label: 'Select',
    color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200',
  },
  text: {
    label: 'Text',
    color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200',
  },
  update: {
    label: 'Update',
    color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  },
};

function getDomainInfo(entityId: string | undefined | null): { label: string; color: string } {
  if (!entityId || typeof entityId !== 'string') {
    return {
      label: 'Unknown',
      color: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300',
    };
  }
  const domain = entityId.split('.')[0];
  return (
    DOMAIN_INFO[domain] || {
      label: domain,
      color: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300',
    }
  );
}

function getEntityName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string) || entity.entity_id;
}

export function EntitySelector({
  value,
  onChange,
  entities,
  placeholder = 'Select entity...',
  className,
}: EntitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalContainer = usePortalContainer();

  // Filter and sort entities
  const filteredEntities = useMemo(() => {
    const searchLower = search.toLowerCase();
    return entities
      .filter((entity) => {
        const name = getEntityName(entity).toLowerCase();
        const id = entity.entity_id.toLowerCase();
        return name.includes(searchLower) || id.includes(searchLower);
      })
      .sort((a, b) => {
        // Sort by domain first, then by name
        const domainA = a.entity_id.split('.')[0];
        const domainB = b.entity_id.split('.')[0];
        if (domainA !== domainB) {
          return domainA.localeCompare(domainB);
        }
        return getEntityName(a).localeCompare(getEntityName(b));
      });
  }, [entities, search]);

  // Group entities by domain
  const groupedEntities = useMemo(() => {
    const groups: Record<string, HassEntity[]> = {};
    for (const entity of filteredEntities) {
      const domain = entity.entity_id.split('.')[0];
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(entity);
    }
    return groups;
  }, [filteredEntities]);

  // Handle case where value might be an array
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const selectedEntity = entities.find((e) => e.entity_id === normalizedValue);
  const selectedInfo = normalizedValue ? getDomainInfo(normalizedValue) : null;
  const isUnknown = normalizedValue && !selectedEntity;

  const handleSelect = (entityId: string) => {
    onChange(entityId);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', !normalizedValue && 'text-muted-foreground')}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {selectedEntity ? (
                <>
                  <span
                    className={cn(
                      'flex-shrink-0 rounded px-1.5 py-0.5 font-medium text-xs',
                      selectedInfo?.color
                    )}
                  >
                    {selectedInfo?.label}
                  </span>
                  <span className="truncate">{getEntityName(selectedEntity)}</span>
                </>
              ) : isUnknown ? (
                <span className="truncate text-red-600 font-mono">{normalizedValue}</span>
              ) : (
                <span>{placeholder}</span>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              {normalizedValue && (
                <X className="h-4 w-4 opacity-50 hover:opacity-100" onClick={handleClear} />
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 min-w-[360px]"
          align="start"
          container={portalContainer}
        >
          <Command>
            <CommandInput
              placeholder="Search entities..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No entities found.</CommandEmpty>
            <CommandList className="max-h-64">
              {Object.entries(groupedEntities).map(([domain, domainEntities]) => {
                const domainInfo = getDomainInfo(`${domain}.x`);
                return (
                  <CommandGroup
                    key={domain}
                    heading={`${domainInfo.label} (${domainEntities.length})`}
                  >
                    {domainEntities.map((entity) => (
                      <CommandItem
                        key={entity.entity_id}
                        value={`${getEntityName(entity)} ${entity.entity_id}`}
                        onSelect={() => handleSelect(entity.entity_id)}
                        className="flex items-start gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-sm leading-5">
                            {getEntityName(entity)}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
                            {entity.entity_id}
                          </div>
                        </div>
                        <span className="flex-shrink-0 rounded bg-muted px-2 py-1 font-medium text-muted-foreground text-xs">
                          {entity.state}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
