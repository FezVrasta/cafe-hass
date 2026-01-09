// Import CSS first - the vite-plugin-css-injected-by-js will automatically inject it
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { logger } from './lib/logger';

// Define proper types for Home Assistant panel integration
interface HassRoute {
  path: string;
  prefix?: string;
  [key: string]: unknown;
}

interface HassPanel {
  component_name?: string;
  config?: Record<string, unknown>;
  icon?: string;
  title?: string;
  url_path?: string;
  [key: string]: unknown;
}

// Import HassInstance type from our API module
type HassInstance = {
  states: Record<string, { entity_id: string; state: string; attributes: Record<string, unknown> }>;
  services: Record<string, Record<string, unknown>>;
  callService?: (domain: string, service: string, data?: Record<string, unknown>) => Promise<void>;
  connection?: unknown;
  callApi?: (method: string, path: string, data?: Record<string, unknown>) => Promise<unknown>;
  auth?: unknown;
  user?: unknown;
  [key: string]: unknown;
};

// Create a web component for Home Assistant panel integration
class CafePanel extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private _hass: HassInstance | null = null;
  private _narrow: boolean = false;
  private _route: HassRoute | null = null;
  private _panel: HassPanel | null = null;

  constructor() {
    super();
    logger.debug('CafePanel custom element constructed');
  }

  // Properties that HA will set
  get hass() {
    return this._hass;
  }
  set hass(value: unknown) {
    // Type guard to ensure value conforms to HassInstance
    if (value === null || value === undefined) {
      this._hass = null;
    } else if (typeof value === 'object' && value !== null && 'states' in value) {
      this._hass = value as HassInstance;
    } else {
      logger.warn('Invalid hass object provided, ignoring');
      return;
    }

    logger.debug('Setting hass object in custom element', {
      hasHass: !!this._hass,
      statesCount: this._hass?.states ? Object.keys(this._hass.states).length : 0,
      servicesCount: this._hass?.services ? Object.keys(this._hass.services).length : 0,
      hasConnection: !!this._hass?.connection,
      hasAuth: !!this._hass?.auth,
    });

    if (this.root) this.render();
  }

  get narrow() {
    return this._narrow;
  }
  set narrow(value: boolean) {
    this._narrow = value;
    if (this.root) this.render();
  }

  get route() {
    return this._route;
  }
  set route(value: unknown) {
    // Type guard to ensure value conforms to HassRoute
    if (value === null || value === undefined) {
      this._route = null;
    } else if (typeof value === 'object' && value !== null && 'path' in value) {
      this._route = value as HassRoute;
    } else {
      logger.warn('Invalid route object provided, ignoring');
      return;
    }

    if (this.root) this.render();
  }

  get panel() {
    return this._panel;
  }
  set panel(value: unknown) {
    // Type guard to ensure value conforms to HassPanel
    if (value === null || value === undefined) {
      this._panel = null;
    } else if (typeof value === 'object' && value !== null) {
      this._panel = value as HassPanel;
    } else {
      logger.warn('Invalid panel object provided, ignoring');
      return;
    }

    if (this.root) this.render();
  }

  connectedCallback() {
    logger.debug('CafePanel custom element connected to DOM');
    if (!this.root) {
      this.style.display = 'block';
      this.style.width = '100%';
      this.style.height = '100%';
      // Ensure the custom element has proper styling context
      this.style.position = 'relative';
      this.style.isolation = 'isolate';
      this.style.contain = 'layout style';

      this.root = ReactDOM.createRoot(this);

      this.render();
    }
  }

  disconnectedCallback() {
    logger.debug('CafePanel custom element disconnected from DOM');

    // Clean up React root
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  static get observedAttributes() {
    return ['hass', 'narrow', 'route', 'panel'];
  }

  attributeChangedCallback() {
    if (this.root) {
      this.render();
    }
  }

  render() {
    if (this.root) {
      logger.debug('Rendering CafePanel', {
        hasHass: !!this._hass,
        statesCount: this._hass?.states ? Object.keys(this._hass.states).length : 0,
        narrow: this._narrow,
        routePath: this._route?.path,
        panelTitle: this._panel?.title,
      });

      this.root.render(
        <React.StrictMode>
          <App hass={this._hass} narrow={this._narrow} route={this._route} panel={this._panel} />
        </React.StrictMode>
      );
    }
  }
}

// Always define the custom element - HA will use it when needed
if (!customElements.get('cafe-panel')) {
  customElements.define('cafe-panel', CafePanel);
  logger.info('CafePanel custom element registered successfully');
} else {
  logger.warn('CafePanel custom element already registered');
}

// For standalone development (when there's a root element)
if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');

  if (rootElement) {
    logger.debug('Rendering in standalone mode');
    try {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    } catch (error) {
      logger.error('Error creating standalone React root:', error);
    }
  } else {
    logger.debug('No #root element found, assuming custom element mode');
  }
}
