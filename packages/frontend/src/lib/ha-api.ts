import type { Connection } from 'home-assistant-js-websocket';

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

export interface HassConnection {
  sendMessagePromise: (message: Record<string, unknown>) => Promise<unknown>;
}

// Type union to handle both HA API types
type HassInstance =
  | HassConfig
  | {
      states: Record<string, HassEntity>;
      services: Record<string, Record<string, unknown>>;
      callService: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
      connection?: Connection | null;
      callApi?: (method: string, path: string, data?: Record<string, unknown>) => Promise<unknown>;
    };

// Extended type for Home Assistant instances with WebSocket call method
type HassWithCallWS = HassInstance & {
  callWS: (message: Record<string, unknown>) => Promise<unknown>;
};

export interface HassConfig {
  entities?: Record<string, HassEntity>;
  states?: Record<string, HassEntity>;
  callApi?: (method: string, path: string, parameters?: Record<string, unknown>) => Promise<void>;
  callService?: (domain: string, service: string, serviceData?: Record<string, unknown>, target?: Record<string, unknown>) => Promise<void>;
  connection?: HassConnection;
}

export interface AutomationConfig {
  id?: string;
  alias?: string;
  description?: string;
  triggers?: Record<string, unknown>[];
  trigger?: Record<string, unknown>[];
  conditions?: Record<string, unknown>[];
  condition?: Record<string, unknown>[];
  actions?: Record<string, unknown>[];
  action?: Record<string, unknown>[];
  mode?: string;
  max?: number;
  variables?: Record<string, unknown>;
}

export interface TraceStep {
  path: string;
  timestamp: string;
  changed_variables?: Record<string, unknown>;
  result?: {
    result?: boolean;
    state?: Record<string, unknown>;
    params?: Record<string, unknown>;
    delay?: number;
    done?: boolean;
  };
}

export interface AutomationTrace {
  last_step: string;
  run_id: string;
  state: 'running' | 'stopped';
  script_execution: 'running' | 'finished' | 'cancelled';
  timestamp: {
    start: string;
    finish?: string;
  };
  domain: string;
  item_id: string;
  trigger: string;
  trace: Record<string, TraceStep[]>;
  config: AutomationConfig;
  context: {
    id: string;
    parent_id?: string;
    user_id?: string;
  };
}

export interface TraceListItem {
  run_id: string;
  last_step: string;
  state: 'running' | 'stopped';
  script_execution: 'running' | 'finished' | 'cancelled';
  timestamp: {
    start: string;
    finish?: string;
  };
  trigger: string;
  domain: string;
  item_id: string;
}

/**
 * Home Assistant API abstraction layer
 * Works in both custom panel mode (with hass object) and standalone mode
 */
export class HomeAssistantAPI {
  public hass: HassInstance | null = null;
  private connection: HassConnection | Connection | null = null;
  private baseUrl?: string;
  private token?: string;

  constructor(hass?: HassInstance, config?: { url?: string; token?: string }) {
    this.hass = hass || null;
    this.connection = hass?.connection || null;

    // Store base URL and token for REST API calls
    if (config?.url && config?.token) {
      this.baseUrl = config.url;
      this.token = config.token;
    } else if (typeof window !== 'undefined') {
      // In embedded mode, use current window location
      this.baseUrl = window.location.origin;
    }
  }

  /**
   * Update the hass reference (for when it changes)
   */
  updateHass(hass: HassInstance | null, config?: { url?: string; token?: string }) {
    this.hass = hass;
    this.connection = hass?.connection || null;

    // Update base URL and token if provided
    if (config?.url && config?.token) {
      this.baseUrl = config.url;
      this.token = config.token;
    } else if (typeof window !== 'undefined' && !this.baseUrl) {
      // In embedded mode, use current window location if not already set
      this.baseUrl = window.location.origin;
    }
  }

  /**
   * Check if we have a valid connection
   */
  isConnected(): boolean {
    if (!this.hass) return false;

    // Check for different possible API structures
    return !!(
      this.hass.connection ||
      this.hass.callApi ||
      this.hass.callService ||
      (this.hass.states && Object.keys(this.hass.states).length > 0)
    );
  }

  /**
   * Get all entity states
   */
  getStates(): Record<string, HassEntity> | null {
    if (!this.hass) return null;

    // Handle both HassConfig and HassAPI types
    if ('states' in this.hass && this.hass.states) {
      return this.hass.states;
    }
    if ('entities' in this.hass && this.hass.entities) {
      return this.hass.entities;
    }

    return null;
  }

  /**
   * Get a specific entity state
   */
  getState(entityId: string): HassEntity | null {
    const states = this.getStates();
    return states?.[entityId] || null;
  }

  /**
   * Get all automation entities
   */
  getAutomations(): HassEntity[] {
    const states = this.getStates();
    if (!states) return [];

    return Object.values(states).filter((entity) => entity.entity_id.startsWith('automation.'));
  }

  /**
   * Send a websocket message
   */
  async sendMessage(message: Record<string, unknown> & { type: string }): Promise<unknown> {
    if (!this.connection) {
      throw new Error('No Home Assistant connection available');
    }

    return await this.connection.sendMessagePromise(message);
  }

  /**
   * Call a Home Assistant service
   */
  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: Record<string, unknown>
  ): Promise<unknown> {
    if (this.hass?.callService) {
      // Use built-in service calling (custom panel mode)
      // Combine serviceData and target into data object for the interface
      const data = { ...serviceData, ...(target && { target }) };
      return await this.hass.callService(domain, service, data);
    } else if (this.connection) {
      // Use websocket message (standalone mode)
      return await this.sendMessage({
        type: 'call_service',
        domain,
        service,
        service_data: serviceData,
        target,
      });
    } else {
      throw new Error('No service calling method available');
    }
  }

  /**
   * Call Home Assistant REST API
   */
  async callAPI(method: string, path: string, data?: Record<string, unknown>): Promise<unknown> {
    if (this.hass?.callApi) {
      // Use built-in API calling (custom panel mode)
      return await this.hass.callApi(method, path, data);
    } else {
      // In standalone mode, we'd need to implement HTTP requests
      // For now, throw an error as this requires auth tokens
      throw new Error('REST API calls not supported in standalone mode');
    }
  }

  /**
   * Fetch data from Home Assistant REST API
   * Uses built-in callApi in embedded mode, or direct fetch in remote mode
   */
  private async fetchRestAPI(path: string, method = 'GET', body?: Record<string, unknown>): Promise<unknown> {
    if (this.hass?.callApi) {
      // Embedded mode - use built-in callApi

      return await this.hass.callApi(method, path, body);
    }

    // Remote/standalone mode - use fetch
    if (!this.baseUrl || !this.token) {
      console.error('C.A.F.E.: No authentication configured', {
        baseUrl: this.baseUrl,
        hasToken: !!this.token,
      });
      throw new Error('No authentication configured for REST API');
    }

    const url = `${this.baseUrl}/api/${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('C.A.F.E.: REST API error response:', errorText);
      throw new Error(`REST API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get automation configurations
   */
  async getAutomationConfigs(): Promise<AutomationConfig[]> {
    try {
      // First try websocket approach
      if (this.hass && 'callWS' in this.hass) {
        try {
          const hasCallWS = this.hass as HassWithCallWS;
          const result = await hasCallWS.callWS({
            type: 'config/automation/list',
          });
          if (Array.isArray(result)) {
            return result;
          }
        } catch (wsError) {
          console.warn('WebSocket automation list failed, trying alternative:', wsError);
        }
      }

      // Alternative: Use automation entity states to get basic info
      const automations = this.getAutomations();
      return automations.map((entity) => ({
        id: entity.entity_id.replace('automation.', ''),
        alias: (typeof entity.attributes.friendly_name === 'string' ? entity.attributes.friendly_name : entity.entity_id),
        description: (typeof entity.attributes.description === 'string' ? entity.attributes.description : ''),
      }));
    } catch (error) {
      console.error('Failed to get automation configs:', error);
      return [];
    }
  }

  /**
   * Get a specific automation configuration
   */
  async getAutomationConfig(automationId: string): Promise<AutomationConfig | null> {
    try {
      // Try websocket approach first
      if (this.hass && 'callWS' in this.hass) {
        try {
          const hasCallWS = this.hass as HassWithCallWS;
          const config = await hasCallWS.callWS({
            type: 'config/automation/get',
            automation_id: automationId,
          });
          if (config) {
            return config;
          }
        } catch (wsError) {
          console.warn('WebSocket automation get failed:', wsError);
        }
      }

      // Try numeric ID with REST API (for automations created via UI)
      if (!automationId.startsWith('automation.') && !Number.isNaN(Number(automationId))) {
        try {
          const config = await this.fetchRestAPI(`config/automation/config/${automationId}`);
          if (config) {
            return config;
          }
        } catch (directError) {
          console.warn(`REST API failed for automation ${automationId}:`, directError);
        }
      }

      // Fallback: get all configs and find the matching one
      const configs = await this.getAutomationConfigs();
      return (
        configs.find(
          (config) =>
            config.id === automationId ||
            config.alias === automationId ||
            `automation.${config.alias}` === automationId
        ) || null
      );
    } catch (error) {
      console.error('C.A.F.E.: Failed to get automation config:', error);
      return null;
    }
  }

  /**
   * Get automation trace (fallback method for getting config)
   */
  async getAutomationTrace(automationId: string): Promise<unknown | null> {
    try {
      const result = await this.sendMessage({
        type: 'automation/trace/get',
        automation_id: automationId,
      });

      if (Array.isArray(result) && result.length > 0) {
        return result[0].config;
      }

      return null;
    } catch (error) {
      console.error('C.A.F.E.: Failed to get automation trace:', error);
      return null;
    }
  }

  /**
   * Get automation configuration with multiple fallback methods
   */
  async getAutomationConfigWithFallback(
    automationId: string,
    alias?: string
  ): Promise<AutomationConfig | null> {
    try {
      // Method 1: Try to get from automation trace (most reliable WebSocket method)
      if (this.connection) {
        const config = await this.getAutomationTrace(automationId);
        if (config) {
          return config;
        }
      }

      // Method 2: Try to get from automation config list (REST API)
      // Note: This may not work if /api/config/automation/config doesn't exist

      let config = await this.getAutomationConfig(automationId);

      if (config) {
        return config;
      }

      // Method 3: Try to find by alias if provided
      if (alias) {
        const configs = await this.getAutomationConfigs();
        config = configs.find((cfg) => cfg.alias === alias) || null;
        if (config) {
          return config;
        }
      }

      console.warn(`C.A.F.E.: Could not find automation config for: ${automationId}`);
      return null;
    } catch (error) {
      console.error('C.A.F.E.: Failed to get automation config with fallback:', error);
      return null;
    }
  }

  /**
   * Create a new automation in Home Assistant
   */
  async createAutomation(config: AutomationConfig): Promise<string> {
    try {
      // Generate a numeric ID like Home Assistant uses
      const automationId = config.id || Date.now().toString();

      // Ensure the config has the required fields for Home Assistant (plural forms)
      const configWithId = {
        id: automationId,
        alias: config.alias || `C.A.F.E. Automation ${automationId}`,
        description: config.description || '',
        triggers: config.trigger || config.triggers || [],
        actions: config.action || config.actions || [],
        mode: config.mode || 'single',
        variables: config.variables || {},
      };

      // Step 1: Create/save the automation configuration using REST API
      try {
        await this.fetchRestAPI(`config/automation/config/${automationId}`, 'POST', configWithId);
      } catch (saveError) {
        console.error('C.A.F.E.: Failed to save automation config:', saveError);
        throw new Error(
          `Failed to save automation config: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`
        );
      }

      // Step 2: Reload automations to make it active
      // Try different available methods
      if (this.hass?.callService) {
        try {
          await this.hass.callService('automation', 'reload', {});
          return automationId;
        } catch (serviceError) {
          console.error('C.A.F.E.: callService failed:', serviceError);
        }
      }

      if (this.hass && 'callWS' in this.hass) {
        try {
          const hasCallWS = this.hass as HassWithCallWS;
          await hasCallWS.callWS({
            type: 'call_service',
            domain: 'automation',
            service: 'reload',
          });
          return automationId;
        } catch (wsError) {
          console.error('C.A.F.E.: callWS failed:', wsError);
        }
      }

      if (this.connection) {
        try {
          await this.sendMessage({
            type: 'call_service',
            domain: 'automation',
            service: 'reload',
          });
          return automationId;
        } catch (connError) {
          console.error('C.A.F.E.: connection sendMessage failed:', connError);
        }
      }

      throw new Error('No working Home Assistant connection method found');
    } catch (error) {
      console.error('C.A.F.E.: Failed to create automation:', error);
      throw new Error(
        `Failed to create automation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing automation in Home Assistant
   */
  async updateAutomation(automationId: string, config: AutomationConfig): Promise<void> {
    try {
      console.log('C.A.F.E.: Updating automation with ID:', automationId);
      console.log('C.A.F.E.: Update config:', config);

      // Ensure the config has the correct structure that HA expects (plural forms)
      const configWithId = {
        id: automationId,
        alias: config.alias || `C.A.F.E. Automation ${automationId}`,
        description: config.description || '',
        triggers: config.trigger || config.triggers || [],
        actions: config.action || config.actions || [],
        mode: config.mode || 'single',
        variables: config.variables || {},
      };

      console.log('C.A.F.E.: Final update payload:', configWithId);

      // Use POST method for updates (HA doesn't support PUT for automation config updates)
      await this.fetchRestAPI(`config/automation/config/${automationId}`, 'POST', configWithId);

      console.log('C.A.F.E.: Successfully updated automation:', automationId);
    } catch (error) {
      console.error('C.A.F.E.: Failed to update automation:', error);
      throw new Error(
        `Failed to update automation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete an automation from Home Assistant
   */
  async deleteAutomation(automationId: string): Promise<void> {
    try {
      // Use the automation config DELETE endpoint
      await this.fetchRestAPI(`config/automation/config/${automationId}`, 'DELETE');
    } catch (error) {
      console.error('C.A.F.E.: Failed to delete automation:', error);
      throw new Error(
        `Failed to delete automation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if an automation with the given alias already exists
   */
  async automationExistsByAlias(alias: string): Promise<boolean> {
    try {
      const configs = await this.getAutomationConfigs();
      const exists = configs.some((config) => config.alias === alias);

      return exists;
    } catch (error) {
      console.error('C.A.F.E.: Failed to check automation existence:', error);
      return false;
    }
  }

  /**
   * Get unique automation alias by appending number if needed
   */
  async getUniqueAutomationAlias(baseAlias: string): Promise<string> {
    try {
      let alias = baseAlias;
      let counter = 1;

      while (await this.automationExistsByAlias(alias)) {
        alias = `${baseAlias} (${counter})`;
        counter++;
      }

      return alias;
    } catch (error) {
      console.error('C.A.F.E.: Failed to get unique automation alias:', error);
      return baseAlias;
    }
  }

  /**
   * Trigger an automation
   */
  async triggerAutomation(entityId: string, skipCondition = true): Promise<void> {
    await this.callService('automation', 'trigger', {
      entity_id: entityId,
      skip_condition: skipCondition,
    });
  }

  /**
   * Turn automation on/off
   */
  async setAutomationState(entityId: string, enabled: boolean): Promise<void> {
    const service = enabled ? 'turn_on' : 'turn_off';
    await this.callService('automation', service, {
      entity_id: entityId,
    });
  }

  /**
   * Get areas
   */
  async getAreas(): Promise<unknown| []> {
    try {
      return await this.sendMessage({ type: 'config/area_registry/list' });
    } catch (error) {
      console.error('Failed to get areas:', error);
      return [];
    }
  }

  /**
   * Get devices
   */
  async getDevices(): Promise<unknown | []> {
    try {
      return await this.sendMessage({ type: 'config/device_registry/list' });
    } catch (error) {
      console.error('Failed to get devices:', error);
      return [];
    }
  }

  /**
   * Get entities registry
   */
  async getEntities(): Promise<unknown | []> {
    try {
      return await this.sendMessage({ type: 'config/entity_registry/list' });
    } catch (error) {
      console.error('Failed to get entities:', error);
      return [];
    }
  }

  /**
   * Get services
   */
  async getServices(): Promise<unknown | []> {
    try {
      return await this.sendMessage({ type: 'get_services' });
    } catch (error) {
      console.error('Failed to get services:', error);
      return {};
    }
  }

  /**
   * Validate automation config
   */
  async validateAutomationConfig(config: {
    trigger?: Record<string, unknown>[];
    condition?: Record<string, unknown>[];
    action?: Record<string, unknown>[];
  }): Promise<unknown> {
    try {
      return await this.sendMessage({
        type: 'validate_config',
        ...config,
      });
    } catch (error) {
      console.error('Failed to validate config:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Get automation trace list
   */
  async getAutomationTraces(automationId: string): Promise<TraceListItem[]> {
    try {
      const result = await this.sendMessage({
        type: 'trace/list',
        domain: 'automation',
        item_id: automationId,
      });
      return (Array.isArray(result) ? result : []) as TraceListItem[];
    } catch (error) {
      console.error('Failed to get automation traces:', error);
      return [];
    }
  }

  /**
   * Get specific automation trace details
   */
  async getAutomationTraceDetails(
    automationId: string,
    runId: string
  ): Promise<AutomationTrace | null> {
    try {
      const result = await this.sendMessage({
        type: 'trace/get',
        domain: 'automation',
        item_id: automationId,
        run_id: runId,
      });
      return (result as AutomationTrace) || null;
    } catch (error) {
      console.error('Failed to get automation trace details:', error);
      return null;
    }
  }
}

// Global API instance
let haAPI: HomeAssistantAPI | null = null;

/**
 * Get the global Home Assistant API instance
 */
export function getHomeAssistantAPI(
  hass?: HassInstance,
  config?: { url?: string; token?: string }
): HomeAssistantAPI {
  if (!haAPI) {
    haAPI = new HomeAssistantAPI(hass, config);
  } else {
    // Only update if we have a valid hass object or if the current one is null/empty
    const shouldUpdate =
      hass &&
      (!haAPI.hass || !haAPI.isConnected() || (hass.states && Object.keys(hass.states).length > 0));

    if (shouldUpdate) {
      haAPI.updateHass(hass ?? null, config);
    }
  }
  return haAPI;
}

/**
 * Initialize API for standalone mode
 */
export function initializeStandaloneAPI(): HomeAssistantAPI {
  haAPI = new HomeAssistantAPI();
  return haAPI;
}

/**
 * Reset the API instance (useful for testing)
 */
export function resetAPI(): void {
  haAPI = null;
}
