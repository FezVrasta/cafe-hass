import type { FlowNode } from '@cafe/shared';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldError } from '@/components/forms/FieldError';
import { FormField } from '@/components/forms/FormField';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { MultiEntitySelector } from '@/components/ui/MultiEntitySelector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getTriggerFields } from '@/config/triggerFields';
import { useHass } from '@/contexts/HassContext';
import { useNodeErrors } from '@/hooks/useNodeErrors';
import { cn } from '@/lib/utils';
import type { HassEntity } from '@/types/hass';
import { getNodeDataString } from '@/utils/nodeData';

/**
 * Common states per domain that HA entities can have.
 * Used to provide helpful suggestions when no entity is selected or the current
 * state doesn't cover all possibilities.
 */
const DOMAIN_STATES: Record<string, string[]> = {
  light: ['on', 'off', 'unavailable'],
  switch: ['on', 'off', 'unavailable'],
  binary_sensor: ['on', 'off', 'unavailable'],
  input_boolean: ['on', 'off'],
  cover: ['open', 'closed', 'opening', 'closing', 'unavailable'],
  lock: ['locked', 'unlocked', 'locking', 'unlocking', 'unavailable'],
  alarm_control_panel: [
    'disarmed',
    'armed_home',
    'armed_away',
    'armed_night',
    'armed_vacation',
    'armed_custom_bypass',
    'pending',
    'arming',
    'disarming',
    'triggered',
    'unavailable',
  ],
  climate: ['heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'off', 'unavailable'],
  fan: ['on', 'off', 'unavailable'],
  media_player: ['playing', 'paused', 'idle', 'off', 'on', 'standby', 'buffering', 'unavailable'],
  vacuum: ['cleaning', 'docked', 'paused', 'idle', 'returning', 'error', 'unavailable'],
  person: ['home', 'not_home', 'unavailable'],
  device_tracker: ['home', 'not_home', 'unavailable'],
  water_heater: [
    'electric',
    'gas',
    'heat_pump',
    'eco',
    'performance',
    'high_demand',
    'off',
    'unavailable',
  ],
  humidifier: ['on', 'off', 'unavailable'],
  update: ['on', 'off', 'unavailable'],
};

/** Fallback states shown for any domain not listed above */
const GENERIC_STATES = ['on', 'off', 'unavailable', 'unknown'];

/**
 * Derives state suggestions for an entity based on its current state and domain defaults.
 * The current live state is always included first, followed by domain-specific options.
 */
function getStateSuggestions(entityId: string, entities: HassEntity[]): string[] {
  const entity = entities.find((e) => e.entity_id === entityId);
  const domain = entityId.split('.')[0];
  const domainStates = DOMAIN_STATES[domain] ?? GENERIC_STATES;

  const suggestions = new Set<string>(domainStates);
  if (entity?.state) {
    // Prepend the current live state so it appears first
    return [entity.state, ...domainStates.filter((s) => s !== entity.state)];
  }
  return Array.from(suggestions);
}

interface StateValueComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
}

/**
 * A combobox that shows state suggestions but also allows free-text input.
 * The search query itself is always usable as a custom value.
 */
function StateValueCombobox({
  value,
  onChange,
  suggestions,
  placeholder,
}: StateValueComboboxProps) {
  const { t } = useTranslation(['common']);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase()));
  }, [query, suggestions]);

  // If the user has typed something that isn't in the list, offer it as a custom entry
  const showCustomEntry = query && !suggestions.includes(query);

  const handleSelect = (selected: string) => {
    onChange(selected === value ? '' : selected);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('flex w-full justify-between', !value && 'text-muted-foreground')}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[286px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {filtered.length === 0 && !showCustomEntry && (
              <CommandEmpty>{t('combobox.noOptions')}</CommandEmpty>
            )}
            {showCustomEntry && (
              <CommandGroup>
                <CommandItem value={query} onSelect={handleSelect}>
                  <span className="text-muted-foreground text-xs mr-2">
                    {t('stateTrigger.useValue')}
                  </span>
                  <span className="font-mono">{query}</span>
                  <Check
                    className={cn('ml-auto h-4 w-4', value === query ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((state) => (
                  <CommandItem key={state} value={state} onSelect={handleSelect}>
                    <span className="font-mono">{state}</span>
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        value === state ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface StateTriggerFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Fields for the `state` trigger platform.
 * Renders entity_id, to/from state selectors with live state suggestions, and the `for` duration.
 */
export function StateTriggerFields({ node, onChange, entities }: StateTriggerFieldsProps) {
  const { t } = useTranslation(['nodes', 'common']);
  const { getFieldError } = useNodeErrors(node.id);
  const { entities: contextEntities } = useHass();

  const allEntities = entities.length > 0 ? entities : contextEntities;

  const entityIdRaw = (node.data as Record<string, unknown>).entity_id;
  const entityIds: string[] = Array.isArray(entityIdRaw)
    ? entityIdRaw
    : typeof entityIdRaw === 'string' && entityIdRaw
      ? [entityIdRaw]
      : [];

  const toValue = getNodeDataString(node, 'to');
  const fromValue = getNodeDataString(node, 'from');

  // Collect state suggestions from all selected entities
  const stateSuggestions = useMemo(() => {
    if (entityIds.length === 0) return GENERIC_STATES;
    const allSuggestions = new Set<string>();
    for (const id of entityIds) {
      for (const s of getStateSuggestions(id, allEntities)) {
        allSuggestions.add(s);
      }
    }
    return Array.from(allSuggestions);
  }, [entityIds, allEntities]);

  // The `for` field uses the existing DynamicFieldRenderer
  const forField = getTriggerFields('state').find((f) => f.name === 'for');

  return (
    <>
      {/* Entity selector */}
      <FormField label={t('nodes:triggers.fields.entityId')} required>
        <MultiEntitySelector
          value={entityIds}
          onChange={(value) => onChange('entity_id', value)}
          entities={allEntities}
          placeholder={t('common:placeholders.selectEntity')}
        />
        <FieldError message={getFieldError('entity_id')} />
      </FormField>

      {/* To State */}
      <FormField label={t('nodes:triggers.fields.toState')}>
        <StateValueCombobox
          value={toValue}
          onChange={(v) => onChange('to', v || undefined)}
          suggestions={stateSuggestions}
          placeholder={t('nodes:triggers.fields.toStatePlaceholder')}
        />
      </FormField>

      {/* From State */}
      <FormField label={t('nodes:triggers.fields.fromState')}>
        <StateValueCombobox
          value={fromValue}
          onChange={(v) => onChange('from', v || undefined)}
          suggestions={stateSuggestions}
          placeholder={t('nodes:triggers.fields.fromStatePlaceholder')}
        />
      </FormField>

      {/* For Duration */}
      {forField && (
        <DynamicFieldRenderer
          field={forField}
          value={(node.data as Record<string, unknown>)[forField.name]}
          onChange={(value) => onChange(forField.name, value)}
          entities={allEntities}
          error={getFieldError(forField.name)}
        />
      )}
    </>
  );
}
