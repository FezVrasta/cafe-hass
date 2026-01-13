import type { HomeAssistant as CustomCardHomeAssistant } from 'custom-card-helpers';
import type { HassServices } from 'home-assistant-js-websocket';

export type { Connection, HassConfig, HassEntity, HassService } from 'home-assistant-js-websocket';

export interface HomeAssistant extends Omit<CustomCardHomeAssistant, 'services' | 'themes'> {
  themes: { darkMode: boolean };
  services: HassServices;
}
