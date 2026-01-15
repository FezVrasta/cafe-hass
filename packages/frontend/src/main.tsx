import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HassProvider } from './contexts/HassContext';
import { logger } from './lib/logger';
import type { HomeAssistant } from './types/hass';

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

// Create a web component for Home Assistant panel integration
class CafePanel extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private _hass: HomeAssistant | null = null;
  private _narrow: boolean = false;
  private _route: HassRoute | null = null;
  private _panel: HassPanel | null = null;
  private _forceMode: 'remote' | 'embedded' | undefined = undefined;

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
      this._hass = value as HomeAssistant;
    } else {
      logger.warn('Invalid hass object provided, ignoring');
      return;
    }

    logger.debug('Setting hass object in custom element', {
      hasHass: !!this._hass,
      statesCount: this._hass?.states ? Object.keys(this._hass.states).length : 0,
      servicesCount: this._hass?.services ? Object.keys(this._hass.services).length : 0,
      hasConnection: !!this._hass?.connection,
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

  get forceMode() {
    return this._forceMode;
  }
  set forceMode(value: unknown) {
    if (value === null || value === undefined) {
      this._forceMode = undefined;
    } else if (value === 'remote' || value === 'embedded') {
      this._forceMode = value;
    } else if (typeof value === 'string') {
      this._forceMode = value as 'remote' | 'embedded';
    } else {
      logger.warn('Invalid forceMode provided, ignoring');
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
    return ['hass', 'narrow', 'route', 'panel', 'force-mode'];
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'force-mode':
        this.forceMode = newValue ?? undefined;
        break;
      case 'narrow':
        // booleanish attribute
        this.narrow = newValue !== null && newValue !== 'false';
        break;
      default:
        // For other attributes (hass, route, panel) HA sets properties directly.
        break;
    }

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
        forceMode: this._forceMode,
      });

      this.root.render(
        <React.StrictMode>
          <HassProvider externalHass={this._hass ?? undefined} forceMode={this._forceMode}>
            <App />
          </HassProvider>
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

// For standalone development (when there's a root element) always use the web component
if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');

  if (rootElement) {
    logger.debug('Rendering in standalone mode via cafe-panel');
    try {
      // Create the custom element and attach it to the DOM so all rendering goes through it
      let panelEl = document.querySelector('cafe-panel') as HTMLElement | null;
      if (!panelEl) {
        panelEl = document.createElement('cafe-panel');
        // force remote mode for standalone dev
        panelEl.setAttribute('force-mode', 'remote');
        rootElement.appendChild(panelEl);
      }
    } catch (error) {
      logger.error('Error creating cafe-panel element for standalone mode:', error);
    }
  } else {
    logger.debug('No #root element found, assuming custom element mode');
  }
}
