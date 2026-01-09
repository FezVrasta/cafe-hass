import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HassEntity } from '@/hooks/useHass';
import { cn } from '@/lib/utils';

interface EntitySelectorProps {
  value: string;
  onChange: (value: string) => void;
  entities: HassEntity[];
  placeholder?: string;
  className?: string;
}

// Map domain to display name and color
const DOMAIN_INFO: Record<string, { label: string; color: string }> = {
  light: { label: 'Light', color: 'bg-yellow-100 text-yellow-800' },
  switch: { label: 'Switch', color: 'bg-blue-100 text-blue-800' },
  sensor: { label: 'Sensor', color: 'bg-green-100 text-green-800' },
  binary_sensor: { label: 'Binary Sensor', color: 'bg-purple-100 text-purple-800' },
  climate: { label: 'Climate', color: 'bg-orange-100 text-orange-800' },
  cover: { label: 'Cover', color: 'bg-indigo-100 text-indigo-800' },
  fan: { label: 'Fan', color: 'bg-cyan-100 text-cyan-800' },
  media_player: { label: 'Media', color: 'bg-pink-100 text-pink-800' },
  automation: { label: 'Automation', color: 'bg-slate-100 text-slate-800' },
  script: { label: 'Script', color: 'bg-slate-100 text-slate-800' },
  scene: { label: 'Scene', color: 'bg-violet-100 text-violet-800' },
  input_boolean: { label: 'Input Bool', color: 'bg-emerald-100 text-emerald-800' },
  input_number: { label: 'Input Num', color: 'bg-emerald-100 text-emerald-800' },
  input_select: { label: 'Input Select', color: 'bg-emerald-100 text-emerald-800' },
  input_text: { label: 'Input Text', color: 'bg-emerald-100 text-emerald-800' },
  input_datetime: { label: 'Input Time', color: 'bg-emerald-100 text-emerald-800' },
  person: { label: 'Person', color: 'bg-amber-100 text-amber-800' },
  device_tracker: { label: 'Tracker', color: 'bg-amber-100 text-amber-800' },
  zone: { label: 'Zone', color: 'bg-lime-100 text-lime-800' },
  sun: { label: 'Sun', color: 'bg-orange-100 text-orange-800' },
  weather: { label: 'Weather', color: 'bg-sky-100 text-sky-800' },
  camera: { label: 'Camera', color: 'bg-rose-100 text-rose-800' },
  remote: { label: 'Remote', color: 'bg-gray-100 text-gray-800' },
  vacuum: { label: 'Vacuum', color: 'bg-teal-100 text-teal-800' },
  lock: { label: 'Lock', color: 'bg-red-100 text-red-800' },
  alarm_control_panel: { label: 'Alarm', color: 'bg-red-100 text-red-800' },
  water_heater: { label: 'Water Heater', color: 'bg-blue-100 text-blue-800' },
  humidifier: { label: 'Humidifier', color: 'bg-cyan-100 text-cyan-800' },
  button: { label: 'Button', color: 'bg-slate-100 text-slate-800' },
  number: { label: 'Number', color: 'bg-slate-100 text-slate-800' },
  select: { label: 'Select', color: 'bg-slate-100 text-slate-800' },
  text: { label: 'Text', color: 'bg-slate-100 text-slate-800' },
  update: { label: 'Update', color: 'bg-blue-100 text-blue-800' },
};

function getDomainInfo(entityId: string | undefined | null): { label: string; color: string } {
  if (!entityId || typeof entityId !== 'string') {
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-700' };
  }
  const domain = entityId.split('.')[0];
  return DOMAIN_INFO[domain] || { label: domain, color: 'bg-gray-100 text-gray-700' };
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
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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

  const handleSelect = (entityId: string) => {
    onChange(entityId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const dropdown = isOpen && (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] rounded-md border bg-white shadow-lg"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
    >
      {/* Search input */}
      <div className="border-b p-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="w-full rounded border py-1.5 pr-3 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Entity list */}
      <div className="max-h-64 overflow-y-auto">
        {Object.keys(groupedEntities).length === 0 ? (
          <div className="p-3 text-center text-slate-500 text-sm">No entities found</div>
        ) : (
          Object.entries(groupedEntities).map(([domain, domainEntities]) => {
            const domainInfo = getDomainInfo(`${domain}.x`);
            return (
              <div key={domain}>
                <div className="sticky top-0 bg-slate-50 px-3 py-1.5 font-semibold text-slate-500 text-xs">
                  {domainInfo.label} ({domainEntities.length})
                </div>
                {domainEntities.map((entity) => (
                  <button
                    key={entity.entity_id}
                    type="button"
                    onClick={() => handleSelect(entity.entity_id)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left',
                      'transition-colors hover:bg-blue-50',
                      'flex items-start gap-3',
                      'border-slate-100 border-b last:border-0',
                      entity.entity_id === normalizedValue && 'bg-blue-50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900 text-sm leading-5">
                        {getEntityName(entity)}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-slate-500 text-xs">
                        {entity.entity_id}
                      </div>
                    </div>
                    <span className="flex-shrink-0 rounded bg-slate-100 px-2 py-1 font-medium text-slate-700 text-xs">
                      {entity.state}
                    </span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-left text-sm',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'flex items-center justify-between gap-2',
          'bg-white transition-colors hover:bg-slate-50'
        )}
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
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {value && (
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600" onClick={handleClear} />
          )}
          <ChevronDown
            className={cn('h-4 w-4 text-slate-400 transition-transform', isOpen && 'rotate-180')}
          />
        </div>
      </button>

      {/* Dropdown rendered in portal */}
      {createPortal(dropdown, document.body)}
    </div>
  );
}
