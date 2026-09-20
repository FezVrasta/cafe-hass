import { Input } from '@/components/ui/input';

/** What a numeric service field can hold: a number, or a template that yields one. */
export type NumberOrTemplate = number | string | undefined;

/** Whether a value is a Jinja template rather than a plain number. */
export function isTemplateValue(value: unknown): value is string {
  return typeof value === 'string' && (value.includes('{{') || value.includes('{%'));
}

/**
 * Decide what to store for what was typed into a numeric field.
 *
 * A number is stored as a number; anything else is kept verbatim, which is what
 * makes `brightness_pct: "{{ states('input_number.x') }}"` survive. The old
 * `<input type="number">` could not hold a template at all: the browser handed
 * back an empty string and the key was dropped from the action.
 */
export function parseNumberOrTemplate(text: string): NumberOrTemplate {
  const trimmed = text.trim();
  if (trimmed === '') {
    return undefined;
  }

  const asNumber = Number(trimmed);
  return Number.isNaN(asNumber) ? text : asNumber;
}

/** Show a stored value in the input. */
export function formatNumberOrTemplate(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

export interface NumberOrTemplateInputProps {
  value: unknown;
  placeholder?: string;
  required?: boolean;
  onChange: (value: NumberOrTemplate) => void;
}

/**
 * Input for a Home Assistant numeric field.
 *
 * It is a text input with a numeric keypad rather than `type="number"`, because
 * Home Assistant accepts a template everywhere it accepts a number, and a number
 * input silently discards one. The trade is the spinner arrows.
 */
export function NumberOrTemplateInput({
  value,
  placeholder,
  required,
  onChange,
}: NumberOrTemplateInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={formatNumberOrTemplate(value)}
      placeholder={placeholder}
      required={required}
      onChange={(e) => onChange(parseNumberOrTemplate(e.target.value))}
    />
  );
}
