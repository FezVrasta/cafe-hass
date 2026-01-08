import { useMemo, useState, useEffect, useCallback } from 'react';

/**
 * Home Assistant entity state
 */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

/**
 * Home Assistant service definition
 */
export interface HassService {
  name: string;
  description: string;
  fields: Record<string, {
    name: string;
    description: string;
    required?: boolean;
    example?: unknown;
    selector?: Record<string, unknown>;
  }>;
  target?: {
    entity?: Array<{ domain: string }>;
    device?: unknown;
    area?: unknown;
  };
}

/**
 * Home Assistant API interface
 */
export interface HassAPI {
  states: Record<string, HassEntity>;
  services: Record<string, Record<string, HassService>>;
  callService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
}

/**
 * Configuration for connecting to Home Assistant
 */
export interface HassConfig {
  url: string;
  token: string;
}

const STORAGE_KEY = 'hflow_hass_config';

/**
 * Load config from localStorage
 */
function loadConfig(): HassConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { url: '', token: '' };
}

/**
 * Save config to localStorage
 */
function saveConfig(config: HassConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

// Mock data for standalone development
const MOCK_ENTITIES: HassEntity[] = [
  {
    entity_id: 'light.living_room',
    state: 'on',
    attributes: { brightness: 255, friendly_name: 'Living Room Light' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'light.kitchen',
    state: 'off',
    attributes: { friendly_name: 'Kitchen Light' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'light.bedroom',
    state: 'on',
    attributes: { brightness: 128, friendly_name: 'Bedroom Light' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'sensor.temperature',
    state: '22.5',
    attributes: { unit_of_measurement: '°C', friendly_name: 'Temperature' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'sensor.humidity',
    state: '45',
    attributes: { unit_of_measurement: '%', friendly_name: 'Humidity' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'binary_sensor.motion',
    state: 'off',
    attributes: { device_class: 'motion', friendly_name: 'Motion Sensor' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'binary_sensor.door',
    state: 'off',
    attributes: { device_class: 'door', friendly_name: 'Front Door' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'sun.sun',
    state: 'above_horizon',
    attributes: {
      next_dawn: new Date().toISOString(),
      next_dusk: new Date().toISOString(),
      friendly_name: 'Sun',
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'switch.fan',
    state: 'off',
    attributes: { friendly_name: 'Ceiling Fan' },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
  {
    entity_id: 'climate.thermostat',
    state: 'heat',
    attributes: {
      temperature: 21,
      current_temperature: 20,
      friendly_name: 'Thermostat',
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  },
];

const MOCK_SERVICES: Record<string, Record<string, HassService>> = {
  light: {
    turn_on: {
      name: 'Turn on',
      description: 'Turn on a light',
      fields: {
        brightness: {
          name: 'Brightness',
          description: 'Brightness level (0-255)',
          example: 255,
          selector: { number: { min: 0, max: 255 } },
        },
        brightness_pct: {
          name: 'Brightness %',
          description: 'Brightness percentage (0-100)',
          example: 100,
          selector: { number: { min: 0, max: 100, unit_of_measurement: '%' } },
        },
        color_temp: {
          name: 'Color Temperature',
          description: 'Color temperature in mireds',
          example: 250,
          selector: { number: { min: 153, max: 500 } },
        },
        color_temp_kelvin: {
          name: 'Color Temp (K)',
          description: 'Color temperature in Kelvin',
          example: 4000,
          selector: { number: { min: 2000, max: 6500, unit_of_measurement: 'K' } },
        },
        rgb_color: {
          name: 'RGB Color',
          description: 'RGB color as [R, G, B]',
          example: [255, 100, 100],
          selector: { color_rgb: {} },
        },
        transition: {
          name: 'Transition',
          description: 'Transition time in seconds',
          example: 2,
          selector: { number: { min: 0, max: 300, unit_of_measurement: 's' } },
        },
        flash: {
          name: 'Flash',
          description: 'Flash the light',
          example: 'short',
          selector: { select: { options: ['short', 'long'] } },
        },
        effect: {
          name: 'Effect',
          description: 'Light effect',
          example: 'colorloop',
          selector: { text: {} },
        },
      },
      target: { entity: [{ domain: 'light' }] },
    },
    turn_off: {
      name: 'Turn off',
      description: 'Turn off a light',
      fields: {
        transition: {
          name: 'Transition',
          description: 'Transition time in seconds',
          example: 2,
          selector: { number: { min: 0, max: 300, unit_of_measurement: 's' } },
        },
      },
      target: { entity: [{ domain: 'light' }] },
    },
    toggle: {
      name: 'Toggle',
      description: 'Toggle a light',
      fields: {
        transition: {
          name: 'Transition',
          description: 'Transition time in seconds',
          example: 2,
          selector: { number: { min: 0, max: 300, unit_of_measurement: 's' } },
        },
      },
      target: { entity: [{ domain: 'light' }] },
    },
  },
  switch: {
    turn_on: {
      name: 'Turn on',
      description: 'Turn on a switch',
      fields: {},
      target: { entity: [{ domain: 'switch' }] },
    },
    turn_off: {
      name: 'Turn off',
      description: 'Turn off a switch',
      fields: {},
      target: { entity: [{ domain: 'switch' }] },
    },
    toggle: {
      name: 'Toggle',
      description: 'Toggle a switch',
      fields: {},
      target: { entity: [{ domain: 'switch' }] },
    },
  },
  notify: {
    mobile_app: {
      name: 'Send notification',
      description: 'Send a notification to mobile app',
      fields: {
        message: {
          name: 'Message',
          description: 'Notification message',
          required: true,
          example: 'Hello!',
        },
        title: {
          name: 'Title',
          description: 'Notification title',
          example: 'Alert',
        },
      },
    },
  },
  climate: {
    set_temperature: {
      name: 'Set Temperature',
      description: 'Set target temperature',
      fields: {
        temperature: {
          name: 'Temperature',
          description: 'Target temperature',
          required: true,
          example: 21,
        },
      },
      target: { entity: [{ domain: 'climate' }] },
    },
  },
  scene: {
    turn_on: {
      name: 'Activate',
      description: 'Activate a scene',
      fields: {},
      target: { entity: [{ domain: 'scene' }] },
    },
  },
  script: {
    turn_on: {
      name: 'Run script',
      description: 'Run a script',
      fields: {},
      target: { entity: [{ domain: 'script' }] },
    },
  },
  homeassistant: {
    restart: {
      name: 'Restart',
      description: 'Restart Home Assistant',
      fields: {},
    },
    reload_all: {
      name: 'Reload All',
      description: 'Reload all configuration',
      fields: {},
    },
  },
};

/**
 * Hook to access Home Assistant API
 * Supports three modes:
 * 1. Embedded in HA (uses window.hass)
 * 2. Standalone with token (uses REST API)
 * 3. Standalone without token (uses mock data)
 */
export function useHass() {
  const [config, setConfigState] = useState<HassConfig>(loadConfig);
  const [remoteEntities, setRemoteEntities] = useState<HassEntity[]>([]);
  const [remoteServices, setRemoteServices] = useState<Record<string, Record<string, HassService>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Check if running inside HA's iframe
  const hasWindowHass = typeof window !== 'undefined' && !!(window as unknown as { hass?: unknown }).hass;

  // Determine the mode
  const isEmbedded = hasWindowHass;
  const hasRemoteConfig = !!(config.url && config.token);
  const isStandalone = !isEmbedded && !hasRemoteConfig;
  const isRemote = !isEmbedded && hasRemoteConfig;

  // Save config handler
  const setConfig = useCallback((newConfig: HassConfig) => {
    setConfigState(newConfig);
    saveConfig(newConfig);
    // Reset state when config changes
    setRemoteEntities([]);
    setRemoteServices({});
    setConnectionError(null);
  }, []);

  // Fetch data from remote HA instance
  useEffect(() => {
    if (!isRemote) return;

    const fetchData = async () => {
      setIsLoading(true);
      setConnectionError(null);

      try {
        const headers = {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        };

        // Fetch states
        const statesResponse = await fetch(`${config.url}/api/states`, { headers });
        if (!statesResponse.ok) {
          throw new Error(`Failed to fetch states: ${statesResponse.status}`);
        }
        const states: HassEntity[] = await statesResponse.json();
        setRemoteEntities(states);

        // Fetch services
        const servicesResponse = await fetch(`${config.url}/api/services`, { headers });
        if (!servicesResponse.ok) {
          throw new Error(`Failed to fetch services: ${servicesResponse.status}`);
        }
        const servicesData: Array<{ domain: string; services: Record<string, HassService> }> = await servicesResponse.json();

        // Transform services array to Record
        const servicesMap: Record<string, Record<string, HassService>> = {};
        for (const item of servicesData) {
          servicesMap[item.domain] = item.services;
        }
        setRemoteServices(servicesMap);

      } catch (error) {
        console.error('Failed to fetch HA data:', error);
        setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isRemote, config.url, config.token]);

  // Build the hass API object
  const hass = useMemo<HassAPI>(() => {
    // Mode 1: Embedded in HA
    if (isEmbedded) {
      const hassWindow = window as unknown as { hass: HassAPI };
      return hassWindow.hass;
    }

    // Mode 2: Remote connection (even if still loading, don't fall back to mock)
    if (isRemote) {
      return {
        states: Object.fromEntries(remoteEntities.map((e) => [e.entity_id, e])),
        services: remoteServices,
        callService: async (domain, service, data) => {
          const response = await fetch(`${config.url}/api/services/${domain}/${service}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data || {}),
          });
          if (!response.ok) {
            throw new Error(`Service call failed: ${response.status}`);
          }
        },
      };
    }

    // Mode 3: Mock data (standalone without config)
    return {
      states: Object.fromEntries(MOCK_ENTITIES.map((e) => [e.entity_id, e])),
      services: MOCK_SERVICES,
      callService: async (domain, service, data) => {
        console.log(`[Mock HA] Calling ${domain}.${service}`, data);
        await new Promise((r) => setTimeout(r, 200));
      },
    };
  }, [isEmbedded, isRemote, remoteEntities, remoteServices, config.url, config.token]);

  const entities = useMemo(
    () => Object.values(hass?.states ?? {}),
    [hass?.states]
  );

  const services = useMemo(() => hass?.services ?? {}, [hass?.services]);

  // Helper to get entities by domain
  const getEntitiesByDomain = useCallback((domain: string) =>
    entities.filter((e) => e.entity_id.startsWith(`${domain}.`)),
    [entities]
  );

  // Helper to get all available services as flat list
  const getAllServices = useCallback(() => {
    const result: Array<{ domain: string; service: string; definition: HassService }> = [];
    for (const [domain, domainServices] of Object.entries(services)) {
      for (const [service, definition] of Object.entries(domainServices)) {
        result.push({ domain, service, definition });
      }
    }
    return result;
  }, [services]);

  // Helper to get service definition by full service name (e.g., "light.turn_on")
  const getServiceDefinition = useCallback((fullServiceName: string): HassService | null => {
    if (!fullServiceName || !fullServiceName.includes('.')) return null;
    const [domain, serviceName] = fullServiceName.split('.');
    return services[domain]?.[serviceName] || null;
  }, [services]);

  return {
    hass,
    isStandalone,
    isEmbedded,
    isRemote,
    isLoading,
    connectionError,
    entities,
    services,
    config,
    setConfig,
    getEntitiesByDomain,
    getAllServices,
    getServiceDefinition,
  };
}
