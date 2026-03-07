import type { HomeAssistant } from './hass';

declare global {
  interface Window {
    hass?: HomeAssistant;
    setHass?: (hass: HomeAssistant | undefined) => void;
    cafeNarrow?: boolean;
    cafeRoute?: unknown;
    cafePanel?: unknown;
  }
}
