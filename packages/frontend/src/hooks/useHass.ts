import type { Connection, HassEntities, HassServices } from 'home-assistant-js-websocket';
import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  subscribeServices,
} from 'home-assistant-js-websocket';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '../lib/logger';

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
  fields: Record<
    string,
    {
      name: string;
      description: string;
      required?: boolean;
      example?: unknown;
      selector?: Record<string, unknown>;
    }
  >;
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
  connection?: Connection | null;
  callApi?: (method: string, path: string, data?: unknown) => Promise<unknown>;
}

/**
 * Configuration for connecting to Home Assistant
 */
export interface HassConfig {
  url: string;
  token: string;
}

const STORAGE_KEY = 'cafe_hass_config';

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

export interface HassConfig {
  url: string;
  token: string;
}

/**
 * Hook to access Home Assistant API
 * Supports remote connection with token (uses REST API + WebSocket)
 * When external hass is available, defers to global external hass
 */
export function useHass(forceMode?: 'remote') {
  const [config, setConfigState] = useState<HassConfig>(loadConfig);
  const [remoteEntities, setRemoteEntities] = useState<HassEntity[]>([]);
  const [remoteServices, setRemoteServices] = useState<Record<string, Record<string, HassService>>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [wsConnection, setWsConnection] = useState<Connection | null>(null);

  // Check if global external hass is available (set from custom element)
  const hasGlobalExternalHass =
    globalHassInstance &&
    typeof globalHassInstance === 'object' &&
    'states' in globalHassInstance &&
    globalHassInstance.states &&
    Object.keys(globalHassInstance.states as Record<string, unknown>).length > 0;

  logger.debug('useHass hook called with config', {
    configUrl: config.url,
    hasToken: !!config.token,
    remoteEntitiesCount: remoteEntities.length,
    isLoading,
    connectionError,
    hasGlobalExternalHass,
  });

  // Mode detection - remote connection or defer to external hass
  const hasRemoteConfig = !!(config.url && config.token);
  const shouldUseRemote = forceMode === 'remote' || (!hasGlobalExternalHass && hasRemoteConfig);

  logger.debug('useHass mode detection', {
    forceMode,
    hasRemoteConfig,
    hasGlobalExternalHass,
    shouldUseRemote,
  });

  // Save config handler
  const setConfig = useCallback((newConfig: HassConfig) => {
    setConfigState(newConfig);
    saveConfig(newConfig);
    // Reset state when config changes
    setRemoteEntities([]);
    setRemoteServices({});
    setConnectionError(null);
  }, []);

  // Fetch data from remote HA instance using WebSocket
  useEffect(() => {
    if (!shouldUseRemote) return;

    const establishConnection = async () => {
      setIsLoading(true);
      setConnectionError(null);

      try {
        // Create WebSocket connection
        const auth = createLongLivedTokenAuth(config.url, config.token);
        const connection = await createConnection({ auth });

        setWsConnection(connection);

        // Handle connection events (set these up before subscribing)
        connection.addEventListener('ready', () => {
          setConnectionError(null);
          setIsLoading(false);
        });

        connection.addEventListener('disconnected', () => {
          setConnectionError('Connection lost');
        });

        connection.addEventListener('reconnect-error', (err) => {
          console.error('C.A.F.E.: WebSocket reconnection failed:', err);
          setConnectionError('Reconnection failed');
        });

        // Subscribe to entity state changes
        const unsubscribeEntities = subscribeEntities(connection, (entities: HassEntities) => {
          const entitiesArray = Object.values(entities).map((entity) => ({
            entity_id: entity.entity_id,
            state: entity.state,
            attributes: entity.attributes || {},
            last_changed: entity.last_changed || '',
            last_updated: entity.last_updated || '',
          }));

          setRemoteEntities(entitiesArray);
          // Also mark as loaded once we receive entities
          setIsLoading(false);
        });

        // Subscribe to service registry changes
        const unsubscribeServices = subscribeServices(connection, (services: HassServices) => {
          setRemoteServices(services as Record<string, Record<string, HassService>>);
        });

        // Cleanup function
        return () => {
          unsubscribeEntities();
          unsubscribeServices();
          connection.close();
          setWsConnection(null);
        };
      } catch (error) {
        console.error('C.A.F.E.: Failed to establish WebSocket connection:', error);
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setConnectionError(errorMessage);
        setIsLoading(false);
      }
    };

    const cleanup = establishConnection();

    // Cleanup on unmount or config change
    return () => {
      if (cleanup instanceof Promise) {
        cleanup.then((cleanupFn) => cleanupFn?.());
      }
    };
  }, [shouldUseRemote, config.url, config.token]);

  // Build the hass API object
  const hass = useMemo<HassAPI>(() => {
    // Use remote connection if configured
    if (shouldUseRemote) {
      logger.debug('Using remote WebSocket connection for hass');
      return {
        states: Object.fromEntries(remoteEntities.map((e) => [e.entity_id, e])),
        services: remoteServices,
        connection: wsConnection,
        callApi: async (method: string, path: string, data?: unknown) => {
          if (!config.url || !config.token) {
            throw new Error('No authentication configured');
          }

          // Use direct fetch for REST API calls
          const url = `${config.url}/api/${path}`;
          const response = await fetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${config.token}`,
              'Content-Type': 'application/json',
            },
            body: data ? JSON.stringify(data) : undefined,
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          return await response.json();
        },
        callService: async (domain, service, data) => {
          if (!wsConnection) {
            throw new Error('WebSocket connection not available');
          }
          return wsConnection.sendMessagePromise({
            type: 'call_service',
            domain,
            service,
            service_data: data || {},
          });
        },
      } as HassAPI;
    }

    // Use global external hass if available
    if (hasGlobalExternalHass && globalHassInstance && typeof globalHassInstance === 'object') {
      logger.debug('Using global external hass data');
      const globalHass = globalHassInstance as Record<string, unknown>;
      return {
        states: (globalHass.states as Record<string, unknown>) || {},
        services: (globalHass.services as Record<string, unknown>) || {},
        connection: globalHass.connection || null,
        callApi: globalHass.callApi as ((method: string, path: string, data?: unknown) => Promise<unknown>) || undefined,
        callService:
          (globalHass.callService as ((domain: string, service: string, data?: Record<string, unknown>) => Promise<void>)) ||
          (async () => {
            logger.warn('No callService method available in global hass');
          }),
      } as HassAPI;
    }

    // No connection available
    logger.warn('No Home Assistant connection available');
    return {
      states: {},
      services: {},
      callService: async () => {
        logger.warn('No Home Assistant connection configured');
      },
    };
  }, [
    shouldUseRemote,
    remoteEntities,
    remoteServices,
    wsConnection,
    config.url,
    config.token,
    hasGlobalExternalHass,
  ]);

  const entities = useMemo(() => Object.values(hass?.states ?? {}), [hass?.states]);

  const services = useMemo(() => hass?.services ?? {}, [hass?.services]);

  // Helper to get entities by domain
  const getEntitiesByDomain = useCallback(
    (domain: string) => entities.filter((e) => e.entity_id.startsWith(`${domain}.`)),
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
  const getServiceDefinition = useCallback(
    (fullServiceName: string): HassService | null => {
      if (!fullServiceName || !fullServiceName.includes('.')) return null;
      const [domain, serviceName] = fullServiceName.split('.');
      return services[domain]?.[serviceName] || null;
    },
    [services]
  );

  // Send raw WebSocket message
  const sendMessage = useCallback(
    async <T = unknown>(message: Record<string, unknown> & { type: string }): Promise<T> => {
      // Try WebSocket connection first
      if (wsConnection) {
        return wsConnection.sendMessagePromise(message) as Promise<T>;
      }

      throw new Error('No WebSocket connection available');
    },
    [wsConnection]
  );

  return {
    hass,
    isRemote: shouldUseRemote,
    isLoading: shouldUseRemote ? isLoading : false,
    connectionError: shouldUseRemote ? connectionError : null,
    entities,
    services,
    config,
    setConfig,
    getEntitiesByDomain,
    getAllServices,
    getServiceDefinition,
    sendMessage,
  };
}

// Global hass accessor for use outside React components (like zustand stores)
let globalHassInstance: unknown = null;

export function setGlobalHass(hass: unknown) {
  logger.debug('Setting global hass instance', {
    hasStates: !!(hass && typeof hass === 'object' && 'states' in hass),
    statesCount: hass && typeof hass === 'object' && 'states' in hass && hass.states ? Object.keys(hass.states as Record<string, unknown>).length : 0,
    hasServices: !!(hass && typeof hass === 'object' && 'services' in hass),
    servicesCount: hass && typeof hass === 'object' && 'services' in hass && hass.services ? Object.keys(hass.services as Record<string, unknown>).length : 0,
    hasConnection: !!(hass && typeof hass === 'object' && 'connection' in hass),
    hasCallApi: !!(hass && typeof hass === 'object' && 'callApi' in hass),
    hasCallService: !!(hass && typeof hass === 'object' && 'callService' in hass),
    hasAuth: !!(hass && typeof hass === 'object' && 'auth' in hass),
    hasUser: !!(hass && typeof hass === 'object' && 'user' in hass),
  });
  globalHassInstance = hass;
}

export function getGlobalHass() {
  // Try to get from our global instance first
  if (globalHassInstance) {
    logger.debug('Retrieved global hass instance', {
      statesCount: globalHassInstance && typeof globalHassInstance === 'object' && 'states' in globalHassInstance && globalHassInstance.states ? Object.keys(globalHassInstance.states as Record<string, unknown>).length : 0,
    });
    return globalHassInstance;
  }

  // Fallback: try to get from window.hass if available
  if (typeof window !== 'undefined' && typeof window === 'object' && 'hass' in window && window.hass) {
    logger.debug('Retrieved hass from window.hass fallback');
    return window.hass;
  }

  logger.warn('No global hass instance available');
  return null;
}
