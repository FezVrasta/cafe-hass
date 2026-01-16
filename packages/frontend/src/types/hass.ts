import type { HomeAssistant as CustomCardHomeAssistant } from 'custom-card-helpers';
import type { HassServices } from 'home-assistant-js-websocket';

export type { Connection, HassConfig, HassEntity, HassService } from 'home-assistant-js-websocket';

/**
 * Device registry entry from Home Assistant
 */
export interface HassDevice {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  area_id: string | null;
}

export interface HomeAssistant extends Omit<CustomCardHomeAssistant, 'services' | 'themes'> {
  themes: { darkMode: boolean };
  services: HassServices;
  devices: Record<string, HassDevice>;
}

/**
 * Home Assistant automation configuration object
 */
export interface AutomationConfig {
  id?: string;
  alias?: string;
  description?: string;
  mode?: 'single' | 'restart' | 'queued' | 'parallel';
  max?: number;
  max_exceeded?: 'silent' | 'warning' | 'critical';
  trigger?: unknown[];
  triggers?: unknown[];
  condition?: unknown[];
  conditions?: unknown[];
  action?: unknown[];
  actions?: unknown[];
  variables?: Record<string, unknown>;
  initial_state?: boolean;
  hide_entity?: boolean;
  trace?: { stored_traces?: number };
  [key: string]: unknown;
}
