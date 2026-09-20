import { useState } from 'react';
import { Input } from '@/components/ui/input';

/** What Home Assistant expects: three numbers, or nothing at all. */
export type RgbColorValue = number[] | string;

export interface RgbColorInputProps {
  value: unknown;
  /** The service field's example, e.g. `[255, 100, 100]`. Shown as the placeholder. */
  example?: unknown;
  onChange: (value: RgbColorValue) => void;
}

const RGB_PLACEHOLDER = '255, 255, 255';

/**
 * Format a stored rgb_color for the text input: `[255, 100, 100]` reads as
 * `255, 100, 100`.
 */
export function formatRgbColor(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Parse what was typed into the value that gets written to the node.
 *
 * Numbers go in as a number array, which is what Home Assistant's `rgb_color`
 * takes: a comma-separated string round-trips to YAML as `rgb_color: 255, 0, 0`,
 * which fails with "None for dictionary value". Anything that isn't a list of
 * numbers is kept verbatim rather than silently dropped, so a typo stays visible
 * instead of turning into a colour nobody asked for.
 */
export function parseRgbColor(text: string): RgbColorValue {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  if (parts.length === 0) {
    return '';
  }

  const numbers = parts.map(Number);
  return numbers.some(Number.isNaN) ? text : numbers;
}

/**
 * Text input for an RGB colour service field.
 *
 * The typed text is held locally while the field has focus, so a trailing comma
 * survives being typed; the stored value is the parsed one throughout.
 */
export function RgbColorInput({ value, example, onChange }: RgbColorInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const placeholder =
    example === undefined ? RGB_PLACEHOLDER : String(example).replace(/[[\]]/g, '');

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft ?? formatRgbColor(value)}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseRgbColor(e.target.value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
