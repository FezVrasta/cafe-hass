import type { HomeAssistant } from './hass';

declare global {
  interface Window {
    hass?: HomeAssistant;
    cafeNarrow?: boolean;
    cafeRoute?: unknown;
    cafePanel?: unknown;
  }
}
