'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type FuzzySearchOptions, useFuzzySearch } from '@/hooks/useFuzzySearch';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  [key: string]: unknown; // Allow additional properties for extended option types
}

interface ComboboxProps<T extends ComboboxOption = ComboboxOption> {
  options: T[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  renderOption?: (option: T) => JSX.Element;
  renderValue?: (option: T | undefined) => JSX.Element | null;
  /** Search keys for fuzzy search. Defaults to ['label', 'value'] */
  searchKeys?: string[];
  /** Fuse.js options for customizing fuzzy search behavior */
  fuzzyOptions?: Partial<FuzzySearchOptions>;
}

export function Combobox<T extends ComboboxOption = ComboboxOption>({
  options,
  value,
  onChange,
  placeholder,
  className,
  buttonClassName,
  disabled = false,
  renderOption,
  renderValue,
  searchKeys = ['label', 'value'],
  fuzzyOptions = {},
}: ComboboxProps<T>) {
  const { t } = useTranslation(['common']);
  const [open, setOpen] = React.useState(false);

  const {
    query,
    setQuery,
    filteredItems: filteredOptions,
  } = useFuzzySearch<T>(options, {
    keys: searchKeys,
    threshold: 0.4, // Slightly more fuzzy than default
    includeScore: true,
    ignoreLocation: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ...fuzzyOptions,
  });

  const selected = options.find((opt) => opt.value === value);

  // Override the default Command filtering behavior
  const handleSearch = (search: string) => {
    setQuery(search);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('flex w-full justify-between', buttonClassName)}
          disabled={disabled}
        >
          {selected
            ? renderValue
              ? renderValue(selected)
              : selected.label
            : placeholder || t('combobox.select')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[286px] p-0', className)}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder || t('combobox.select')}
            className="h-9"
            value={query}
            onValueChange={handleSearch}
          />
          <CommandList>
            <CommandEmpty>{t('combobox.noOptions')}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue);
                    setOpen(false);
                    setQuery(''); // Clear search on selection
                  }}
                >
                  {renderOption ? renderOption(option) : option.label}
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
