type OptionWithDomain = {
  value: string;
  label: string;
  domainLabel: string;
  domainColor: string;
  deviceLabel?: string;
};

function isOptionWithDomain(option: unknown): option is OptionWithDomain {
  return (
    typeof option === 'object' &&
    option !== null &&
    'domainLabel' in option &&
    'domainColor' in option &&
    'deviceLabel' in option
  );
}
// Extend ComboboxOption for this component
//
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

import { useMemo } from 'react';
import { Combobox } from '@/components/ui/Combobox';
import { useHass } from '@/contexts/HassContext';
import { cn } from '@/lib/utils';
import type { HassEntity } from '@/types/hass';

interface EntitySelectorProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional entities list. If not provided, auto-fetches from useHass() */
  entities?: HassEntity[];
  placeholder?: string;
  className?: string;
}

function getEntityName(entity: HassEntity): string {
  return (entity.attributes.friendly_name as string) || entity.entity_id;
}

export function EntitySelector({
  value,
  onChange,
  entities: entitiesProp,
  placeholder = 'Select entity...',
  className,
}: EntitySelectorProps) {
  const { entities: contextEntities, getDeviceNameForEntity } = useHass();

  // Use provided entities or fall back to context entities
  const entities = entitiesProp ?? contextEntities;

  // Map entities to ComboboxOption with domain info
  const options: OptionWithDomain[] = useMemo(
    () =>
      entities.map((entity) => {
        const domainInfo = getDomainInfo(entity.entity_id);
        return {
          value: entity.entity_id,
          label: getEntityName(entity),
          domainLabel: domainInfo.label,
          domainColor: domainInfo.color,
          deviceLabel: getDeviceNameForEntity(entity.entity_id) ?? undefined,
        };
      }),
    [entities, getDeviceNameForEntity]
  );

  // Handle case where value might be an array
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const selectedEntity = entities.find((e) => e.entity_id === normalizedValue);
  //
  const isUnknown = normalizedValue && !selectedEntity;

  const handleChange = (entityId: string) => {
    onChange(entityId);
  };

  return (
    <div className={cn('relative', className)}>
      <Combobox
        options={options}
        value={normalizedValue || ''}
        onChange={handleChange}
        placeholder={placeholder}
        buttonClassName={cn(!normalizedValue && 'text-muted-foreground')}
        disabled={options.length === 0}
        renderOption={(option) =>
          isOptionWithDomain(option) ? (
            <div className="flex flex-col gap-2 min-w-0">
              <span>{option.label}</span>

              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn('rounded px-1.5 py-0.5 font-medium text-xs', option.domainColor)}
                >
                  {option.domainLabel}
                </span>
                {option.deviceLabel && (
                  <span className="truncate text-xs text-muted-foreground">
                    {option.deviceLabel}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span>{option.label}</span>
          )
        }
        renderValue={(option) =>
          option && isOptionWithDomain(option) ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('rounded px-1.5 py-0.5 font-medium text-xs', option.domainColor)}>
                {option.domainLabel}
              </span>
              <span className="truncate">{option.label}</span>
            </div>
          ) : option ? (
            <span className="truncate">{option.label}</span>
          ) : null
        }
      />
      {isUnknown && <div className="mt-1 truncate font-mono text-red-600">{normalizedValue}</div>}
    </div>
  );
}
