/** One entry of a Home Assistant `select` selector, in the shape the UI renders. */
export interface SelectorOption {
  value: string;
  label: string;
}

/**
 * Normalize the options of a Home Assistant `select` selector.
 *
 * Home Assistant writes them three different ways and hands them to us verbatim
 * over the websocket:
 *
 * - `["cool", "heat"]` — a plain list, what most services use
 * - `[["cool", "Cool"], ...]` — value/label tuples, what the API returns for some
 * - `[{ value: "cool", label: "Cool" }, ...]` — what a script's own `selector` may declare
 *
 * Rendering one shape while assuming another is how an object ends up as a React
 * child, which is React error #31.
 */
export function normalizeSelectorOptions(raw: unknown): SelectorOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const options: SelectorOption[] = [];

  for (const entry of raw) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      options.push({ value: String(entry), label: String(entry) });
      continue;
    }

    if (Array.isArray(entry)) {
      const [value, label] = entry;
      if (value === undefined || value === null) continue;
      options.push({ value: String(value), label: String(label ?? value) });
      continue;
    }

    if (entry && typeof entry === 'object' && 'value' in entry) {
      const { value, label } = entry as { value: unknown; label?: unknown };
      if (value === undefined || value === null) continue;
      options.push({ value: String(value), label: String(label ?? value) });
    }
  }

  return options;
}
